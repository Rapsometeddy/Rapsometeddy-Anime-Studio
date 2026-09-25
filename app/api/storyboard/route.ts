import { NextResponse } from "next/server";

type Scene = {
  number?: number;
  title?: string;
  prompt?: string;
  dialogue?: string;
  duration?: number;
  characters?: string[];
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const episode = body?.episode;
  const characterBible = Array.isArray(body?.characterBible) ? body.characterBible : [];

  if (!episode || !Array.isArray(episode.scenes) || episode.scenes.length === 0) {
    return NextResponse.json({ error: "A generated episode with scenes is required." }, { status: 400 });
  }

  const model = process.env.POLLINATIONS_MODEL || "flux";

  const storyboard = episode.scenes.map((scene: Scene, index: number) => {
    const number = Number(scene.number) || index + 1;
    const title = scene.title || "Scene " + number;
    const basePrompt = scene.prompt || "Original cinematic anime scene.";
    const source = (basePrompt + " " + (scene.dialogue || "")).toLowerCase();
    const explicitNames = Array.isArray(scene.characters) ? scene.characters.map(String) : [];
    const relevant = characterBible.filter((c: any) => explicitNames.includes(c.name) || source.includes(String(c.name || "").toLowerCase()));
    const lockedCharacters = (relevant.length ? relevant : characterBible).map((c: any) => c.consistency_anchor).filter(Boolean);

    const prompt = [
      "Original anime storyboard frame for the Rapsometeddy Anime Studio.",
      "Keep character identity, hair, clothing, proportions, color palette and art style consistent across the episode.",
      "No logos, no copyrighted characters, no text in the image.",
      "Cinematic 16:9 composition, polished anime key visual, clear foreground and background separation.",
      lockedCharacters.length ? "CHARACTER CONSISTENCY LOCKS: " + lockedCharacters.join(" | ") : "",
      basePrompt
    ].filter(Boolean).join(" ");

    const imageUrl =
      "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(model) + "&width=1280&height=720&nologo=true";

    return {
      number,
      title,
      prompt,
      dialogue: scene.dialogue || "",
      duration: Number(scene.duration) || 8,
      imageUrl,
      characters: relevant.map((c: any) => c.name)
    };
  });

  return NextResponse.json({
    mode: process.env.POLLINATIONS_API_KEY ? "provider" : "preview",
    locked: characterBible.length > 0,
    storyboard,
    notice: process.env.POLLINATIONS_API_KEY
      ? "Storyboard image URLs are ready for the configured image provider with character locks."
      : "Preview mode: storyboard frames use provider image URLs. Add POLLINATIONS_API_KEY for authenticated generation."
  });
}