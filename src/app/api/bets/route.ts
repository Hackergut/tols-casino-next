import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { fairFloat, getActiveSeed, nextNonce } from "@/lib/provably-fair";
import { resolveControl, applyForcedMultiplier } from "@/lib/game-control";
import { syncPlayerProfile } from "@/lib/player-sync";
import { syncTournamentProgress } from "@/lib/tournament-progress";
import {
  isPoolRushLevel,
  poolRushOutcome,
  POOL_RUSH_MAX_BET,
  POOL_RUSH_MIN_BET,
} from "@/lib/pool-rush";
import { after } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import {
  plinkoTable,
  kenoRow,
  wheelTable,
  shootBands,
  slotPaytable,
  slotProbs,
  minesMultiplier,
  chanceMultiplier,
  crashPointFrom,
  limboRollFrom,
  TARGET_RTP,
  PLINKO_ROWS,
  WHEEL_SEGMENTS,
  MINES_TILES,
  type Risk,
  type PlinkoRows,
  type WheelSegments,
  MAX_STAKE,
  normaliseTarget,
} from "@/lib/game-math";

const RISK_LEVELS: readonly string[] = ["low", "medium", "high"];

// Game engines — provably fair, calibrated to TARGET_RTP
type GameResult = { multiplier: number; payout: number; won: boolean; payload: Record<string, unknown> };

function rollDice(roll: number, target: number, isOver: boolean): boolean {
  return isOver ? roll > target : roll < target;
}

function poolRushError(code: "INVALID_BET" | "INVALID_LEVEL" | "INSUFFICIENT_BALANCE", message: string) {
  return Response.json({ success: false, error: message, code }, { status: 400 });
}

function crashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  // Curve lives in game-math so the bust band and the tail are derived from a
  // single HOUSE_EDGE. The previous version paired a hardcoded 2% bust with a
  // separate 0.99 factor, which double-counted the edge and made the real RTP
  // drift with the cash-out target instead of staying flat.
  return crashPointFrom(fairFloat(serverSeed, clientSeed, nonce));
}

/*
 * Plinko payouts are generated to an exact RTP, not typed by hand.
 *
 * The old hardcoded tables were badly wrong: 12-row medium returned 152.6% and
 * 12-row high returned 251.9% — the house paid out roughly 1.5x and 2.5x what
 * it took on every ball. Generating from a shape + a normaliser makes an
 * over-paying table impossible to express.
 */
function plinkoMultiplier(slot: number, risk: Risk, rows: number): number {
  const table = plinkoTable(rows as PlinkoRows, risk);
  return table[Math.max(0, Math.min(slot, table.length - 1))];
}

function plinkoSlot(serverSeed: string, clientSeed: string, nonce: number, rows: number): number {
  let pos = 0;
  for (let i = 0; i < rows; i++) {
    if (fairFloat(serverSeed, clientSeed, nonce, i) > 0.5) pos++;
  }
  return pos;
}

function minesLayout(serverSeed: string, clientSeed: string, nonce: number, mines: number, tiles = 25): boolean[] {
  // Returns 25-tile array, true = mine
  const arr = new Array(tiles).fill(false);
  const indices = Array.from({ length: tiles }, (_, i) => i);
  // deterministic shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(fairFloat(serverSeed, clientSeed, nonce, i) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let k = 0; k < mines; k++) arr[indices[k]] = true;
  return arr;
}

// Derived in game-math from the survival probability, so it is correct for
// every mines/picks pair rather than only the common ones.
function nextMineMultiplier(picks: number, mines: number, tiles = 25): number {
  return minesMultiplier(picks, mines, tiles);
}

// ── Slots (3 reels × 3 rows; centre row is the single payline) ──
// SYM1 is wild. RTP is controlled entirely on the server: the reel-strip
// weights and base paytable below are normalised so the expected multiplier
// equals SLOTS_RTP exactly. Symbols are ids 1..6 (SYM1..SYM6).
const SLOT_PAY = slotPaytable();
const SLOT_P = slotProbs();

