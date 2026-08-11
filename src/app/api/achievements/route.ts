import { db } from "@/lib/db";
import { getSession, ok } from "@/lib/session";

// GET /api/achievements — returns current achievements + any newly unlocked since last check
export async function GET() {
  const user = await getSession();

  // Get current bet stats
  const bets = await db.casinoBet.findMany({
    where: { userId: user.id },
    select: { amount: true, multiplier: true, payout: true, result: true, gameName: true, gameId: true, createdAt: true },
  });

  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter((b) => b.result === "win").reduce((s, b) => s + b.payout, 0);
  const wins = bets.filter((b) => b.result === "win").length;
  const losses = bets.filter((b) => b.result === "lose").length;
  const biggestWin = Math.max(0, ...bets.map((b) => b.payout));
  const winRate = bets.length > 0 ? (wins / bets.length) * 100 : 0;

  const gameCounts: Record<string, number> = {};
  for (const b of bets) {
    if (b.result === "win") gameCounts[b.gameId] = (gameCounts[b.gameId] || 0) + 1;
  }

  const cardsCount = 0;
  const mythicCount = 0;

  // Compute all achievements
  const allAchievements = computeAchievements({
    totalWagered, wins, losses, biggestWin, cardsCount, mythicCount,
    betCount: bets.length, level: user.level, gameWins: gameCounts,
  });

  // Get previously seen achievements from PlatformSetting
  const seenSetting = await db.platformSetting.findUnique({
    where: { key: `seen-achievements-${user.id}` },
  });
  let seenIds: string[] = [];
  if (seenSetting) {
    try { seenIds = JSON.parse(seenSetting.value); } catch {}
  }

  // Find newly unlocked (unlocked now but not in seen list)
  const newlyUnlocked = allAchievements.filter(
    (a) => a.unlocked && !seenIds.includes(a.id)
  );

  // Update seen list to include all currently unlocked
  const allUnlockedIds = allAchievements.filter((a) => a.unlocked).map((a) => a.id);
  await db.platformSetting.upsert({
    where: { key: `seen-achievements-${user.id}` },
    update: { value: JSON.stringify(allUnlockedIds) },
    create: { key: `seen-achievements-${user.id}`, value: JSON.stringify(allUnlockedIds), category: "achievements" },
  });

  return ok({
    achievements: allAchievements,
    newlyUnlocked,
    totalUnlocked: allUnlockedIds.length,
    totalAchievements: allAchievements.length,
  });
}

function computeAchievements(s: {
  totalWagered: number; wins: number; losses: number; biggestWin: number;
  cardsCount: number; mythicCount: number; betCount: number; level: number;
  gameWins: Record<string, number>;
}) {
  return [
    { id: "first_bet", name: "First Bet", desc: "Place your first bet", icon: "🎲", unlocked: s.betCount >= 1, category: "General" },
    { id: "high_roller", name: "High Roller", desc: "Wager $1,000 total", icon: "💎", unlocked: s.totalWagered >= 1000, category: "General" },
    { id: "whale", name: "Whale", desc: "Wager $10,000 total", icon: "🐋", unlocked: s.totalWagered >= 10000, category: "General" },
    { id: "legend", name: "TOLS Legend", desc: "Wager $100,000 total", icon: "👑", unlocked: s.totalWagered >= 100000, category: "General" },
    { id: "winner", name: "Winner", desc: "Win 10 bets", icon: "🏆", unlocked: s.wins >= 10, category: "General" },
    { id: "streak", name: "Hot Streak", desc: "Win 50 bets", icon: "🔥", unlocked: s.wins >= 50, category: "General" },
    { id: "big_win", name: "Big Win", desc: "Win $100 in a single bet", icon: "💰", unlocked: s.biggestWin >= 100, category: "General" },
    { id: "huge_win", name: "Huge Win", desc: "Win $1,000 in a single bet", icon: "⚡", unlocked: s.biggestWin >= 1000, category: "General" },
    { id: "collector", name: "Collector", desc: "Own 5 collectible cards", icon: "🃏", unlocked: s.cardsCount >= 5, category: "Collection" },
    { id: "mythic_pull", name: "Mythic Pull", desc: "Own a Mythic card", icon: "✨", unlocked: s.mythicCount >= 1, category: "Collection" },
    { id: "level_5", name: "Rising Star", desc: "Reach level 5", icon: "⭐", unlocked: s.level >= 5, category: "Progression" },
    { id: "level_10", name: "Veteran", desc: "Reach level 10", icon: "🎖️", unlocked: s.level >= 10, category: "Progression" },
    { id: "dice_roller", name: "Dice Roller", desc: "Win 5 Dice bets", icon: "🎲", unlocked: (s.gameWins["dice"] || 0) >= 5, category: "Games" },
    { id: "dice_master", name: "Dice Master", desc: "Win 20 Dice bets", icon: "🎯", unlocked: (s.gameWins["dice"] || 0) >= 20, category: "Games" },
    { id: "crash_survivor", name: "Crash Survivor", desc: "Win 5 Crash bets", icon: "🚀", unlocked: (s.gameWins["crash"] || 0) >= 5, category: "Games" },
    { id: "crash_master", name: "Crash Master", desc: "Win 20 Crash bets", icon: "💥", unlocked: (s.gameWins["crash"] || 0) >= 20, category: "Games" },
    { id: "plinko_pro", name: "Plinko Pro", desc: "Win 5 Plinko bets", icon: "⚪", unlocked: (s.gameWins["plinko"] || 0) >= 5, category: "Games" },
    { id: "plinko_legend", name: "Plinko Legend", desc: "Win 20 Plinko bets", icon: "🔮", unlocked: (s.gameWins["plinko"] || 0) >= 20, category: "Games" },
    { id: "mine_sweeper", name: "Mine Sweeper", desc: "Win 5 Mines bets", icon: "💣", unlocked: (s.gameWins["mines"] || 0) >= 5, category: "Games" },
    { id: "mine_master", name: "Mine Master", desc: "Win 20 Mines bets", icon: "🛡️", unlocked: (s.gameWins["mines"] || 0) >= 20, category: "Games" },
    { id: "limbo_riser", name: "Limbo Riser", desc: "Win 5 Limbo bets", icon: "📈", unlocked: (s.gameWins["limbo"] || 0) >= 5, category: "Games" },
    { id: "coin_flipper", name: "Coin Flipper", desc: "Win 5 Coin Flip bets", icon: "🪙", unlocked: (s.gameWins["coinflip"] || 0) >= 5, category: "Games" },
    { id: "wheel_spinner", name: "Wheel Spinner", desc: "Win 5 Wheel bets", icon: "🎡", unlocked: (s.gameWins["wheel"] || 0) >= 5, category: "Games" },
  ];
}
