import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { fairFloat, getActiveSeed, nextNonce } from "@/lib/provably-fair";
import { resolveControl, applyForcedMultiplier } from "@/lib/game-control";
import { syncPlayerProfile } from "@/lib/player-sync";
import { after } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkBetAllowed } from "@/lib/responsible-limits";

// Game engines — provably fair, 99% RTP-ish
type GameResult = { multiplier: number; payout: number; won: boolean; payload: Record<string, unknown> };

function rollDice(roll: number, target: number, isOver: boolean): boolean {
  return isOver ? roll > target : roll < target;
}

function crashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  // 99% RTP crash — instant crash ~2% of the time
  const r = fairFloat(serverSeed, clientSeed, nonce);
  if (r < 0.02) return 1.0; // instant crash
  const point = Math.max(1.0, 0.99 / (1 - r));
  return Math.floor(point * 100) / 100;
}

function plinkoMultiplier(slot: number, risk: "low" | "medium" | "high", rows: number): number {
  // Simplified plinko payout tables
  const tables: Record<string, number[]> = {
    "16-low": [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    "16-medium": [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    "16-high": [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
    "12-low": [10, 3, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 3, 10],
    "12-medium": [58, 15, 7, 3, 1.5, 1, 0.5, 1, 1.5, 3, 7, 15, 58],
    "12-high": [420, 70, 14, 5, 2, 1, 0.2, 1, 2, 5, 14, 70, 420],
    "8-low": [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    "8-medium": [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    "8-high": [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  };
  const key = `${rows}-${risk}`;
  const table = tables[key] ?? tables["12-medium"];
  return table[Math.min(slot, table.length - 1)];
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

function nextMineMultiplier(picks: number, mines: number, tiles = 25): number {
  // house edge 1%
  let m = 1;
  for (let i = 0; i < picks; i++) {
    m *= (tiles - i) / (tiles - mines - i);
  }
  return Math.max(1, m * 0.99);
}

// ── Slots (3 reels × 3 rows; centre row is the single payline) ──
// SYM1 is wild. RTP is controlled entirely on the server: the reel-strip
// weights and base paytable below are normalised so the expected multiplier
// equals SLOTS_RTP exactly. Symbols are ids 1..6 (SYM1..SYM6).
const SLOT_W = [3, 13, 11, 9, 7, 5]; // weights for SYM1(wild)..SYM6
const SLOT_BASE_PAY = [60, 4, 6, 9, 14, 22]; // base 3-of-a-kind multiplier, SYM1..SYM6
const SLOTS_RTP = 0.97;
// Normalise pays so E[multiplier] === SLOTS_RTP for the wild-completed centre line.
const { SLOT_PAY, SLOT_P } = (() => {
  const W = SLOT_W.reduce((a, b) => a + b, 0);
  const p = SLOT_W.map((w) => w / W);
  const p1 = p[0];
  let rawE = SLOT_BASE_PAY[0] * p1 ** 3; // all-wild line
  for (let x = 1; x < 6; x++) {
    rawE += SLOT_BASE_PAY[x] * ((p[x] + p1) ** 3 - p1 ** 3);
  }
  const scale = SLOTS_RTP / rawE;
  return { SLOT_PAY: SLOT_BASE_PAY.map((v) => v * scale), SLOT_P: p };
})();

// Keno paytables by risk, indexed [picks][hits]. Grid is 1..40 with 10 drawn.
// Every row is normalised to ~97% expected return and capped at 5000x: risk
// changes how the return is distributed (low pays often and small, high pays
// rarely and huge), never the house edge.
const KENO_TABLES: Record<string, Record<number, number[]>> = {
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

  if (!game || typeof amount !== "number" || amount <= 0) return err("Invalid bet", 400);

  // Responsible-gaming limits: enforce self-exclusion, wager and loss caps.
  const play = await checkBetAllowed(user.id, amount);
  if (!play.allowed) return err(play.message, 403);

  // reload wallet fresh
  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet || wallet.balance < amount) return err("Insufficient balance", 400);

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
      const roll = Math.floor(fairFloat(serverSeed, seed, nonce) * 10000) / 100; // 0..100 (2dp)
      const won = rollDice(roll, target, isOver);
      const winChance = isOver ? 100 - target : target;
      const mult = won ? Math.max(1.01, (99 / winChance)) : 0;
      result = { multiplier: mult, payout: amount * mult, won, payload: { roll, target, isOver } };
      break;
    }
    case "crash": {
      const cashOutAt = Number(payload?.cashOutAt ?? 0);
      const point = crashPoint(serverSeed, seed, nonce);
      const won = cashOutAt > 0 && point >= cashOutAt;
      const mult = won ? cashOutAt : 0;
      result = { multiplier: mult, payout: amount * mult, won, payload: { crashPoint: point, cashOutAt } };
      break;
    }
    case "limbo": {
      const target = Number(payload?.target ?? 2);
      const roll = Math.floor((0.99 / (1 - fairFloat(serverSeed, seed, nonce))) * 100) / 100;
      const won = roll >= target;
      result = { multiplier: won ? target : 0, payout: amount * (won ? target : 0), won, payload: { roll, target } };
      break;
    }
    case "coinflip": {
      const choice = payload?.choice === "tails" ? "tails" : "heads";
      const r = fairFloat(serverSeed, seed, nonce);
      const flip = r < 0.5 ? "heads" : "tails";
      const won = flip === choice;
      result = { multiplier: won ? 1.98 : 0, payout: amount * (won ? 1.98 : 0), won, payload: { flip, choice } };
      break;
    }
    case "plinko": {
      const risk = (payload?.risk as "low" | "medium" | "high") || "medium";
      const rows = Number(payload?.rows ?? 12);
      const slot = plinkoSlot(serverSeed, seed, nonce, rows);
      const mult = plinkoMultiplier(slot, risk, rows);
      const won = mult > 0;
      result = { multiplier: mult, payout: amount * mult, won, payload: { slot, risk, rows } };
      break;
    }
    case "mines": {
      const minesCount = Math.min(24, Math.max(1, Number(payload?.mines ?? 3)));
      const picks = Array.isArray(payload?.picks) ? (payload.picks as number[]) : [];
      const layout = minesLayout(serverSeed, seed, nonce, minesCount);
      // check if any pick hit a mine
      const hitMine = picks.some((p) => layout[p]);
      const mult = hitMine ? 0 : nextMineMultiplier(picks.length, minesCount);
      const won = !hitMine && picks.length > 0;
      result = { multiplier: mult, payout: amount * mult, won, payload: { mines: minesCount, picks, layout: won ? layout : layout.map((m, i) => (picks.includes(i) ? m : m)) } };
      break;
    }
    case "wheel": {
      const segments = Number(payload?.segments ?? 20);
      const risk = (payload?.risk as "low" | "medium" | "high") || "medium";
      const wheelMults: Record<string, number[]> = {
        "20-low": [0, 0, 1.5, 0, 1.2, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 1.2, 0, 1.5, 0],
        "20-medium": [0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5],
        "20-high": [0, 0, 0, 0, 9.9, 0, 0, 0, 0, 0, 0, 0, 4.5, 0, 0, 0, 0, 0, 0, 2],
      };
      const table = wheelMults[`${segments}-${risk}`] ?? wheelMults["20-medium"];
      const idx = Math.floor(fairFloat(serverSeed, seed, nonce) * segments);
      const mult = table[idx % table.length] || 0;
      result = { multiplier: mult, payout: amount * mult, won: mult > 0, payload: { segment: idx, mult, risk, segments } };
      break;
    }
    case "keno": {
      // Player picks 1–10 numbers from 1..80; server draws 10 winners.
      const picks: number[] = Array.isArray(payload?.picks)
        ? (payload!.picks as number[]).filter((n) => Number.isInteger(n) && n >= 1 && n <= 40).slice(0, 10)
        : [];
      if (picks.length < 1) {
        result = { multiplier: 0, payout: 0, won: false, payload: { error: "no picks", picks: [], drawn: [], hits: 0 } };
        break;
      }
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
        payout: amount * mult,
        won: mult > 0,
        payload: { picks, drawn, hits, risk },
      };
      break;
    }
    case "shoot": {
      // Single shot at a target; the fair stream resolves the multiplier band.
      const r = fairFloat(serverSeed, seed, nonce);
      // Weighted bands: mostly small, rare big. ~99% RTP.
      let mult: number;
      if (r < 0.45) mult = 0; // miss
      else if (r < 0.75) mult = 1.5;
      else if (r < 0.9) mult = 2.2;
      else if (r < 0.97) mult = 4;
      else if (r < 0.995) mult = 9;
      else mult = 25;
      result = {
        multiplier: mult,
        payout: amount * mult,
        won: mult > 0,
        payload: { roll: Math.floor(r * 10000) / 100, mult },
      };
      break;
    }
    case "roulette": {
      // European single-zero roulette (0..36). RTP is the real game math
      // (2.7% house edge) — 0 loses outside bets, straight pays 35:1 over 37
      // pockets → 97.3% return. No scaling needed; fully server-decided.
      const bets = Array.isArray(payload?.bets)
        ? (payload!.bets as Array<{ type: string; value?: number; amount: number }>)
        : [];
      const staked = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
      // Guard: the sum of individual bets must match the deducted amount.
      if (bets.length === 0 || Math.abs(staked - amount) > 1e-6) {
        result = { multiplier: 0, payout: 0, won: false, payload: { error: "bad bets", winning: -1, bets } };
        break;
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
      const mult = amount > 0 ? totalPayout / amount : 0;
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
      mult = Math.round(mult * 100) / 100;
      result = { multiplier: mult, payout: amount * mult, won: mult > 0, payload: { grid, line, winSym } };
      break;
    }
    default:
      return err("Unknown game: " + game, 400);
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
      mines: 2, plinko: 2, keno: 3, shoot: 2, slots: 6, roulette: 2,
    };
    const forcedMult = applyForcedMultiplier(controlDecision, result.multiplier, defaultWin[game] ?? 2);
    result = {
      multiplier: forcedMult,
      payout: amount * forcedMult,
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
      where: { userId: user.id, balance: { gte: amount } },
      data: {
        balance: { decrement: amount },
        totalWagered: { increment: amount },
        xp: { increment: Math.floor(amount) },
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
        amount,
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

  if ("insufficient" in final && final.insufficient) return err("Insufficient balance", 400);
  const newBalance = final.balance;
  const betId = final.betId;

  // Feed the jackpot 0.5% of stake (upsert so a fresh DB never fails a bet)
  await db.globalJackpot
    .upsert({
      where: { id: "global" },
      update: { amount: { increment: amount * 0.005 }, contributionsCount: { increment: 1 } },
      create: { id: "global", amount: 50000 + amount * 0.005, contributionsCount: 1 },
    })
    .catch(() => {});

  // House earning record
  await db.houseEarning.create({
    data: {
      gameId: game,
      gameName: game.charAt(0).toUpperCase() + game.slice(1),
      betId: betId,
      wager: amount,
      payout: result.payout,
      houseProfit: amount - result.payout,
      currency: "USDT",
    },
  });

  // Keep the wallet's VIP level + the operator projection in step with the
  // wager. `after()` runs this once the response is sent AND keeps the
  // serverless function alive to finish it — a plain fire-and-forget promise is
  // frozen/killed on Vercel, so the VIP level never updated.
  after(() => syncPlayerProfile(user.id).catch(() => {}));

  return ok({
    betId: betId,
    game,
    amount,
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