/*
 * Keno paytable SHAPES by risk, indexed [picks][hits]. Grid is 1..40, 10 drawn.
 *
 * These numbers are shapes, not final payouts: only which hit counts pay, and
 * their size relative to each other, is meaningful here. The actual multipliers
 * are re-solved against the hypergeometric probabilities at the module's target
 * RTP (see KENO_TABLES below), so changing HOUSE_EDGE moves Keno with every
 * other game instead of leaving forty hand-typed rows behind at the old edge.
 *
 * Risk changes how the return is distributed (low pays often and small, high
 * pays rarely and huge), never the house edge.
 */
const KENO_SHAPES: Record<string, Record<number, number[]>> = {
  classic: {
    1: [0, 3.88],
    2: [0, 1.15, 9.17],
    3: [0, 0, 4.15, 33.19],
    4: [0, 0, 1.43, 11.47, 91.78],
    5: [0, 0, 0, 5.38, 43.01, 344.06],
    6: [0, 0, 0, 2.06, 16.46, 131.7, 1053.57],
    7: [0, 0, 0, 0, 8.24, 65.93, 527.48, 4219.82],
    8: [0, 0, 0, 0, 4.96, 27.8, 155.69, 871.87, 4882.49],
    9: [0, 0, 0, 0, 0, 24.31, 91.16, 341.86, 1281.97, 4807.41],
    10: [0, 0, 0, 0, 0, 13.6, 44.19, 143.63, 466.79, 1517.07, 4930.49]
  },
  low: {
    1: [0, 3.88],
    2: [0, 1.15, 9.17],
    3: [0, 0, 4.15, 33.19],
    4: [0, 0, 1.43, 11.47, 91.78],
    5: [0, 0, 0.56, 4.51, 36.07, 288.55],
    6: [0, 0, 0, 2.06, 16.46, 131.7, 1053.57],
    7: [0, 0, 0, 0.87, 6.94, 55.53, 444.25, 3554],
    8: [0, 0, 0, 0.67, 3.98, 23.65, 140.73, 837.37, 4982.35],
    9: [0, 0, 0, 0, 3.31, 14.25, 61.29, 263.56, 1133.3, 4873.17],
    10: [0, 0, 0, 0, 2.35, 8.34, 29.62, 105.17, 373.34, 1325.37, 4705.05]
  },
  medium: {
    1: [0, 3.88],
    2: [0, 0, 16.81],
    3: [0, 0, 4.15, 33.19],
    4: [0, 0, 0, 16.79, 134.32],
    5: [0, 0, 0, 5.38, 43.01, 344.06],
    6: [0, 0, 0, 0, 22.53, 180.23, 1441.8],
    7: [0, 0, 0, 0, 0, 115.9, 759.14, 4972.4],
    8: [0, 0, 0, 0, 0, 48.75, 226.68, 1054.06, 4901.37],
    9: [0, 0, 0, 0, 0, 0, 265.08, 702.46, 1861.51, 4932.99],
    10: [0, 0, 0, 0, 0, 0, 115.32, 294.08, 749.9, 1912.24, 4876.21]
  },
  high: {
    1: [0, 3.88],
    2: [0, 0, 16.81],
    3: [0, 0, 0, 79.86],
    4: [0, 0, 0, 16.79, 134.32],
    5: [0, 0, 0, 0, 76.75, 614.01],
    6: [0, 0, 0, 0, 0, 402.95, 3223.57],
    7: [0, 0, 0, 0, 0, 115.9, 759.14, 4972.4],
    8: [0, 0, 0, 0, 0, 0, 738.49, 1920.06, 4992.16],
    9: [0, 0, 0, 0, 0, 0, 265.08, 702.46, 1861.51, 4932.99],
    10: [0, 0, 0, 0, 0, 0, 0, 1592.8, 2309.56, 3348.86, 4855.85]
  },
};

