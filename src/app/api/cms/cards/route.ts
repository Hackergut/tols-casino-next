import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import type { CmsEntity, CmsCardOverride } from "@/lib/cms-cards";

/*
 * Card CMS API.
 *
 *   GET  /api/cms/cards            — public: enabled overrides (card content)
 *   GET  /api/cms/cards?all=1      — admin: every override incl. disabled
 *   PUT  /api/cms/cards            — admin: upsert one override (audited)
 *   DELETE /api/cms/cards          — admin: remove one override (audited)
 *
 * Public reads never leak disabled rows; admin writes always audit.
 */

const ENTITIES: CmsEntity[] = ["game", "promo"];

function rowToOverride(row: {
  entity: string; key: string; title: string | null; tagline: string | null; reward: string | null;
  badge: string | null; cta: string | null; target: string | null; accent: string | null;
  imageUrl: string | null; enabled: boolean; sortOrder: number; updatedAt: Date;
}): CmsCardOverride {
  return {
    entity: row.entity as CmsEntity,
    key: row.key,
    title: row.title,
    tagline: row.tagline,
    reward: row.reward,
    badge: row.badge,
    cta: row.cta,
    target: row.target,
    accent: row.accent,
    imageUrl: row.imageUrl,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  try {
    const rows = await db.cmsCard.findMany({
      where: all ? undefined : { enabled: true },
      orderBy: [{ entity: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ success: true, data: rows.map(rowToOverride) });
  } catch (error) {
    console.error("[cms] GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to load cards" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const session = gate.session;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const entity = String(body.entity ?? "");
  const key = String(body.key ?? "").trim();
  if (!ENTITIES.includes(entity as CmsEntity) || !key) {
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

  try {
    const row = await db.cmsCard.upsert({
      where: { entity_key: { entity, key } },
      create: { entity, key, ...data },
      update: data,
    });
    await auditLog(session, "cms.upsert", { entity, key, fields: Object.keys(data).filter((k) => data[k as keyof typeof data] != null) });
    return NextResponse.json({ success: true, data: rowToOverride(row) });
  } catch (error) {
    console.error("[cms] PUT error:", error);
    return NextResponse.json({ success: false, error: "Failed to save card" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const session = gate.session;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const entity = String(body.entity ?? "");
  const key = String(body.key ?? "").trim();
  if (!ENTITIES.includes(entity as CmsEntity) || !key) {
    return NextResponse.json({ success: false, error: "entity (game|promo) and key are required" }, { status: 400 });
  }

  try {
    await db.cmsCard.delete({ where: { entity_key: { entity, key } } });
    await auditLog(session, "cms.delete", { entity, key });
    return NextResponse.json({ success: true });
  } catch (error) {
    // Row may not exist — deleting an absent override is a no-op success.
    if (String(error).includes("RecordNotFound")) {
      return NextResponse.json({ success: true, data: null });
    }
    console.error("[cms] DELETE error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete card" }, { status: 500 });
  }
}
