import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || body?.episode?.title || "Rapsometeddy Anime Episode").trim();
  const character = body?.character || {};
  const subject = String(character?.name || "main anime protagonist");
  const prompt = `YouTube thumbnail for an original anime episode titled "${title}". Focus on ${subject}, dramatic expressive face, cinematic anime composition, strong purple Rapsometeddy identity, dark futuristic atmosphere, dynamic rim lighting, high contrast, clean background, clear focal subject, empty safe space for title text, professional YouTube thumbnail, 16:9, no logos, no watermark, no copyrighted characters.`;
  const encoded = encodeURIComponent(prompt);
  const imageUrl = `https://gen.pollinations.ai/image/${encoded}?model=flux&width=1280&height=720&nologo=true`;
  return NextResponse.json({ mode: "pollinations-free-first", prompt, imageUrl, title });
}