// Re-solve every shape row against the real hypergeometric weights, so each
// (risk, picks) row returns exactly the target RTP.
const KENO_TABLES: Record<string, Record<number, number[]>> = Object.fromEntries(
  Object.entries(KENO_SHAPES).map(([risk, rows]) => [
    risk,
    Object.fromEntries(
      Object.entries(rows).map(([picks, shape]) => [picks, kenoRow(Number(picks), shape)]),
    ),
  ]),
);

function slotPick(u: number): number {
  let acc = 0;
  for (let i = 0; i < 6; i++) {
    acc += SLOT_P[i];
    if (u < acc) return i + 1;
  }
  return 6;
}

// POST /api/bets — place a bet on an Originals game
export async function POST(req: NextRequest) {
  const limited = await rateLimit("bet", LIMITS.bet);
  if (limited) return limited;

  // getSession() throws for a guest (no DEMO fallback in production); without
  // this guard an unauthenticated bet crashed the route with a bare 500
  // instead of a clean, expected 401.
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Sign in to play", 401);
  }
  if (!user.wallet) return err("No wallet", 400);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { game, amount, clientSeed, payload } = body as {
    game: string;
    amount: number;
    clientSeed?: string;
    payload?: Record<string, unknown>;
  };

  /*
   * Stake validation.
   *
   * `typeof amount !== "number"` does NOT reject NaN or Infinity, and every
   * subsequent comparison against them is false — so `amount <= 0` passed and
   * `wallet.balance < amount` passed, letting a NaN stake through to the
   * engine, where `amount * multiplier` produced a NaN payout and wrote NaN
   * into the wallet. Number.isFinite is the check that actually holds.
   *
   * The stake is also snapped to whole cents here rather than trusted raw: a
   * client sending 0.1+0.2 sends 0.30000000000000004, and money must never be
   * debited at sub-cent precision.
   */
  if (!game || typeof game !== "string") return err("Invalid bet", 400);
  if (typeof amount !== "number" || !Number.isFinite(amount)) return err("Invalid stake", 400);

  const stake = Math.round(amount * 100) / 100;
  if (stake < 0) return err("Invalid stake", 400);
  if (stake > MAX_STAKE) return err(`Maximum stake is ${MAX_STAKE}`, 400);
  if (game === "poolrush" && stake !== 0 && (stake < POOL_RUSH_MIN_BET || stake > POOL_RUSH_MAX_BET)) {
    return poolRushError("INVALID_BET", `Pool Rush stake must be between ${POOL_RUSH_MIN_BET} and ${POOL_RUSH_MAX_BET}`);
  }

  // Reload the wallet before deciding whether this is a paid round or practice.
  // Practice is deliberately available only when the wallet is actually empty:
  // a client with funds cannot send amount=0 to farm payable outcomes for free.
  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("No wallet", 400);
  const walletCents = Math.round(wallet.balance * 100);
  const practice = stake === 0 && walletCents <= 0;
  if (stake === 0 && !practice) return err("Invalid stake", 400);
  // Compare in cents. A float compare rejects a legitimate all-in when the
  // balance is 0.9999999999999999 after repeated fractional credits.
  if (!practice && walletCents < Math.round(stake * 100)) {
    return game === "poolrush"
      ? poolRushError("INSUFFICIENT_BALANCE", "Insufficient balance")
      : err("Insufficient balance", 400);
  }

  // Seeds come from the player's committed pair: the server seed is a CSPRNG
  // value whose SHA-256 was published before this bet, and the nonce advances
  // once per bet so the outcome is reproducible and cannot be replayed.
  const seedPair = await getActiveSeed(user.id);
  const nonce = await nextNonce(seedPair.id);
  const serverSeed = seedPair.serverSeed;
  const seed = clientSeed || seedPair.clientSeed;
  const hash = seedPair.serverSeedHash;

  let result: GameResult;

  switch (game) {
    case "dice": {
      const target = Number(payload?.target ?? 50);
      const isOver = Boolean(payload?.isOver ?? false);
      // An out-of-range target is not a playable bet: `roll > 100` or
      // `roll < 0` can never win, so accepting it would just take the stake.
      if (!Number.isFinite(target) || target <= 0 || target >= 100) return err("Invalid target", 400);
      const roll = Math.floor(fairFloat(serverSeed, seed, nonce) * 10000) / 100; // 0..100 (2dp)
      const won = rollDice(roll, target, isOver);
      const winChance = isOver ? 100 - target : target;
      // chanceMultiplier clamps the win chance itself rather than the payout.
      // The old Math.max(1.01, ...) floor silently pushed RTP above 100% at
      // extreme targets (target=99 under returned 99.99%). See MAX_WIN_CHANCE.
      const mult = won ? chanceMultiplier(winChance) : 0;
      result = { multiplier: mult, payout: stake * mult, won, payload: { roll, target, isOver } };
      break;
    }
    case "crash": {
      const cashOutAt = normaliseTarget(payload?.cashOutAt);
      if (cashOutAt === null) return err("Invalid cash-out target", 400);
      const point = crashPoint(serverSeed, seed, nonce);
      const won = point >= cashOutAt;
      const mult = won ? cashOutAt : 0;
      result = { multiplier: mult, payout: stake * mult, won, payload: { crashPoint: point, cashOutAt } };
      break;
    }
    case "limbo": {
      const target = normaliseTarget(payload?.target);
      if (target === null) return err("Invalid target multiplier", 400);
      // Same curve as crash, so both games share one derivation of the edge.
      const roll = limboRollFrom(fairFloat(serverSeed, seed, nonce));
      const won = roll >= target;
      result = { multiplier: won ? target : 0, payout: stake * (won ? target : 0), won, payload: { roll, target } };
      break;
    }
    case "coinflip": {
      const choice = payload?.choice === "tails" ? "tails" : "heads";
      const r = fairFloat(serverSeed, seed, nonce);
      const flip = r < 0.5 ? "heads" : "tails";
      const won = flip === choice;
      // 2 * TARGET_RTP — derived, so a change to HOUSE_EDGE moves every game
      // together instead of leaving a stray 1.98 behind.
      const cfMult = won ? 2 * TARGET_RTP : 0;
      result = { multiplier: cfMult, payout: stake * cfMult, won, payload: { flip, choice } };
      break;
    }
    case "plinko": {
      // Rows and risk index straight into the calibrated tables, so an
      // out-of-range value used to throw a bare 500 (or worse, pay from a
      // nonsense table). Reject with a clean 400 before anything moves.
      const riskRaw = String(payload?.risk ?? "medium");
      const rows = Number(payload?.rows ?? 12);
      if (!RISK_LEVELS.includes(riskRaw) || !(PLINKO_ROWS as readonly number[]).includes(rows)) {
        return err("Invalid plinko configuration", 400);
      }
      const risk = riskRaw as Risk;
      const slot = plinkoSlot(serverSeed, seed, nonce, rows);
      const mult = plinkoMultiplier(slot, risk, rows);
      const won = mult > 0;
      result = { multiplier: mult, payout: stake * mult, won, payload: { slot, risk, rows } };
      break;
    }
    case "mines": {
      const minesRaw = Number(payload?.mines ?? 3);
      const minesCount = Number.isFinite(minesRaw) ? Math.min(24, Math.max(1, Math.trunc(minesRaw))) : 3;
      /*
       * Picks decide the payout multiplier, so they must be real, distinct,
       * on-board tiles. Duplicates counted twice toward the multiplier —
       * [7,7,7,7,7] paid as five safe reveals from a single tile — and an
       * empty or oversized pick list was settled as a loss while still
       * charging the stake. Both are rejected before any debit now.
       */
      const rawPicks = Array.isArray(payload?.picks) ? (payload.picks as unknown[]) : [];
      const picks = [
        ...new Set(
          rawPicks.filter(
            (p): p is number => typeof p === "number" && Number.isInteger(p) && p >= 0 && p < MINES_TILES,
          ),
        ),
      ];
      if (picks.length < 1) return err("Pick at least one tile", 400);
      if (picks.length > MINES_TILES - minesCount) return err("More picks than safe tiles", 400);
      const layout = minesLayout(serverSeed, seed, nonce, minesCount);
      // check if any pick hit a mine
      const hitMine = picks.some((p) => layout[p]);
      const mult = hitMine ? 0 : nextMineMultiplier(picks.length, minesCount);
      const won = !hitMine && picks.length > 0;
      // The full layout is always returned: the round is over once the picks
      // are revealed, so every tile can be shown (and verified).
      result = { multiplier: mult, payout: stake * mult, won, payload: { mines: minesCount, picks, layout } };
      break;
    }
    case "wheel": {
      // Generated per (segments, risk) at exactly TARGET_RTP. The old hardcoded
      // tables returned 64% on low and 82% on high — risk was silently
      // changing the house edge instead of only the volatility.
      const segments = Number(payload?.segments ?? 20);
      const riskRaw = String(payload?.risk ?? "medium");
      // Both index the generated tables directly; out-of-range values used to
      // crash the route (negative Array length, undefined shape) with a 500.
      if (!(WHEEL_SEGMENTS as readonly number[]).includes(segments) || !RISK_LEVELS.includes(riskRaw)) {
        return err("Invalid wheel configuration", 400);
      }
      const table = wheelTable(segments as WheelSegments, riskRaw as Risk);
      const idx = Math.floor(fairFloat(serverSeed, seed, nonce) * table.length);
      const mult = table[idx % table.length] ?? 0;
      result = { multiplier: mult, payout: stake * mult, won: mult > 0, payload: { segment: idx, mult, risk: riskRaw, segments } };
      break;
    }
    case "keno": {
      // Player picks 1–10 numbers from 1..KENO_POOL; server draws KENO_DRAWN winners.
      //
      // Duplicates must be removed BEFORE scoring: hits are counted by
      // filtering the pick list against the draw, so a hand-rolled payload of
      // [5,5,5,5,5,5,5,5,5,5] scored 10 hits from a single drawn number and
      // paid the top row with a 25% chance. An empty pick list was likewise
      // settled as a loss while still charging the stake.
      const rawPicks = Array.isArray(payload?.picks) ? (payload!.picks as unknown[]) : [];
      const picks: number[] = [
        ...new Set(
          rawPicks.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 40),
        ),
      ].slice(0, 10);
      if (picks.length < 1) return err("Pick at least one number", 400);
      // Deterministic draw of 10 distinct numbers from the fair stream.
      const pool = Array.from({ length: 40 }, (_, i) => i + 1);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(fairFloat(serverSeed, seed + ":k" + i, nonce) * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const drawn = pool.slice(0, 10);
      const drawnSet = new Set(drawn);
      const hits = picks.filter((p) => drawnSet.has(p)).length;
      const risk = String(payload?.risk ?? "classic");
      const table = KENO_TABLES[risk] ?? KENO_TABLES.classic;
      const row = table[picks.length] ?? table[1];
      const mult = row[Math.min(hits, row.length - 1)] ?? 0;
      result = {
        multiplier: mult,
        payout: stake * mult,
        won: mult > 0,
        payload: { picks, drawn, hits, risk },
      };
      break;
    }
    case "shoot": {
      // Band multipliers are normalised to TARGET_RTP in game-math. The old bands
      // were hand-picked and summed to 141% RTP — every shot lost the house
      // money in expectation.
      const r = fairFloat(serverSeed, seed, nonce);
      const bands = shootBands();
      const band = bands.find((b) => r < b.cumulative) ?? bands[bands.length - 1];
      const mult = band.multiplier;
      result = {
        multiplier: mult,
        payout: stake * mult,
        won: mult > 0,
        payload: { roll: Math.floor(r * 10000) / 100, mult },
      };
      break;
    }
    case "poolrush": {
      const requestedLevel = payload?.level;
      if (!isPoolRushLevel(requestedLevel)) return poolRushError("INVALID_LEVEL", "Invalid Pool Rush level");
      const band = poolRushOutcome(fairFloat(serverSeed, seed, nonce), requestedLevel);
      const won = band.multiplier > 0;
      result = {
        multiplier: band.multiplier,
        payout: stake * band.multiplier,
        won,
        payload: {
          level: requestedLevel,
          balls: band.balls,
          shot: requestedLevel === "beginner" ? "centre" : requestedLevel === "intermediate" ? "full" : requestedLevel === "expert" ? "draw" : "jump",
        },
      };
      break;
    }
    case "roulette": {
      // European single-zero roulette (0..36). RTP is the real game math
      // (2.7% house edge) — 0 loses outside bets, straight pays 35:1 over 37
      // pockets → 97.3% return. No scaling needed; fully server-decided.
      /*
       * Every chip on the table is validated before settlement:
       *
       *  - a NEGATIVE bet amount used to pass the sum check (100 on red and
       *    −99 on black sums to the 1.00 stake) and then pay 200× the stake
       *    when red hit — the table paid out against money that was never
       *    wagered.
       *  - an unknown bet type lost to the default `win = false` branch but
       *    still contributed to the stake sum, and a malformed table was
       *    settled as a loss while charging the stake.
       *
       * All of it is rejected with 400 before anything is debited.
       */
      const ROULETTE_TYPES = new Set([
        "straight", "red", "black", "odd", "even", "low", "high",
        "dozen1", "dozen2", "dozen3", "col1", "col2", "col3",
      ]);
      const rawBets = Array.isArray(payload?.bets)
        ? (payload!.bets as Array<{ type?: unknown; value?: unknown; amount?: unknown }>)
        : [];
      const bets: Array<{ type: string; value?: number; amount: number }> = [];
      let invalid = rawBets.length === 0 || rawBets.length > 64;
      for (const b of rawBets) {
        const type = String(b?.type ?? "");
        const amt = Number(b?.amount);
        if (!ROULETTE_TYPES.has(type) || !Number.isFinite(amt) || amt <= 0) {
          invalid = true;
          break;
        }
        if (type === "straight") {
          const v = Number(b.value);
          if (!Number.isInteger(v) || v < 0 || v > 36) {
            invalid = true;
            break;
          }
          bets.push({ type, value: v, amount: Math.round(amt * 100) / 100 });
        } else {
          bets.push({ type, amount: Math.round(amt * 100) / 100 });
        }
      }
      const staked = Math.round(bets.reduce((s, b) => s + b.amount, 0) * 100) / 100;
      // Guard: the sum of individual bets must match the deducted amount.
      if (invalid || (!practice && Math.abs(staked - stake) > 0.005)) {
        return err("Invalid roulette bets", 400);
      }
      const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
      const winning = Math.floor(fairFloat(serverSeed, seed, nonce) * 37); // 0..36
      const isRed = winning !== 0 && RED.has(winning);
      let totalPayout = 0;
      for (const b of bets) {
        const amt = Number(b.amount) || 0;
        let win = false;
        let mult = 0;
        switch (String(b.type)) {
          case "straight": win = Number(b.value) === winning; mult = 36; break;
          case "red": win = isRed; mult = 2; break;
          case "black": win = winning !== 0 && !isRed; mult = 2; break;
          case "odd": win = winning !== 0 && winning % 2 === 1; mult = 2; break;
          case "even": win = winning !== 0 && winning % 2 === 0; mult = 2; break;
          case "low": win = winning >= 1 && winning <= 18; mult = 2; break;
          case "high": win = winning >= 19 && winning <= 36; mult = 2; break;
          case "dozen1": win = winning >= 1 && winning <= 12; mult = 3; break;
          case "dozen2": win = winning >= 13 && winning <= 24; mult = 3; break;
          case "dozen3": win = winning >= 25 && winning <= 36; mult = 3; break;
          case "col1": win = winning !== 0 && winning % 3 === 1; mult = 3; break;
          case "col2": win = winning !== 0 && winning % 3 === 2; mult = 3; break;
          case "col3": win = winning !== 0 && winning % 3 === 0; mult = 3; break;
        }
        if (win) totalPayout += amt * mult;
      }
      const mult = stake > 0 ? totalPayout / stake : 0;
      result = { multiplier: mult, payout: totalPayout, won: totalPayout > 0, payload: { winning, isRed, bets } };
      break;
    }
    case "slots": {
      // 3 reels × 3 rows. Centre row (index 1) is the payline; other rows are
      // cosmetic. All symbols drawn from the fair stream with server-controlled
      // weights, so RTP is fixed at SLOTS_RTP.
      const grid: number[][] = [];
      for (let r = 0; r < 3; r++) {
        const col: number[] = [];
        for (let row = 0; row < 3; row++) {
          col.push(slotPick(fairFloat(serverSeed, `${seed}:s${r}:${row}`, nonce)));
        }
        grid.push(col);
      }
      const line = [grid[0][1], grid[1][1], grid[2][1]];
      const nonWild = line.filter((s) => s !== 1);
      let mult = 0;
      let winSym = 0;
      if (nonWild.length === 0) {
        winSym = 1; // all wild
        mult = SLOT_PAY[0];
      } else if (new Set(nonWild).size === 1) {
        winSym = nonWild[0];
        mult = SLOT_PAY[winSym - 1];
      }
      // Rounded to 4dp, not 2: at 2dp the paytable lost ~0.02% of RTP because
      // every symbol's pay was truncated in the same direction.
      mult = Math.round(mult * 10000) / 10000;
      result = { multiplier: mult, payout: stake * mult, won: mult > 0, payload: { grid, line, winSym } };
      break;
    }
    default:
      return err("Unknown game: " + game, 400);
  }

  // An empty wallet may still play every Original in practice mode. The server
  // supplies the real provably-fair visual outcome, but no ledger row, jackpot,
  // house earning, debit or credit is created. `payout` is always zero: practice
  // can demonstrate a hit, never mint value.
  if (practice) {
    return ok({
      betId: null,
      game,
      amount: 0,
      multiplier: result.multiplier,
      payout: 0,
      won: result.won,
      practice: true,
      payload: result.payload,
      serverSeedHash: hash,
      clientSeed: seed,
      nonce,
      newBalance: wallet.balance,
      controlApplied: null,
    });
  }

  // ── Admin RTP / outcome control (internal prototype) ──
  // If a matching GameControl rule is active for this user/game, it can override
  // the fair result (force win/lose, bias RTP, or run a forced streak).
  const controlDecision = await resolveControl(user.id, game, {
    won: result.won,
    multiplier: result.multiplier,
  });
  let controlApplied: string | null = null;
  if (controlDecision.override) {
    const defaultWin: Record<string, number> = {
      dice: 1.98, crash: 2, limbo: 2, coinflip: 1.98, wheel: 2,
      mines: 2, plinko: 2, keno: 3, shoot: 2, poolrush: 3, slots: 6, roulette: 2,
    };
    const forcedMult = applyForcedMultiplier(controlDecision, result.multiplier, defaultWin[game] ?? 2);
    result = {
      multiplier: forcedMult,
      payout: stake * forcedMult,
      won: controlDecision.win,
      payload: { ...result.payload, _control: controlDecision.mode },
    };
    controlApplied = controlDecision.mode;
  }

  // Authoritative debit + credit in one transaction. The conditional
  // updateMany is the real balance guard: it only debits the stake when the
  // row still has balance >= amount, so two concurrent bets cannot both pass
  // a stale read and overdraw (the old code wrote an absolute newBalance from a
  // read taken before the transaction).
  const final = await db.$transaction(async (tx) => {
    const debited = await tx.casinoWallet.updateMany({
      where: { userId: user.id, balance: { gte: stake } },
      data: {
        balance: { decrement: stake },
        totalWagered: { increment: stake },
        xp: { increment: Math.floor(stake) },
      },
    });
    if (debited.count === 0) return { insufficient: true } as const;

    let balance: number;
    if (result.payout > 0) {
      const w = await tx.casinoWallet.update({
        where: { userId: user.id },
        data: {
          balance: { increment: result.payout },
          totalWon: result.won ? { increment: result.payout } : undefined,
        },
        select: { balance: true },
      });
      balance = w.balance;
    } else {
      const w = await tx.casinoWallet.findUnique({
        where: { userId: user.id },
        select: { balance: true },
      });
      balance = w?.balance ?? 0;
    }

    const bet = await tx.casinoBet.create({
      data: {
        userId: user.id,
        gameId: game,
        gameName: game.charAt(0).toUpperCase() + game.slice(1),
        gameCategory: "originals",
        amount: stake,
        multiplier: result.multiplier,
        payout: result.payout,
        result: result.won ? "win" : "lose",
        clientSeed: seed,
        serverSeedHash: hash,
        nonce,
        payload: JSON.stringify(result.payload),
      },
    });

    return { insufficient: false, balance, betId: bet.id } as const;
  });

  if ("insufficient" in final && final.insufficient) {
    return game === "poolrush"
      ? poolRushError("INSUFFICIENT_BALANCE", "Insufficient balance")
      : err("Insufficient balance", 400);
  }
  const newBalance = final.balance;
  const betId = final.betId;

  // Feed the jackpot 0.5% of stake (upsert so a fresh DB never fails a bet)
  await db.globalJackpot
    .upsert({
      where: { id: "global" },
      update: { amount: { increment: stake * 0.005 }, contributionsCount: { increment: 1 } },
      create: { id: "global", amount: 50000 + stake * 0.005, contributionsCount: 1 },
    })
    .catch(() => {});

  // House earning record
  await db.houseEarning.create({
    data: {
      gameId: game,
      gameName: game.charAt(0).toUpperCase() + game.slice(1),
      betId: betId,
      wager: stake,
      payout: result.payout,
      houseProfit: stake - result.payout,
      currency: "USDT",
    },
  });

  // Keep the wallet's VIP level + the operator projection in step with the
  // wager. `after()` runs this once the response is sent AND keeps the
  // serverless function alive to finish it — a plain fire-and-forget promise is
  // frozen/killed on Vercel, so the VIP level never updated.
  after(async () => {
    await Promise.all([
      syncPlayerProfile(user.id).catch(() => {}),
      syncTournamentProgress(user.id, game, stake, {
        won: result.won,
        payout: result.payout,
      }).catch(() => {}),
    ]);
  });

  return ok({
    betId: betId,
    game,
    // Echo the stake actually charged, not the raw request value. The client
    // computes profit as payout - stake, so returning an unrounded amount made
    // its P/L disagree with the wallet by fractions of a cent.
    amount: stake,
    multiplier: result.multiplier,
    payout: result.payout,
    won: result.won,
    payload: result.payload,
    serverSeedHash: hash,
    clientSeed: seed,
    nonce,
    newBalance,
    controlApplied,
  });
}

// GET /api/bets — recent bets (live feed)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
  const bets = await db.casinoBet.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true, avatarColor: true } } },
  });
  return ok(
    bets.map((b) => ({
      id: b.id,
      gameName: b.gameName,
      gameCategory: b.gameCategory,
      amount: b.amount,
      multiplier: b.multiplier,
      payout: b.payout,
      result: b.result,
      createdAt: b.createdAt.toISOString(),
      username: b.user?.username || "Player",
      avatarColor: b.user?.avatarColor || "#ccff00",
    }))
  );
}
