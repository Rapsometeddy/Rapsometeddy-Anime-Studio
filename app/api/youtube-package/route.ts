import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const episode = body?.episode || {};
  const autoEdit = body?.autoEdit || {};
  const title = String(episode.title || body?.title || "Rapsometeddy Anime Episode").trim();
  const logline = String(episode.logline || "").trim();
  const scenes = Array.isArray(episode.scenes) ? episode.scenes : [];

  const chapters = scenes.map((scene: any, i: number) => {
    const edit = Array.isArray(autoEdit.edits) ? autoEdit.edits.find((x: any) => Number(x.sceneNumber) === Number(scene.number)) : null;
    return {
      time: Number(edit?.start || 0),
      label: String(scene.title || `Scene ${i + 1}`)
    };
  });

  const description = [
    `${title}`,
    logline,
    "",
    "An original Rapsometeddy Anime Studio production.",
    "Story, visuals, music and edit created for this original episode.",
    "",
    chapters.length ? "CHAPTERS" : "",
    ...chapters.map((c: any) => `${formatTime(c.time)} — ${c.label}`),
    "",
    "#Rapsometeddy #Anime #OriginalAnimation #AnimeMusic"
  ].filter(Boolean).join("\n");

  const tags = [
    "Rapsometeddy", "anime", "original anime", "anime music", "anime episode",
    "indie animation", "motion manga", "AI assisted animation", "original story"
  ];

  const thumbnailPrompt = `YouTube thumbnail for an original anime episode titled "${title}". Dramatic cinematic composition, one clear main character, strong facial emotion, dynamic lighting, purple Rapsometeddy visual identity, dark futuristic atmosphere, high contrast, clean background, empty space for title text, 16:9, no logos, no watermark, no copyrighted characters.`;

  return NextResponse.json({
    mode: "free-first-youtube-package",
    title,
    description,
    chapters,
    tags,
    thumbnailPrompt,
    uploadChecklist: [
      "Review final MP4",
      "Check dialogue/music levels",
      "Choose or generate thumbnail",
      "Paste title and description",
      "Review chapters and tags",
      "Preview before publishing"
    ]
  });
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
