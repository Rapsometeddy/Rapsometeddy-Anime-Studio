import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { storyboard = [] } = await req.json().catch(() => ({}));
  if (!Array.isArray(storyboard) || storyboard.length === 0) {
    return NextResponse.json({ error: "A storyboard is required." }, { status: 400 });
  }

  const shots = storyboard.map((frame: any, index: number) => ({
    number: Number(frame.number) || index + 1,
    title: frame.title || `Scene ${index + 1}`,
    imageUrl: frame.imageUrl,
    duration: Math.max(3, Number(frame.duration) || 8),
    motion: index % 3 === 0 ? "slow zoom in" : index % 3 === 1 ? "pan right" : "slow zoom out",
    transition: index === storyboard.length - 1 ? "fade out" : "crossfade"
  }));

  return NextResponse.json({
    mode: "browser-preview",
    totalDuration: shots.reduce((sum: number, shot: any) => sum + shot.duration, 0),
    shots,
    notice: "Motion preview uses cinematic camera movement in the browser. Final MP4 rendering is a separate export stage."
  });
}
