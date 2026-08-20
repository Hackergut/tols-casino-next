import { db } from "@/lib/db";
import { playInstantBet, BetError } from "@/lib/settle-bet";
import { publish } from "@/lib/realtime";
import { getEngine } from "@/lib/game-engines";
import { DEFAULT_AUTO_BET, GAME_META } from "@/shared/constants";
import type { AutoBetParams, AutoBetStatus, AutoAdjustMode, OriginalGameId } from "@/shared/types";

function parseParams(raw: unknown): AutoBetParams {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AutoBetParams;
    } catch {
      throw new BetError("Corrupt auto-bet params", 500);
    }
  }
  return raw as AutoBetParams;
}

function nextStake(current: number, base: number, mode: AutoAdjustMode, percent: number): number {
  const p = Math.max(0, percent) / 100;
  switch (mode) {
    case "increase":
      return Math.max(0.01, Math.round(current * (1 + p) * 100) / 100);
    case "decrease":
      return Math.max(0.01, Math.round(current * Math.max(0.01, 1 - p) * 100) / 100);
    case "fixed":
      return current;
    case "reset":
    default:
      return base;
  }
}

export function normalizeParams(input: Partial<AutoBetParams> & { baseBet: number; gameParams?: Record<string, unknown> }): AutoBetParams {
  return {
    rounds: Math.max(1, Math.min(1000, Math.floor(Number(input.rounds ?? DEFAULT_AUTO_BET.rounds)))),
    baseBet: Math.max(0.01, Number(input.baseBet)),
    onWin: (input.onWin ?? DEFAULT_AUTO_BET.onWin) as AutoAdjustMode,
    onLoss: (input.onLoss ?? DEFAULT_AUTO_BET.onLoss) as AutoAdjustMode,
    onWinPercent: Math.max(0, Number(input.onWinPercent ?? DEFAULT_AUTO_BET.onWinPercent)),
    onLossPercent: Math.max(0, Number(input.onLossPercent ?? DEFAULT_AUTO_BET.onLossPercent)),
    stopLoss: Math.max(0, Number(input.stopLoss ?? DEFAULT_AUTO_BET.stopLoss)),
    takeProfit: Math.max(0, Number(input.takeProfit ?? DEFAULT_AUTO_BET.takeProfit)),
    gameParams: input.gameParams ?? {},
  };
}

interface StoredAutoBet {
  id: string;
  userId: string;
  gameId: string;
  params: AutoBetParams;
  status: AutoBetStatus["status"];
  roundsPlayed: number;
  currentBet: number;
  currentProfit: number;
  lastError: string;
  lastBetId: string;
}

function settingKey(userId: string, gameId: string) {
  return `autobet:${userId}:${gameId}`;
}

function toStatus(row: StoredAutoBet): AutoBetStatus {
  return {
    id: row.id,
    gameId: row.gameId,
    status: row.status,
    roundsPlayed: row.roundsPlayed,
    currentBet: row.currentBet,
    currentProfit: row.currentProfit,
    lastError: row.lastError,
    params: row.params,
  };
}

