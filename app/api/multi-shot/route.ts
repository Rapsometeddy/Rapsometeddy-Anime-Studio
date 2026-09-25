import { NextResponse } from "next/server";

type Scene = { number?: number; title?: string; prompt?: string; dialogue?: string; duration?: number; characters?: string[] };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const episode = body?.episode;
  const characterBible = Array.isArray(body?.characterBible) ? body.characterBible : [];
  const shotsPerScene = Math.max(3, Math.min(5, Number(body?.shotsPerScene) || 4));

  if (!episode?.scenes?.length) return NextResponse.json({ error: "An episode with scenes is required." }, { status: 400 });

  const cameraTypes = ["establishing wide shot", "medium character shot", "close-up reaction shot", "dynamic action or movement shot", "cinematic closing shot"];
  const shots: any[] = [];
  let shotNumber = 1;

  for (const scene of episode.scenes as Scene[]) {
    const number = Number(scene.number) || shots.length + 1;
    const base = scene.prompt || "Original cinematic anime scene.";
    const source = (base + " " + (scene.dialogue || "")).toLowerCase();
    const explicit = Array.isArray(scene.characters) ? scene.characters.map(String) : [];
    const relevant = characterBible.filter((c: any) => explicit.includes(c.name) || source.includes(String(c.name || "").toLowerCase()));
    const locks = (relevant.length ? relevant : characterBible).map((c: any) => c.consistency_anchor).filter(Boolean);
    const sceneDuration = Number(scene.duration) || 8;
    const shotDuration = Math.max(1.5, sceneDuration / shotsPerScene);

    for (let i = 0; i < shotsPerScene; i++) {
      const camera = cameraTypes[i % cameraTypes.length];
      const prompt = [
        "Original anime cinematic shot for Rapsometeddy Anime Studio.",
        "This is shot " + (i + 1) + " of " + shotsPerScene + " in scene " + number + ".",
        camera + ".",
        "Maintain exact character identity, proportions, hair, clothing and palette from the character locks.",
        "No logos, copyrighted characters, text or watermark.",
        locks.length ? "CHARACTER LOCKS: " + locks.join(" | ") : "",
        "SCENE: " + base,
        "SHOT DIRECTION: " + camera
      ].filter(Boolean).join(" ");

      const model = process.env.POLLINATIONS_MODEL || "flux";
      const imageUrl = "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(model) + "&width=1280&height=720&nologo=true";
      shots.push({
        id: "scene-" + number + "-shot-" + (i + 1),
        sceneNumber: number,
        shotNumber: shotNumber++,
        shotInScene: i + 1,
        title: (scene.title || "Scene " + number) + " — " + camera,
        imageUrl,
        prompt,
        duration: shotDuration,
        camera,
        dialogue: i === 1 ? (scene.dialogue || "") : "",
        characters: relevant.map((c: any) => c.name)
      });
    }
  }

  return NextResponse.json({
    mode: process.env.POLLINATIONS_API_KEY ? "provider" : "preview",
    locked: characterBible.length > 0,
    shotsPerScene,
    totalShots: shots.length,
    shots
  });
}