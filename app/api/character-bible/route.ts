import { NextResponse } from "next/server";

function normalizeCharacter(c: any, index: number) {
  const name = String(c?.name || "Character " + (index + 1)).trim();
  const role = String(c?.role || "supporting character").trim();
  const appearance = String(c?.appearance || c?.visual_prompt || c?.description || "distinct original anime appearance").trim();
  const hair = String(c?.hair || "distinctive hairstyle").trim();
  const eyes = String(c?.eyes || "expressive eyes").trim();
  const outfit = String(c?.outfit || c?.clothing || "signature outfit matching the story world").trim();
  const palette = String(c?.palette || "purple, black and neutral accent tones").trim();
  const personality = String(c?.personality || "consistent with the story").trim();
  const signature = Array.isArray(c?.signature_details) ? c.signature_details.map(String) : [String(c?.signature_details || "one memorable accessory or visual motif")];
  const id = "char-" + (index + 1);
  const anchor = ["CHARACTER LOCK: " + name, "same face and facial proportions in every shot", "same " + hair, "same " + eyes, "same " + outfit, "same palette: " + palette, "signature details: " + signature.join(", "), "do not redesign, age up/down, recolor, change hairstyle or change clothing unless explicitly requested"].join("; ");
  return { id, name, role, age: String(c?.age || "unspecified"), appearance, hair, eyes, outfit, palette, personality, signature_details: signature, negative_prompt: "different face, different hairstyle, different outfit, different age, inconsistent colors, duplicate character, extra limbs, text, watermark", consistency_anchor: anchor };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const characters = Array.isArray(body.characters) ? body.characters : [];
  if (!characters.length) return NextResponse.json({ error: "No characters were supplied." }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ mode: "demo", locked: true, characters: characters.map(normalizeCharacter), notice: "Free-first character bible active. Add OPENAI_API_KEY for richer character expansion." });
  }

  const prompt = "Create a stable character bible for an original anime project. Return valid JSON only as {\"characters\":[...]}. Preserve supplied names and roles. For every character include id, name, role, age, appearance, hair, eyes, outfit, palette, personality, signature_details (array), negative_prompt, consistency_anchor. The consistency_anchor must be a compact visual lock that can be pasted into every image prompt. Never copy an existing franchise character. Source characters: " + JSON.stringify(characters);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.4, messages: [{ role: "system", content: "You are a character design supervisor. Return JSON only." }, { role: "user", content: prompt }] })
  });
  if (!r.ok) return NextResponse.json({ error: "Character bible AI request failed." }, { status: 502 });
  const d = await r.json();
  let content = d.choices?.[0]?.message?.content || "{}";
  content = content.replace(/^\`\`\`json\s*/, "").replace(/\s*\`\`\`$/, "");
  try {
    const parsed = JSON.parse(content);
    return NextResponse.json({ mode: "ai", locked: true, characters: (parsed.characters || []).map(normalizeCharacter) });
  } catch {
    return NextResponse.json({ error: "Character bible AI returned invalid JSON." }, { status: 502 });
  }
}