import { fairFloat } from "@/lib/provably-fair";
import type { GameEngine, SettledOutcome } from "@/shared/types";
import { MIN_BET } from "@/shared/constants";
import { KENO_TABLES, PLINKO_TABLES, ROULETTE_RED, SLOT_P, SLOT_PAY, WHEEL_TABLES } from "./tables";

function okAmount(amount: number, balance: number) {
  if (!Number.isFinite(amount) || amount < MIN_BET) return { valid: false, error: "Invalid bet amount" };
  if (amount > balance) return { valid: false, error: "Insufficient balance" };
  return { valid: true };
}

function paid(amount: number, multiplier: number, payload: Record<string, unknown>): SettledOutcome {
  const payout = amount * multiplier;
  return { multiplier, payout, profit: payout - amount, won: multiplier > 0, payload };
}

export const diceEngine: GameEngine = {
  id: "dice",
  name: "Dice",
  kind: "instant",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const target = Number(params.target ?? 50);
    if (target < 2 || target > 98) return { valid: false, error: "Target must be between 2 and 98" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const roll = Math.min(99.99, Math.floor(fairFloat(serverSeed, clientSeed, nonce) * 10000) / 100);
    return { roll };
  },
  settleBet(bet, outcome) {
    const target = Number(bet.params.target ?? 50);
    const isOver = Boolean(bet.params.isOver ?? false);
    const roll = Number(outcome.roll);
    const won = isOver ? roll > target : roll < target;
    const winChance = isOver ? 100 - target : target;
    const multiplier = won ? Math.max(1.01, 99 / winChance) : 0;
    return paid(bet.amount, multiplier, { roll, target, isOver });
  },
};

export const limboEngine: GameEngine = {
  id: "limbo",
  name: "Limbo",
  kind: "instant",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const target = Number(params.target ?? 2);
    if (target < 1.01) return { valid: false, error: "Multiplier too low" };
    if (target > 1_000_000) return { valid: false, error: "Multiplier too high" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const roll = Math.min(1_000_000, Math.floor((0.99 / (1 - fairFloat(serverSeed, clientSeed, nonce))) * 100) / 100);
    return { roll };
  },
  settleBet(bet, outcome) {
    const target = Number(bet.params.target ?? 2);
    const roll = Number(outcome.roll);
    const won = roll >= target;
    return paid(bet.amount, won ? target : 0, { roll, target });
  },
};

export const coinflipEngine: GameEngine = {
  id: "coinflip",
  name: "Coinflip",
  kind: "instant",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const flip = fairFloat(serverSeed, clientSeed, nonce) < 0.5 ? "heads" : "tails";
    return { flip };
  },
  settleBet(bet, outcome) {
    const choice = bet.params.choice === "tails" ? "tails" : "heads";
    const flip = String(outcome.flip);
    const won = flip === choice;
    return paid(bet.amount, won ? 1.98 : 0, { flip, choice });
  },
};

export const plinkoEngine: GameEngine = {
  id: "plinko",
  name: "Plinko",
  kind: "instant",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const rows = Number(params.rows ?? 12);
    if (![8, 12, 16].includes(rows)) return { valid: false, error: "Rows must be 8, 12 or 16" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce, params) {
    const rows = Number(params.rows ?? 12);
    let pos = 0;
    for (let i = 0; i < rows; i++) {
      if (fairFloat(serverSeed, clientSeed, nonce, i) > 0.5) pos++;
    }
    return { slot: pos, rows };
  },
  settleBet(bet, outcome) {
    const risk = (bet.params.risk as string) || "medium";
    const rows = Number(outcome.rows ?? bet.params.rows ?? 12);
    const slot = Number(outcome.slot);
    const table = PLINKO_TABLES[`${rows}-${risk}`] ?? PLINKO_TABLES["12-medium"];
    const multiplier = table[Math.min(slot, table.length - 1)] ?? 0;
    return paid(bet.amount, multiplier, { slot, risk, rows });
  },
};

export const wheelEngine: GameEngine = {
  id: "wheel",
  name: "Wheel",
  kind: "instant",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce, params) {
    const segments = Number(params.segments ?? 20);
    const idx = Math.floor(fairFloat(serverSeed, clientSeed, nonce) * segments);
    return { segment: idx, segments };
  },
  settleBet(bet, outcome) {
    const segments = Number(outcome.segments ?? 20);
    const risk = (bet.params.risk as string) || "medium";
    const table = WHEEL_TABLES[`${segments}-${risk}`] ?? WHEEL_TABLES["20-medium"];
    const idx = Number(outcome.segment);
    const multiplier = table[idx % table.length] || 0;
    return paid(bet.amount, multiplier, { segment: idx, mult: multiplier, risk, segments });
  },
};

