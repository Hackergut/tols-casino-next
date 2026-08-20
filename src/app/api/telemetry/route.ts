import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/telemetry — fire-and-forget product event collection.
// Public by design (events arrive before auth on the signup path); the rate
// limiter and per-event validation keep it from becoming a write amplifier.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("telemetry", LIMITS.telemetry);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const events = Array.isArray((body as { events?: unknown })?.events) ? (body as { events: unknown[] }).events : [];
  if (events.length === 0 || events.length > 50) {
    return NextResponse.json({ success: false, error: "events must be a non-empty array (max 50)" }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const authed = await getCurrentUser();
    userId = authed?.id ?? null;
  } catch {
    /* anonymous telemetry is fine */
  }

  const sessionId = typeof (body as { sessionId?: unknown }).sessionId === "string"
    ? ((body as { sessionId: string }).sessionId.slice(0, 64) || null)
    : null;

  const rows = events
    .map((raw): Prisma.TelemetryEventCreateManyInput | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const e = raw as { event?: unknown; props?: unknown };
      const name = typeof e.event === "string" ? e.event.trim().slice(0, 64) : "";
      if (!name) return null;
      const props = e.props !== undefined && typeof e.props === "object" && e.props !== null && !Array.isArray(e.props)
        ? (e.props as Record<string, unknown>)
        : undefined;
      if (props !== undefined && JSON.stringify(props).length > 8000) return null;
      return {
        event: name,
        userId,
        sessionId,
        // The body comes from `req.json()` (JSON.parse), so `props` can only
        // contain JSON values at runtime; the cast just tells Prisma that.
        props: props as Prisma.InputJsonValue | undefined,
        url: typeof (raw as { url?: unknown }).url === "string" ? ((raw as { url: string }).url.slice(0, 512) || null) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "No valid events" }, { status: 400 });
  }

  try {
    await db.telemetryEvent.createMany({ data: rows });
  } catch {
    // Collection is best-effort; never fail the player's request over it.
  }

  return NextResponse.json({ success: true, received: rows.length }, { status: 202 });
}
