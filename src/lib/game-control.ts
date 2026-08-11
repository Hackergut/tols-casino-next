import { db } from "@/lib/db";

// ── RTP / outcome control ──────────────────────────────────────────────
// Resolves the most specific active GameControl for a (user, game) pair and
// decides whether to override the fair outcome. Precedence by specificity
// then priority: user_game > user > game > global.
//
// PRODUCTION GUARD: force_win, force_lose, and streak modes are rigging —
// they override the provably-fair result to predetermine wins or losses.
// These are DISABLED unless ALLOW_OUTCOME_CONTROL=true in the environment.
// The rtp mode (biasing the win rate up or down) is always available because
// it is a legitimate house-edge / RTP management tool.

export type ControlDecision =
  | { override: false }
  | { override: true; win: boolean; forcedMultiplier?: number; controlId: string; mode: string };

interface FairOutcome {
  won: boolean;
  multiplier: number;
}

/** True only when the operator has explicitly enabled outcome rigging. */
function outcomeRiggingAllowed(): boolean {
  return process.env.ALLOW_OUTCOME_CONTROL === "true" && process.env.NODE_ENV !== "production";
}

export async function resolveControl(userId: string, gameId: string, fair: FairOutcome): Promise<ControlDecision> {
  const controls = await db.gameControl.findMany({
    where: {
      enabled: true,
      OR: [
        { scope: "global" },
        { scope: "user", userId },
        { scope: "game", gameId },
        { scope: "user_game", userId, gameId },
      ],
    },
  });
  if (controls.length === 0) return { override: false };

  // Specificity rank, then priority, then most recent.
  const rank: Record<string, number> = { user_game: 3, user: 2, game: 1, global: 0 };
  controls.sort((a, b) => {
    const r = (rank[b.scope] ?? 0) - (rank[a.scope] ?? 0);
    if (r !== 0) return r;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const c = controls[0];

  switch (c.mode) {
    case "force_win": {
      if (!outcomeRiggingAllowed()) return { override: false };
      await bump(c.id);
      return { override: true, win: true, forcedMultiplier: c.forcedMultiplier ?? undefined, controlId: c.id, mode: c.mode };
    }

    case "force_lose": {
      if (!outcomeRiggingAllowed()) return { override: false };
      await bump(c.id);
      return { override: true, win: false, controlId: c.id, mode: c.mode };
    }

    case "rtp": {
      // Bias: nudge the win probability. rtpTarget > 1 heats (more wins),
      // < 1 cools (fewer wins). This is a legitimate RTP / house-edge lever.
      const t = Math.max(0, Math.min(2, c.rtpTarget));
      const roll = Math.random();
      let win = fair.won;
      if (fair.won && t < 1 && roll > t) win = false;   // cool down winners
      if (!fair.won && t > 1 && roll < t - 1) win = true; // heat up losers
      if (win === fair.won) return { override: false };
      await bump(c.id);
      return { override: true, win, forcedMultiplier: win ? c.forcedMultiplier ?? undefined : undefined, controlId: c.id, mode: c.mode };
    }

    case "streak": {
      if (!outcomeRiggingAllowed()) return { override: false };
      const cycle = Math.max(1, c.winStreak + c.loseStreak);
      const pos = c.streakPos % cycle;
      const win = pos < c.winStreak;
      await db.gameControl.update({
        where: { id: c.id },
        data: { streakPos: (c.streakPos + 1) % cycle, betsAffected: { increment: 1 } },
      });
      return { override: true, win, forcedMultiplier: win ? c.forcedMultiplier ?? undefined : undefined, controlId: c.id, mode: c.mode };
    }

    default:
      return { override: false };
  }
}

async function bump(id: string) {
  await db.gameControl.update({ where: { id }, data: { betsAffected: { increment: 1 } } }).catch(() => {});
}

export function applyForcedMultiplier(
  decision: Extract<ControlDecision, { override: true }>,
  fairMultiplier: number,
  defaultWinMultiplier: number
): number {
  if (!decision.win) return 0;
  if (decision.forcedMultiplier && decision.forcedMultiplier > 0) return decision.forcedMultiplier;
  if (fairMultiplier > 1) return fairMultiplier;
  return defaultWinMultiplier;
}