import { NextResponse } from "next/server";

function serverEnv(name: string) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const suffix = `_${name}`;
  const prefixed = Object.entries(process.env).find(([key, value]) =>
    !key.startsWith("NEXT_PUBLIC_") &&
    key.endsWith(suffix) &&
    typeof value === "string" &&
    value.trim().length > 0
  );
  return prefixed?.[1]?.trim() || "";
}

function normalizeSupabaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^[a-z0-9-]+\.supabase\.co$/i.test(trimmed)
      ? `https://${trimmed}`
      : `https://${trimmed.split("/")[0]}.supabase.co`;
  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(serverEnv("SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL || "");
const SUPABASE_KEY = serverEnv("SUPABASE_SECRET_KEY") || serverEnv("SUPABASE_SERVICE_ROLE_KEY");

async function db(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase environment variables are not configured.");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

export async function GET() {
  try {
    const r = await db("anime_projects?select=id,project_key,title,workflow_status,youtube_video_url,created_at,updated_at&order=updated_at.desc");
    if (!r.ok) throw new Error(await r.text());
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load projects." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = body?.project;
    if (!project?.title) return NextResponse.json({ error: "Project title is required." }, { status: 400 });
    const row = {
      project_key: String(project.projectKey || crypto.randomUUID()),
      title: String(project.title),
      story: String(project.story || ""),
      song: String(project.song || ""),
      blueprint: project.blueprint ?? null,
      character_bible: project.characterBible ?? null,
      character_refs: project.characterRefs ?? null,
      storyboard: project.storyboard ?? null,
      multi_shots: project.multiShots ?? null,
      motion: project.motion ?? null,
      timeline: project.timeline ?? null,
      auto_edit: project.autoEdit ?? null,
      youtube_package: project.youtubePackage ?? null,
      thumbnail: project.thumbnail ?? null,
      workflow_status: String(project.workflowStatus || "draft"),
      youtube_video_url: project.youtubeVideoUrl || null
    };
    const r = await db("anime_projects?on_conflict=project_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row)
    });
    if (!r.ok) throw new Error(await r.text());
    return NextResponse.json((await r.json())[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not save project." }, { status: 500 });
  }
}
