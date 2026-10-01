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

  const allowedHosts = new Set([
    "gen.pollinations.ai",
    "image.pollinations.ai"
  ]);

  if (!allowedHosts.has(target.hostname)) {
    return NextResponse.json({ error: "Image provider is not allowed." }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "image/*" },
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Image provider returned HTTP ${upstream.status}.` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Image provider returned a non-image response." }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the image provider." }, { status: 502 });
  }
}
