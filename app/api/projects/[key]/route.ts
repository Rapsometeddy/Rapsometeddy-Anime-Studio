import { NextResponse } from "next/server";

const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function db(path: string, init: RequestInit = {}) {
  if (!base || !key) throw new Error("Supabase environment variables are not configured.");
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
}
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: projectKey } = await params;
    const r = await db(`anime_projects?project_key=eq.${encodeURIComponent(projectKey)}&select=*&limit=1`);
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    if (!rows[0]) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load project." }, { status: 500 }); }
}
