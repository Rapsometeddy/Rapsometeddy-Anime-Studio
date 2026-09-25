import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const expected = req.headers.get("cookie")?.match(/(?:^|; )youtube_oauth_state=([^;]+)/)?.[1];

  if (error) return NextResponse.redirect(new URL(`/?youtube_error=${encodeURIComponent(error)}`, url.origin));
  if (!code || !state || !expected || state !== decodeURIComponent(expected)) {
    return NextResponse.redirect(new URL("/?youtube_error=oauth_state_mismatch", url.origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/youtube/callback", req.url).toString();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?youtube_error=missing_google_oauth_env", url.origin));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/?youtube_error=token_exchange_failed", url.origin));
  }

  const tokens = await tokenResponse.json();
  const response = NextResponse.redirect(new URL("/?youtube_connected=1", url.origin));

  // This cookie is only a short-lived handoff marker. Do not store OAuth
  // refresh tokens in browser-readable storage. Persistent token storage
  // should be added with an encrypted server-side database in the next step.
  response.cookies.delete("youtube_oauth_state");
  if (tokens.access_token) {
    response.cookies.set("youtube_oauth_connected", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/"
    });
    response.cookies.set("youtube_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.max(300, Number(tokens.expires_in || 3600)),
      path: "/"
    });
    if (tokens.refresh_token) {
      response.cookies.set("youtube_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/"
      });
    }
  }
  return response;
}
