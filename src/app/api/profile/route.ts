import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/profile?username= — public profile or own profile
export async function GET(req: NextRequest) {
  const me = await getSession();
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || me.username;

  const user = await db.casinoUser.findFirst({
    where: { username },
    include: { wallet: true },
  });
  if (!user) return err("User not found", 404);

  // Aggregate bet stats
  const bets = await db.casinoBet.findMany({
    where: { userId: user.id },
    select: { amount: true, multiplier: true, payout: true, result: true, gameId: true, gameName: true, createdAt: true },
  });

  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter((b) => b.result === "win").reduce((s, b) => s + b.payout, 0);
  const wins = bets.filter((b) => b.result === "win").length;
  const losses = bets.filter((b) => b.result === "lose").length;
  const biggestWin = Math.max(0, ...bets.map((b) => b.payout));
  const winRate = bets.length > 0 ? (wins / bets.length) * 100 : 0;

  // Favorite game
  const gameCounts: Record<string, number> = {};
  for (const b of bets) gameCounts[b.gameName] = (gameCounts[b.gameName] || 0) + 1;
  const favoriteGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  // Cards count — CollectibleCard model removed
  const cardsCount = 0;
  const mythicCount = 0;

  // Recent bets (last 10)
  const recentBets = bets
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((b) => ({
      gameName: b.gameName,
      amount: b.amount,
      multiplier: b.multiplier,
      payout: b.payout,
      result: b.result,
      createdAt: b.createdAt.toISOString(),
    }));

  // Per-game win counts for game-specific achievements
  const gameWins: Record<string, number> = {};
  for (const b of bets) {
    if (b.result === "win") {
      gameWins[b.gameId] = (gameWins[b.gameId] || 0) + 1;
    }
  }

  // Compute biggest multiplier
  const biggestMultiplier = Math.max(0, ...bets.filter((b) => b.result === "win").map((b) => b.multiplier));

  // Achievements
  const achievements = computeAchievements({
    totalWagered,
    wins,
    losses,
    biggestWin,
    biggestMultiplier,
    cardsCount,
    mythicCount,
    betCount: bets.length,
    level: user.level,
    gameWins,
  });

  return ok({
    id: user.id,
    username: user.username,
    avatarColor: user.avatarColor,
    level: user.level,
    xp: user.xp,
    role: user.role,
    joinedAt: user.createdAt.toISOString(),
    isOwn: user.id === me.id,
    stats: {
      totalWagered,
      totalWon,
      netProfit: totalWon - totalWagered,
      wins,
      losses,
      winRate,
      biggestWin,
      betCount: bets.length,
      favoriteGame,
      cardsCount,
      mythicCount,
    },
    wallet: user.wallet ? {
      balance: user.wallet.balance,
      vipLevel: user.wallet.vipLevel,
    } : null,

    recentBets,
    achievements,
  });
}

