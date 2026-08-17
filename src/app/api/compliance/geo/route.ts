import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { assessVpn } from "@/lib/compliance";

/*
 * Response helpers are inlined rather than imported from @/lib/session on
 * purpose: that module imports the Prisma client at module scope, which would
 * drag a database connection into a route that touches no database — paying a
 * cold-start cost, and failing outright when the client isn't generated.
 * The shape matches lib/session's ok()/err() exactly.
 */
const ok = (data: unknown, status = 200) =>
  Response.json({ success: true, data }, { status });
const err = (message: string, status = 400) =>
  Response.json({ success: false, error: message }, { status });

/**
 * POST /api/compliance/geo — combine the edge's geo signals with the browser's
 * reported timezone to produce a VPN verdict.
 *
 * The timezone is supplied by the client, which means it is *self-reported and
 * therefore trivially spoofable*. That is acceptable precisely because this
 * endpoint can only ever downgrade a session to "suspected" — a soft flag for
 * KYC review. Anything that actually blocks (restricted jurisdiction) is
 * decided from the IP country, which the client cannot forge.
 */
export async function POST(req: NextRequest) {
  const limit = await checkRateLimit("compliance-geo", LIMITS.general);
  if (!limit.allowed) return err("Too many requests", 429);

  const body = await req.json().catch(() => null);
  const timezone = typeof body?.timezone === "string" ? body.timezone.slice(0, 64) : null;

  const h = await headers();
  const assessment = assessVpn({
    country: h.get("x-vercel-ip-country"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    edgeProxyFlag: false,
    clientTimezone: timezone,
  });

  // `reasons` stays server-side in the log rather than going to the client:
  // telling a user which signal tripped is a recipe for teaching them how to
  // evade it. The client only needs the verdict.
  if (assessment.verdict !== "clear") {
    console.warn("[compliance] geo assessment", {
      verdict: assessment.verdict,
      country: assessment.country,
      reasons: assessment.reasons,
    });
  }

  return ok({ verdict: assessment.verdict, country: assessment.country });
}
