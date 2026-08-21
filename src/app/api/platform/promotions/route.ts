import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  const rows = await db.cmsCard.findMany({ orderBy: [{ entity: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ success: true, data: rows });
}

export async function PUT(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "cms:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: cms:write" }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  const entity = String(body.entity ?? "");
  const key = String(body.key ?? "").trim();
  if ((entity !== "game" && entity !== "promo") || !key) {
    return NextResponse.json({ success: false, error: "entity (game|promo) and key are required" }, { status: 400 });
  }
  const str = (v: unknown, max = 200): string | null => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim().slice(0, max);
    return s || null;
  };
  const data = {
    title: str(body.title),
    tagline: str(body.tagline, 300),
    reward: str(body.reward),
    badge: str(body.badge),
    cta: str(body.cta),
    target: str(body.target),
    accent: str(body.accent, 64),
    imageUrl: str(body.imageUrl, 500),
    enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    sortOrder: Math.max(0, Math.floor(Number(body.sortOrder) || 0)),
  };
  const row = await db.cmsCard.upsert({
    where: { entity_key: { entity, key } },
    create: { entity, key, ...data },
    update: data,
  });
  return NextResponse.json({ success: true, data: row });
}

export async function OPTIONS() {
  return platformOptions();
}
