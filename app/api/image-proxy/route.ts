import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const source = new URL(req.url).searchParams.get("url");

  if (!source) {
    return NextResponse.json({ error: "Image URL is required." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  const allowedHosts = new Set(["gen.pollinations.ai", "image.pollinations.ai"]);
  if (!allowedHosts.has(target.hostname)) {
    return NextResponse.json({ error: "Image provider is not allowed." }, { status: 403 });
  }

  try {
    const headers: HeadersInit = { Accept: "image/*" };
    const apiKey = process.env.POLLINATIONS_API_KEY;

    // Keep the Pollinations secret server-side.
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(target.toString(), {
      headers,
      cache: "no-store",
      redirect: "follow"
    });

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `Image provider returned HTTP ${upstream.status}.`,
          provider: target.hostname,
          authenticated: Boolean(apiKey)
        },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Image provider returned a non-image response.", provider: target.hostname },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not reach the image provider.",
        detail: error instanceof Error ? error.message : "Unknown proxy error."
      },
      { status: 502 }
    );
  }
}
