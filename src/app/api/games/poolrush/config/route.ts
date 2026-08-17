import {
  POOL_RUSH_CONFIG,
  POOL_RUSH_LEVELS,
  POOL_RUSH_MAX_BET,
  POOL_RUSH_MIN_BET,
  POOL_RUSH_RTP,
  poolRushHitFrequency,
  poolRushRtp,
} from "@/lib/pool-rush";

export async function GET() {
  return Response.json({
    success: true,
    data: {
      game: "poolrush",
      name: "Pool Rush — Fast Break",
      currency: "USDT",
      minBet: POOL_RUSH_MIN_BET,
      maxBet: POOL_RUSH_MAX_BET,
      rtp: POOL_RUSH_RTP,
      levels: POOL_RUSH_LEVELS.map((id) => ({
        id,
        label: POOL_RUSH_CONFIG[id].label,
        shot: POOL_RUSH_CONFIG[id].shot,
        power: POOL_RUSH_CONFIG[id].power,
        volatility: POOL_RUSH_CONFIG[id].volatility,
        hitFrequency: poolRushHitFrequency(id),
        maxMultiplier: POOL_RUSH_CONFIG[id].bands.at(-1)?.multiplier ?? 0,
        theoreticalRtp: poolRushRtp(id),
        paytable: POOL_RUSH_CONFIG[id].bands,
      })),
    },
  });
}
