import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/youtube/callback", req.url).toString();

  if (!clientId) {
    return NextResponse.json({
      connected: false,
      setupRequired: true,
      message: "Add GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to enable YouTube OAuth."
    }, { status: 503 });
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube",
    state
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set("youtube_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
