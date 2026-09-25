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

  const hasConnection = req.headers.get("cookie")?.includes("youtube_oauth_connected=1");
  if (!hasConnection) {
    return NextResponse.json({
      connected: false,
      setupRequired: true,
      error: "YouTube is not connected. Connect Google/YouTube first."
    }, { status: 401 });
  }

  // Uploading the rendered MP4 requires a server-side OAuth access/refresh
  // token and a binary upload stream. This endpoint deliberately stops here
  // until secure token persistence and file transfer are configured.
  return NextResponse.json({
    connected: true,
    ready: false,
    setupRequired: true,
    privacyStatus,
    message: "YouTube OAuth connection is established, but secure token persistence and MP4 upload storage still need to be configured."
  }, { status: 501 });
}