async function readSession(userId: string, gameId: string): Promise<StoredAutoBet | null> {
  const row = await db.platformSetting.findUnique({ where: { key: settingKey(userId, gameId) } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as StoredAutoBet;
  } catch {
    return null;
  }
}

async function writeSession(row: StoredAutoBet): Promise<StoredAutoBet> {
  await db.platformSetting.upsert({
    where: { key: settingKey(row.userId, row.gameId) },
    update: { value: JSON.stringify(row), category: "autobet" },
    create: {
      key: settingKey(row.userId, row.gameId),
      value: JSON.stringify(row),
      category: "autobet",
      description: "Active auto-bet session",
    },
  });
  return row;
}

export async function startAutoBet(opts: {
  userId: string;
  gameId: string;
  params: Partial<AutoBetParams> & { baseBet: number };
}): Promise<AutoBetStatus> {
  if (!getEngine(opts.gameId)) throw new BetError("Unknown game: " + opts.gameId, 400);

  const params = normalizeParams({
    ...opts.params,
    gameParams: opts.params.gameParams ?? GAME_META[opts.gameId as OriginalGameId]?.defaultParams ?? {},
  });

  const row = await writeSession({
    id: `ab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: opts.userId,
    gameId: opts.gameId,
    params,
    status: "running",
    roundsPlayed: 0,
    currentBet: params.baseBet,
    currentProfit: 0,
    lastError: "",
    lastBetId: "",
  });

  const status = toStatus(row);
  publish({ event: "auto-bet:status", userId: opts.userId, data: { ...status } });
  return status;
}

export async function stopAutoBet(userId: string, gameId: string): Promise<AutoBetStatus | null> {
  const row = await readSession(userId, gameId);
  if (!row || row.status !== "running") return row ? toStatus(row) : null;
  row.status = "stopped";
  await writeSession(row);
  const status = toStatus(row);
  publish({ event: "auto-bet:status", userId, data: { ...status } });
  return status;
}

export async function getAutoBetStatus(userId: string, gameId: string): Promise<AutoBetStatus | null> {
  const row = await readSession(userId, gameId);
  return row ? toStatus(row) : null;
}

export async function tickAutoBet(userId: string, gameId: string): Promise<{
  status: AutoBetStatus;
  bet: Awaited<ReturnType<typeof playInstantBet>> | null;
}> {
  const row = await readSession(userId, gameId);
  if (!row || row.status !== "running") throw new BetError("No running auto-bet", 404);

  const params = parseParams(row.params);
  if (row.roundsPlayed >= params.rounds) {
    row.status = "completed";
    await writeSession(row);
    return { status: toStatus(row), bet: null };
  }

  try {
    const gameParams: Record<string, unknown> = { ...params.gameParams, autoBetId: row.id };
    if (gameId === "roulette") {
      const raw = Array.isArray(gameParams.bets)
        ? (gameParams.bets as Array<{ type: string; value?: number; amount: number }>)
        : [];
      const staked = raw.reduce((s, b) => s + (Number(b.amount) || 0), 0);
      if (staked > 0) {
        const scale = row.currentBet / staked;
        let mapped = raw.map((b) => ({
          ...b,
          amount: Math.round(Number(b.amount) * scale * 100) / 100,
        }));
        const sum = mapped.reduce((s, b) => s + b.amount, 0);
        const drift = Math.round((row.currentBet - sum) * 100) / 100;
        if (mapped.length && drift !== 0) mapped[0] = { ...mapped[0], amount: mapped[0].amount + drift };
        gameParams.bets = mapped;
      } else {
        const kind = String(gameParams.color ?? "red");
        gameParams.bets = [{ type: kind === "black" ? "black" : "red", amount: row.currentBet }];
      }
    }
    if (gameId === "keno" && !Array.isArray(gameParams.picks)) {
      gameParams.picks = [1, 2, 3, 4, 5];
    }

    const bet = await playInstantBet({
      userId,
      game: gameId,
      amount: row.currentBet,
      payload: gameParams,
      autoBetId: row.id,
    });

    const profitDelta = bet.payout - bet.amount;
    row.currentProfit += profitDelta;
    row.currentBet = nextStake(
      row.currentBet,
      params.baseBet,
      bet.won ? params.onWin : params.onLoss,
      bet.won ? params.onWinPercent : params.onLossPercent,
    );
    row.roundsPlayed += 1;
    row.lastBetId = bet.betId;
    row.lastError = "";

    if (row.roundsPlayed >= params.rounds) row.status = "completed";
    if (params.stopLoss > 0 && row.currentProfit <= -params.stopLoss) row.status = "stopped";
    if (params.takeProfit > 0 && row.currentProfit >= params.takeProfit) row.status = "stopped";

    await writeSession(row);
    const out = toStatus(row);
    publish({ event: "auto-bet:status", userId, data: { ...out } });
    return { status: out, bet };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Auto-bet failed";
    row.status = "failed";
    row.lastError = message;
    await writeSession(row);
    const out = toStatus(row);
    publish({ event: "auto-bet:status", userId, data: { ...out } });
    publish({ event: "error", userId, data: { code: "AUTO_BET_FAILED", message } });
    throw e;
  }
}
