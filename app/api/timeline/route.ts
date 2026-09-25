import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { episode, storyboard = [] } = await req.json().catch(() => ({}));
  if (!episode || !Array.isArray(storyboard)) {
    return NextResponse.json({ error: "Episode and storyboard are required." }, { status: 400 });
  }

  const scenes = (episode.scenes || []).map((scene: any, i: number) => {
    const frame = storyboard[i] || {};
    const dialogue = String(scene.dialogue || "").trim();
    return {
      number: Number(scene.number) || i + 1,
      title: scene.title || frame.title || `Scene ${i + 1}`,
      start: storyboard.slice(0, i).reduce((sum: number, x: any) => sum + (Number(x.duration) || 8), 0),
      duration: Number(frame.duration) || 8,
      dialogue,
      subtitle: dialogue,
      imageUrl: frame.imageUrl || "",
      motion: frame.motion || "slow zoom in"
    };
  });

  return NextResponse.json({
    timeline: scenes,
    totalDuration: scenes.reduce((sum: number, s: any) => sum + s.duration, 0),
    subtitleFormat: "webvtt",
    notice: "Timeline is ready for subtitle rendering and voice/audio mixing."
  });
}
