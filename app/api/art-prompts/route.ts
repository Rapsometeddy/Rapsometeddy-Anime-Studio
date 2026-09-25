import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const { characters = [], scenes = [], style = "cinematic original anime" } = await req.json().catch(() => ({}));
  return NextResponse.json({
    style,
    providerReady: false,
    characters: characters.map((c:any) => ({name:c.name,prompt:`${style}, original anime character reference, ${c.visual_prompt || c.role || ""}, consistent face, hairstyle, outfit and palette, full body, clean reference sheet`})),
    scenes: scenes.map((s:any) => ({number:s.number,title:s.title,prompt:`${style}, original anime scene, ${s.prompt || ""}, cinematic composition, consistent character design, detailed background, widescreen 16:9`}))
  });
}