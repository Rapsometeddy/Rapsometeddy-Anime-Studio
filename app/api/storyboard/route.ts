import { NextResponse } from "next/server";

type Scene = {
  number?: number;
  title?: string;
  prompt?: string;
  dialogue?: string;
  duration?: number;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const episode = body?.episode;

  if (!episode || !Array.isArray(episode.scenes) || episode.scenes.length === 0) {
    return NextResponse.json({ error: "A generated episode with scenes is required." }, { status: 400 });
  }

  const model = process.env.POLLINATIONS_MODEL || "flux";

  const storyboard = episode.scenes.map((scene: Scene, index: number) => {
    const number = Number(scene.number) || index + 1;
    const title = scene.title || `Scene ${number}`;
    const basePrompt = scene.prompt || "Original cinematic anime scene.";
    const prompt = [
      "Original anime storyboard frame for the Rapsometeddy Anime Studio.",
      "Keep character identity, hair, clothing, proportions, color palette and art style consistent across the episode.",
      "No logos, no copyrighted characters, no text in the image.",
      "Cinematic 16:9 composition, polished anime key visual, clear foreground and background separation.",
      basePrompt
    ].join(" ");

    const imageUrl =
      `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=1280&height=720`;

    return {
      number,
      title,
      prompt,
      dialogue: scene.dialogue || "",
      duration: Number(scene.duration) || 8,
      imageUrl
    };
  });

  return NextResponse.json({
    mode: process.env.POLLINATIONS_API_KEY ? "provider" : "preview",
    storyboard,
    notice: process.env.POLLINATIONS_API_KEY
      ? "Storyboard image URLs are ready for the configured image provider."
      : "Preview mode: storyboard frames use provider image URLs. Add POLLINATIONS_API_KEY for authenticated generation."
  });
}
