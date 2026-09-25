import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const shots = Array.isArray(body?.shots) ? body.shots : [];
  const musicDuration = Number(body?.musicDuration) || 0;
  const introDuration = Math.max(0, Number(body?.introDuration) || 0);
  const outroDuration = Math.max(0, Number(body?.outroDuration) || 0);

  if (!shots.length) return NextResponse.json({ error: "Motion shots are required." }, { status: 400 });

  const edits = shots.map((shot: any, index: number) => ({
    order: index + 1,
    shotNumber: Number(shot.number) || index + 1,
    sceneNumber: Number(shot.sceneNumber) || index + 1,
    start: 0,
    duration: Math.max(1.5, Number(shot.duration) || 8),
    imageUrl: shot.imageUrl,
    title: shot.title || `Shot ${index + 1}`,
    motion: shot.motion || "slow zoom in",
    transition: index === 0 ? "fade in" : index === shots.length - 1 ? "fade out" : "crossfade",
    dialogue: shot.dialogue || "",
    musicDuck: Boolean(shot.dialogue),
    musicGain: shot.dialogue ? 0.35 : 1
  }));

  let cursor = introDuration;
  for (const edit of edits) {
    edit.start = Number(cursor.toFixed(3));
    cursor += edit.duration;
  }

  const totalDuration = cursor + outroDuration;
  const musicLoop = musicDuration > 0 ? Math.ceil(totalDuration / musicDuration) : 0;

  return NextResponse.json({
    mode: "browser-auto-edit",
    totalDuration: Number(totalDuration.toFixed(3)),
    introDuration,
    outroDuration,
    musicDuration,
    musicLoop,
    dialogueDucking: true,
    edits,
    audioMix: {
      music: musicDuration > 0 ? "original-song" : "none",
      dialogue: "recorded-clips-when-attached",
      duckMusicDuringDialogue: true,
      dialogueMusicGain: 0.35
    }
  });
}