function computeAchievements(s: {
  totalWagered: number; wins: number; losses: number; biggestWin: number; biggestMultiplier: number;
  cardsCount: number; mythicCount: number; betCount: number; level: number;
  gameWins: Record<string, number>;
}) {
  const all = [
    // General achievements
    { id: "first_bet", name: "First Bet", desc: "Place your first bet", icon: "🎲", unlocked: s.betCount >= 1, category: "General", progress: s.betCount, target: 1 },
    { id: "high_roller", name: "High Roller", desc: "Wager $1,000 total", icon: "💎", unlocked: s.totalWagered >= 1000, category: "General", progress: s.totalWagered, target: 1000 },
    { id: "whale", name: "Whale", desc: "Wager $10,000 total", icon: "🐋", unlocked: s.totalWagered >= 10000, category: "General", progress: s.totalWagered, target: 10000 },
    { id: "legend", name: "TOLS Legend", desc: "Wager $100,000 total", icon: "👑", unlocked: s.totalWagered >= 100000, category: "General", progress: s.totalWagered, target: 100000 },
    { id: "winner", name: "Winner", desc: "Win 10 bets", icon: "🏆", unlocked: s.wins >= 10, category: "General", progress: s.wins, target: 10 },
    { id: "streak", name: "Hot Streak", desc: "Win 50 bets", icon: "🔥", unlocked: s.wins >= 50, category: "General", progress: s.wins, target: 50 },
    { id: "big_win", name: "Big Win", desc: "Win $100 in a single bet", icon: "💰", unlocked: s.biggestWin >= 100, category: "General", progress: s.biggestWin, target: 100 },
    { id: "huge_win", name: "Huge Win", desc: "Win $1,000 in a single bet", icon: "⚡", unlocked: s.biggestWin >= 1000, category: "General", progress: s.biggestWin, target: 1000 },
    // Collection achievements
    { id: "collector", name: "Collector", desc: "Own 5 collectible cards", icon: "🃏", unlocked: s.cardsCount >= 5, category: "Collection", progress: s.cardsCount, target: 5 },
    { id: "mythic_pull", name: "Mythic Pull", desc: "Own a Mythic card", icon: "✨", unlocked: s.mythicCount >= 1, category: "Collection", progress: s.mythicCount, target: 1 },
    // Level achievements
    { id: "level_5", name: "Rising Star", desc: "Reach level 5", icon: "⭐", unlocked: s.level >= 5, category: "Progression", progress: s.level, target: 5 },
    { id: "level_10", name: "Veteran", desc: "Reach level 10", icon: "🎖️", unlocked: s.level >= 10, category: "Progression", progress: s.level, target: 10 },
    // Game-specific achievements
    { id: "dice_roller", name: "Dice Roller", desc: "Win 5 Dice bets", icon: "🎲", unlocked: (s.gameWins["dice"] || 0) >= 5, category: "Games", progress: s.gameWins["dice"] || 0, target: 5 },
    { id: "dice_master", name: "Dice Master", desc: "Win 20 Dice bets", icon: "🎯", unlocked: (s.gameWins["dice"] || 0) >= 20, category: "Games", progress: s.gameWins["dice"] || 0, target: 20 },
    { id: "crash_survivor", name: "Crash Survivor", desc: "Win 5 Crash bets", icon: "🚀", unlocked: (s.gameWins["crash"] || 0) >= 5, category: "Games", progress: s.gameWins["crash"] || 0, target: 5 },
    { id: "crash_master", name: "Crash Master", desc: "Win 20 Crash bets", icon: "💥", unlocked: (s.gameWins["crash"] || 0) >= 20, category: "Games", progress: s.gameWins["crash"] || 0, target: 20 },
    { id: "plinko_pro", name: "Plinko Pro", desc: "Win 5 Plinko bets", icon: "⚪", unlocked: (s.gameWins["plinko"] || 0) >= 5, category: "Games", progress: s.gameWins["plinko"] || 0, target: 5 },
    { id: "plinko_legend", name: "Plinko Legend", desc: "Win 20 Plinko bets", icon: "🔮", unlocked: (s.gameWins["plinko"] || 0) >= 20, category: "Games", progress: s.gameWins["plinko"] || 0, target: 20 },
    { id: "mine_sweeper", name: "Mine Sweeper", desc: "Win 5 Mines bets", icon: "💣", unlocked: (s.gameWins["mines"] || 0) >= 5, category: "Games", progress: s.gameWins["mines"] || 0, target: 5 },
    { id: "mine_master", name: "Mine Master", desc: "Win 20 Mines bets", icon: "🛡️", unlocked: (s.gameWins["mines"] || 0) >= 20, category: "Games", progress: s.gameWins["mines"] || 0, target: 20 },
    { id: "limbo_riser", name: "Limbo Riser", desc: "Win 5 Limbo bets", icon: "📈", unlocked: (s.gameWins["limbo"] || 0) >= 5, category: "Games", progress: s.gameWins["limbo"] || 0, target: 5 },
    { id: "coin_flipper", name: "Coin Flipper", desc: "Win 5 Coin Flip bets", icon: "🪙", unlocked: (s.gameWins["coinflip"] || 0) >= 5, category: "Games", progress: s.gameWins["coinflip"] || 0, target: 5 },
    { id: "wheel_spinner", name: "Wheel Spinner", desc: "Win 5 Wheel bets", icon: "🎡", unlocked: (s.gameWins["wheel"] || 0) >= 5, category: "Games", progress: s.gameWins["wheel"] || 0, target: 5 },
    // Multiplier achievements
    { id: "mult_10", name: "Multiplier Hunter", desc: "Hit a 10× multiplier", icon: "🎯", unlocked: s.biggestMultiplier >= 10, category: "Milestones", progress: s.biggestMultiplier, target: 10 },
    { id: "mult_50", name: "Multiplier Master", desc: "Hit a 50× multiplier", icon: "🔥", unlocked: s.biggestMultiplier >= 50, category: "Milestones", progress: s.biggestMultiplier, target: 50 },
    { id: "mult_100", name: "Multiplier God", desc: "Hit a 100× multiplier", icon: "⚡", unlocked: s.biggestMultiplier >= 100, category: "Milestones", progress: s.biggestMultiplier, target: 100 },
    { id: "mult_500", name: "Untouchable", desc: "Hit a 500× multiplier", icon: "🌟", unlocked: s.biggestMultiplier >= 500, category: "Milestones", progress: s.biggestMultiplier, target: 500 },
  ];
  return all;
}
