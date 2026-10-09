import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isZapierCatchHook(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "hooks.zapier.com" &&
      url.pathname.includes("/hooks/catch/");
  } catch {
    return false;
  }
}

export async function GET() {
  const storageReady = Boolean(
    normalizeSupabaseUrl(serverEnv("SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL || "") &&
    (serverEnv("SUPABASE_SECRET_KEY") || serverEnv("SUPABASE_SERVICE_ROLE_KEY"))
  );
  const webhookValid = isZapierCatchHook((process.env.ZAPIER_YOUTUBE_WEBHOOK_URL || "").trim());
  const missing: string[] = [];
  if (!storageReady) missing.push("supabase_storage");
  if (!webhookValid) missing.push("zapier_catch_hook");

  return NextResponse.json({
    storageReady,
    webhookValid,
    ready: storageReady && webhookValid,
    missing
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
