import { NextResponse } from "next/server";

export const runtime = "nodejs";

function serverEnv(name: string) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;

  // Vercel's Supabase integration prefixes variables with the project ref.
  // Read only server-side variables; never fall back to NEXT_PUBLIC secrets.
  const suffix = `_${name}`;
  const prefixed = Object.entries(process.env).find(([key, value]) =>
    !key.startsWith("NEXT_PUBLIC_") &&
    key.endsWith(suffix) &&
    typeof value === "string" &&
    value.trim().length > 0
  );
  return prefixed?.[1]?.trim() || "";
}

const rawSupabaseUrl = serverEnv("SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function normalizeSupabaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = /^[a-z0-9-]+\.supabase\.co$/i.test(candidate)
      ? `https://${candidate}`
      : `https://${candidate.split("/")[0]}.supabase.co`;
  }

  try {
    const url = new URL(candidate);
    // Accept a project URL, project ref, or Data API URL; Storage always uses the origin.
    return url.origin;
  } catch {
    return "";
  }
}

function isZapierCatchHook(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "hooks.zapier.com" &&
      url.pathname.includes("/hooks/catch/");
  } catch {
    return false;
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(rawSupabaseUrl);
const SUPABASE_KEY = serverEnv("SUPABASE_SECRET_KEY") || serverEnv("SUPABASE_SERVICE_ROLE_KEY");
const ZAPIER_WEBHOOK_URL = (process.env.ZAPIER_YOUTUBE_WEBHOOK_URL || "").trim();
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
    if (!isZapierCatchHook(ZAPIER_WEBHOOK_URL)) {
      return NextResponse.json({
        error: "Zapier Catch Hook URL is missing or invalid. Publish a Zap with Webhooks by Zapier → Catch Hook, then set its HTTPS hooks.zapier.com URL as ZAPIER_YOUTUBE_WEBHOOK_URL in Vercel."
      }, { status: 503 });
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({
        error: "Secure video storage is not configured. Check the Supabase URL and server secret key in Vercel."
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
    const extension = file.type.toLowerCase() === "video/webm" || file.name.toLowerCase().endsWith(".webm")
      ? "webm"
      : file.type.toLowerCase() === "video/quicktime" || file.name.toLowerCase().endsWith(".mov")
        ? "mov"
        : "mp4";
    const path = `rapsometeddy/${Date.now()}-${safeTitle}.${extension}`;
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

    let hook: Response;
    try {
      hook = await fetch(ZAPIER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error("Could not reach the Zapier Catch Hook. Check that ZAPIER_YOUTUBE_WEBHOOK_URL contains the active hook from your published Zap.");
    }

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
    const message = e?.message === "fetch failed"
      ? "Could not reach Supabase Storage. Check the Supabase project URL and server secret key in Vercel."
      : e?.message || "Could not hand the episode to Zapier.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
