import { createHash, createHmac } from "crypto";
import { isPoolRushLevel, poolRushOutcome } from "@/lib/pool-rush";

// Recompute a Pool Rush result after the player rotates and reveals the seed.
// This endpoint never accepts a bet and never moves money.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const serverSeed = String(body?.serverSeed ?? "");
  const clientSeed = String(body?.clientSeed ?? "");
  const nonce = Number(body?.nonce);
  const level = body?.level;
  if (!serverSeed || !clientSeed || !Number.isInteger(nonce) || !isPoolRushLevel(level)) {
    return Response.json({ success: false, error: "serverSeed, clientSeed, integer nonce and valid level are required" }, { status: 400 });
  }

  const hmac = createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:0`)
    .digest("hex");
  const uniform = parseInt(hmac.slice(0, 13), 16) / 0x10000000000000;
  const outcome = poolRushOutcome(uniform, level);

  return Response.json({
    success: true,
    data: {
      serverSeedHash: createHash("sha256").update(serverSeed).digest("hex"),
      clientSeed,
      nonce,
      level,
      uniform,
      numBalls: outcome.balls,
      multiplier: outcome.multiplier,
    },
  });
}
