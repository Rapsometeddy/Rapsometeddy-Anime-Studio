import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt, model = "flux", width = 1280, height = 720 } = await req.json().catch(() => ({}));
  if (!prompt?.trim()) return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });

  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) {
    return NextResponse.json({
      mode: "preview",
      imageUrl: `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=${width}&height=${height}`,
      notice: "Preview URL generated. Add POLLINATIONS_API_KEY in Vercel for authenticated generation."
    });
  }

  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=${width}&height=${height}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return NextResponse.json({ error: "Image provider request failed." }, { status: 502 });
  const blob = await r.blob();
  return new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg", "Cache-Control": "no-store" } });
}