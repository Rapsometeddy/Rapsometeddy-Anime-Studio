import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text = "", voice = "", rate = 1, pitch = 1 } = await req.json().catch(() => ({}));
  const clean = String(text).trim();
  if (!clean) return NextResponse.json({ error: "Text is required." }, { status: 400 });

  return NextResponse.json({
    mode: "browser-native",
    text: clean,
    voice: String(voice),
    rate: Number(rate) || 1,
    pitch: Number(pitch) || 1,
    notice: "Voice generation is intentionally browser-native/free-first. Use the Voice Lab preview to render dialogue locally on the device."
  });
}
