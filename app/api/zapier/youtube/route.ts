import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_YOUTUBE_WEBHOOK_URL;
const BUCKET = "anime-episodes";
const MAX_BYTES = 100 * 1024 * 1024;

function headers(extra: Record<string, string> = {}) {
  if (!SUPABASE_KEY) throw new Error("Supabase service role key is not configured.");
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra
  };
}

async function ensureBucket() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase environment variables are not configured.");
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers({ "Content-Type": "application/json" }) },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: MAX_BYTES,
      allowed_mime_types: ["video/mp4", "video/webm", "video/quicktime", "video/*"]
    })
  });
  if (!r.ok && r.status !== 409) {
    throw new Error(await r.text());
  }
}

export async function POST(req: Request) {
  try {
    if (!ZAPIER_WEBHOOK_URL) {
      return NextResponse.json({
        error: "Zapier is not configured yet. Add ZAPIER_YOUTUBE_WEBHOOK_URL in Vercel."
      }, { status: 503 });
    }

    const form = await req.formData();
    const file = form.get("video");
    const workflowStatus = String(form.get("workflowStatus") || "draft");
    const title = String(form.get("title") || "Rapsometeddy Anime Episode");
    const description = String(form.get("description") || "");
    const tags = JSON.parse(String(form.get("tags") || "[]"));
    const privacyStatus = String(form.get("privacyStatus") || "private");
    const thumbnailUrl = String(form.get("thumbnailUrl") || "");

    if (workflowStatus !== "approved") {
      return NextResponse.json({ error: "Episode must be approved before sending it to Zapier." }, { status: 409 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Rendered video file is required." }, { status: 400 });
    }
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are accepted." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Video is larger than 100 MB. Compress the MP4 before sending it to Zapier." }, { status: 413 });
    }

    await ensureBucket();

    const safeTitle = title.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "episode";
    const path = `rapsometeddy/${Date.now()}-${safeTitle}.mp4`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        ...headers({
          "Content-Type": file.type || "video/mp4",
          "x-upsert": "true",
          "cache-control": "3600"
        })
      },
      body: bytes
    });

    if (!upload.ok) {
      throw new Error(await upload.text());
    }

    const signed = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...headers({ "Content-Type": "application/json" }) },
      body: JSON.stringify({ expiresIn: 3600 })
    });

    if (!signed.ok) {
      throw new Error(await signed.text());
    }

    const signedData = await signed.json();
    const signedPath = signedData?.signedURL;
    if (!signedPath) throw new Error("Supabase did not return a signed video URL.");

    const videoUrl = signedPath.startsWith("http")
      ? signedPath
      : `${SUPABASE_URL}/storage/v1${signedPath}`;

    const payload = {
      source: "Rapsometeddy Anime Studio",
      event: "approved_episode",
      title,
      description,
      tags: Array.isArray(tags) ? tags : [],
      privacyStatus,
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      filename: file.name,
      mimeType: file.type || "video/mp4",
      sizeBytes: file.size,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    };

    const hook = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!hook.ok) {
      const detail = await hook.text().catch(() => "");
      return NextResponse.json({
        error: "Video was stored, but Zapier rejected the handoff.",
        detail,
        videoUrl
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      videoUrl,
      message: "Approved episode handed to Zapier. Zapier can now upload it to YouTube."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not hand the episode to Zapier." }, { status: 500 });
  }
}
