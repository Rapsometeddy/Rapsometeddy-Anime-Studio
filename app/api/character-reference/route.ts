import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { character, style = "cinematic original anime" } = await req.json().catch(() => ({}));
  if (!character?.name) return NextResponse.json({ error: "Character is required." }, { status: 400 });
  const prompt = [style, "original anime character reference sheet", "three-quarter front view, side profile, full body, expression strip", "clean studio background, consistent proportions, model-sheet composition", character.consistency_anchor || character.appearance || "", "hair: " + (character.hair || ""), "eyes: " + (character.eyes || ""), "outfit: " + (character.outfit || ""), "palette: " + (character.palette || ""), "signature details: " + ((character.signature_details || []).join(", ")), "avoid: " + (character.negative_prompt || "")].join(", ");
  const model = process.env.POLLINATIONS_MODEL || "flux";
  const imageUrl = "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(model) + "&width=1024&height=1024&nologo=true";
  return NextResponse.json({ mode: process.env.POLLINATIONS_API_KEY ? "provider" : "preview", name: character.name, prompt, imageUrl });
}