export const LEADERBOARD_METRICS = ["wagered", "wins", "biggest_win", "profit", "high_roller"] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export interface LeaderboardBet {
  userId: string;
  amount: number;
  payout: number;
  multiplier: number;
  result: string;
  createdAt: Date;
  gameId?: string;
  user: {
    username: string;
    avatarColor: string;
    level: number;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarColor: string;
  level: number;
  wagered: number;
  wins: number;
  losses: number;
  biggestWin: number;
  biggestBet: number;
  bestMultiplier: number;
  totalWon: number;
  netProfit: number;
  betCount: number;
  winRate: number;
}

type MutableEntry = Omit<LeaderboardEntry, "rank" | "netProfit" | "winRate">;

export function aggregateLeaderboard(
  bets: LeaderboardBet[],
  metric: LeaderboardMetric,
  limit = 50,
): { leaderboard: LeaderboardEntry[]; total: number } {
  const stats = new Map<string, MutableEntry>();

  for (const bet of bets) {
    if (!bet.user || !Number.isFinite(bet.amount) || !Number.isFinite(bet.payout)) continue;
    let row = stats.get(bet.userId);
    if (!row) {
      row = {
        userId: bet.userId,
        username: bet.user.username,
        avatarColor: bet.user.avatarColor,
        level: bet.user.level,
        wagered: 0,
        wins: 0,
        losses: 0,
        biggestWin: 0,
        biggestBet: 0,
        bestMultiplier: 0,
        totalWon: 0,
        betCount: 0,
      };
      stats.set(bet.userId, row);
    }
    row.wagered += bet.amount;
    row.betCount += 1;
    row.biggestBet = Math.max(row.biggestBet, bet.amount);
    row.bestMultiplier = Math.max(row.bestMultiplier, bet.multiplier || 0);
    if (bet.result === "win") {
      row.wins += 1;
      row.totalWon += bet.payout;
      row.biggestWin = Math.max(row.biggestWin, bet.payout);
    } else {
      row.losses += 1;
    }
  }

  const value = (row: MutableEntry): number => {
    if (metric === "wins") return row.wins;
    if (metric === "biggest_win") return row.biggestWin;
    if (metric === "profit") return row.totalWon - row.wagered;
    if (metric === "high_roller") return row.biggestBet;
    return row.wagered;
  };

  const all = Array.from(stats.values()).sort((a, b) => {
    const delta = value(b) - value(a);
    return delta || b.wagered - a.wagered || a.username.localeCompare(b.username);
  });

  return {
    total: all.length,
    // Public routes clamp their requested output. Internal promotion ranking can
    // pass the full participant count so a viewer outside the top 100 still
    // receives an exact rank.
    leaderboard: all.slice(0, Math.max(1, Math.floor(limit))).map((row, index) => ({
      ...row,
      rank: index + 1,
      netProfit: row.totalWon - row.wagered,
      winRate: row.betCount ? (row.wins / row.betCount) * 100 : 0,
    })),
  };
}

export function periodStart(period: string, now = new Date()): Date | null {
  const start = new Date(now);
  if (period === "daily") {
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
  if (period === "weekly") {
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - day + 1);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
  if (period === "monthly") {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
  return null;
}

export function nextPeriodBoundary(period: "daily" | "weekly" | "monthly", now = new Date()): Date {
  const end = new Date(now);
  if (period === "daily") {
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    const day = end.getUTCDay() || 7;
    end.setUTCDate(end.getUTCDate() + (8 - day));
    end.setUTCHours(0, 0, 0, 0);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1, 1);
    end.setUTCHours(0, 0, 0, 0);
  }
  return end;
}