export const kenoEngine: GameEngine = {
  id: "keno",
  name: "Keno",
  kind: "instant",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const picks = Array.isArray(params.picks) ? params.picks : [];
    if (picks.length < 1) return { valid: false, error: "Pick at least one number" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(fairFloat(serverSeed, clientSeed + ":k" + i, nonce) * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { drawn: pool.slice(0, 10) };
  },
  settleBet(bet, outcome) {
    const picks: number[] = Array.isArray(bet.params.picks)
      ? (bet.params.picks as number[]).filter((n) => Number.isInteger(n) && n >= 1 && n <= 40).slice(0, 10)
      : [];
    const drawn = (outcome.drawn as number[]) ?? [];
    const drawnSet = new Set(drawn);
    const hits = picks.filter((p) => drawnSet.has(p)).length;
    const risk = String(bet.params.risk ?? "classic");
    const table = KENO_TABLES[risk] ?? KENO_TABLES.classic;
    const row = table[picks.length] ?? table[1];
    const multiplier = row[Math.min(hits, row.length - 1)] ?? 0;
    return paid(bet.amount, multiplier, { picks, drawn, hits, risk });
  },
};

export const shootEngine: GameEngine = {
  id: "shoot",
  name: "Target Shoot",
  kind: "instant",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    return { r: fairFloat(serverSeed, clientSeed, nonce) };
  },
  settleBet(bet, outcome) {
    const r = Number(outcome.r);
    let multiplier = 0;
    if (r < 0.45) multiplier = 0;
    else if (r < 0.75) multiplier = 1.5;
    else if (r < 0.9) multiplier = 2.2;
    else if (r < 0.97) multiplier = 4;
    else if (r < 0.995) multiplier = 9;
    else multiplier = 25;
    return paid(bet.amount, multiplier, { roll: Math.floor(r * 10000) / 100, mult: multiplier });
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

export const slotsEngine: GameEngine = {
  id: "slots",
  name: "Slots",
  kind: "instant",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const grid: number[][] = [];
    for (let r = 0; r < 3; r++) {
      const col: number[] = [];
      for (let row = 0; row < 3; row++) {
        col.push(slotPick(fairFloat(serverSeed, `${clientSeed}:s${r}:${row}`, nonce)));
      }
      grid.push(col);
    }
    return { grid };
  },
  settleBet(bet, outcome) {
    const grid = outcome.grid as number[][];
    const line = [grid[0][1], grid[1][1], grid[2][1]];
    const nonWild = line.filter((s) => s !== 1);
    let multiplier = 0;
    let winSym = 0;
    if (nonWild.length === 0) {
      winSym = 1;
      multiplier = SLOT_PAY[0];
    } else if (new Set(nonWild).size === 1) {
      winSym = nonWild[0];
      multiplier = SLOT_PAY[winSym - 1];
    }
    multiplier = Math.round(multiplier * 100) / 100;
    return paid(bet.amount, multiplier, { grid, line, winSym });
  },
};

export const rouletteEngine: GameEngine = {
  id: "roulette",
  name: "Roulette",
  kind: "instant",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const bets = Array.isArray(params.bets) ? (params.bets as Array<{ amount: number }>) : [];
    const staked = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    if (bets.length === 0) return { valid: false, error: "Place at least one chip" };
    if (Math.abs(staked - amount) > 1e-6) return { valid: false, error: "Bet total mismatch" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    return { winning: Math.floor(fairFloat(serverSeed, clientSeed, nonce) * 37) };
  },
  settleBet(bet, outcome) {
    const bets = Array.isArray(bet.params.bets)
      ? (bet.params.bets as Array<{ type: string; value?: number; amount: number }>)
      : [];
    const winning = Number(outcome.winning);
    const isRed = winning !== 0 && ROULETTE_RED.has(winning);
    let totalPayout = 0;
    for (const b of bets) {
      const amt = Number(b.amount) || 0;
      let win = false;
      let mult = 0;
      switch (String(b.type)) {
        case "straight":
          win = Number(b.value) === winning;
          mult = 36;
          break;
        case "red":
          win = isRed;
          mult = 2;
          break;
        case "black":
          win = winning !== 0 && !isRed;
          mult = 2;
          break;
        case "odd":
          win = winning !== 0 && winning % 2 === 1;
          mult = 2;
          break;
        case "even":
          win = winning !== 0 && winning % 2 === 0;
          mult = 2;
          break;
        case "low":
          win = winning >= 1 && winning <= 18;
          mult = 2;
          break;
        case "high":
          win = winning >= 19 && winning <= 36;
          mult = 2;
          break;
        case "dozen1":
          win = winning >= 1 && winning <= 12;
          mult = 3;
          break;
        case "dozen2":
          win = winning >= 13 && winning <= 24;
          mult = 3;
          break;
        case "dozen3":
          win = winning >= 25 && winning <= 36;
          mult = 3;
          break;
        case "col1":
          win = winning !== 0 && winning % 3 === 1;
          mult = 3;
          break;
        case "col2":
          win = winning !== 0 && winning % 3 === 2;
          mult = 3;
          break;
        case "col3":
          win = winning !== 0 && winning % 3 === 0;
          mult = 3;
          break;
      }
      if (win) totalPayout += amt * mult;
    }
    const multiplier = bet.amount > 0 ? totalPayout / bet.amount : 0;
    return {
      multiplier,
      payout: totalPayout,
      profit: totalPayout - bet.amount,
      won: totalPayout > 0,
      payload: { winning, isRed, bets },
    };
  },
};
