import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { storyboard = [], multiShots = [] } = await req.json().catch(() => ({}));
  const source = Array.isArray(multiShots) && multiShots.length ? multiShots : storyboard;
  if (!Array.isArray(source) || source.length === 0) {
    return NextResponse.json({ error: "A storyboard or multi-shot scene list is required." }, { status: 400 });
  }

  const shots = source.map((frame: any, index: number) => ({
    number: Number(frame.shotNumber || frame.number) || index + 1,
    sceneNumber: Number(frame.sceneNumber || frame.number) || index + 1,
    shotInScene: Number(frame.shotInScene) || 1,
    title: frame.title || `Scene ${index + 1}`,
    imageUrl: frame.imageUrl,
    duration: Math.max(1.5, Number(frame.duration) || 8),
    motion: index % 3 === 0 ? "slow zoom in" : index % 3 === 1 ? "pan right" : "slow zoom out",
    transition: index === source.length - 1 ? "fade out" : "crossfade",
    dialogue: frame.dialogue || ""
  }));

  return NextResponse.json({
    mode: multiShots.length ? "multi-shot-browser-preview" : "browser-preview",
    totalDuration: shots.reduce((sum: number, shot: any) => sum + shot.duration, 0),
    shots,
    notice: "Multi-shot frames are now the render source. Each shot receives its own camera movement and timing."
  });
}
