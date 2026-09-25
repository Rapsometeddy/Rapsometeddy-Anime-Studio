import { NextResponse } from "next/server";

const allowedPrivacy = new Set(["private", "unlisted", "public"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const workflowStatus = String(body?.workflowStatus || "draft");
  const privacyStatus = String(body?.privacyStatus || "private");

  if (workflowStatus !== "approved") {
    return NextResponse.json({ error: "Episode must be approved before a YouTube upload can start." }, { status: 409 });
  }
  if (!allowedPrivacy.has(privacyStatus)) {
    return NextResponse.json({ error: "Privacy must be private, unlisted, or public." }, { status: 400 });
  }

  const cookie = req.headers.get("cookie") || "";
  const accessToken = cookie.match(/(?:^|; )youtube_access_token=([^;]+)/)?.[1];
  if (!accessToken) {
    return NextResponse.json({
      connected: false,
      setupRequired: true,
      error: "YouTube is not connected or the access token has expired. Connect again."
    }, { status: 401 });
  }

  const title = String(body?.title || "Rapsometeddy Anime Episode").slice(0, 100);
  const description = String(body?.description || "").slice(0, 5000);
  const tags = Array.isArray(body?.tags) ? body.tags.map((x: any) => String(x)).filter(Boolean).slice(0, 30) : [];

  const metadata = {
    snippet: { title, description, tags, categoryId: "24" },
    status: { privacyStatus }
  };

  const session = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4"
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!session.ok) {
    const detail = await session.text().catch(() => "");
    return NextResponse.json({ error: detail || "Could not start YouTube upload session." }, { status: session.status });
  }

  const uploadUrl = session.headers.get("location");
  if (!uploadUrl) return NextResponse.json({ error: "YouTube did not return an upload URL." }, { status: 502 });

  return NextResponse.json({
    connected: true,
    ready: true,
    privacyStatus,
    uploadUrl,
    message: "Upload session ready. Send the rendered MP4 to the returned upload URL."
  });
}
