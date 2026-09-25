import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "status");
  const current = body?.status || "draft";
  const allowed: Record<string,string> = {
    submit: "review",
    approve: "approved",
    reject: "draft",
    publish: "published"
  };
  if (action === "status") return NextResponse.json({ status: current });
  const next = allowed[action];
  if (!next) return NextResponse.json({ error: "Unknown workflow action." }, { status: 400 });
  if (action === "publish" && current !== "approved") {
    return NextResponse.json({ error: "Episode must be approved before publishing." }, { status: 409 });
  }
  return NextResponse.json({ status: next, action, published: next === "published" });
}
