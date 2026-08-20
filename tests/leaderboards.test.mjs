import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadEngine() {
  const js = ts.transpileModule(read("src/lib/leaderboard-engine.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const common = { exports };
  new Function("module", "exports", js)(common, exports);
  return common.exports;
}

const { aggregateLeaderboard, periodStart, nextPeriodBoundary } = loadEngine();
const user = (username, level = 1) => ({ username, level, avatarColor: "#cdf32b" });
const bet = (userId, amount, payout, result = "lose", multiplier = 0) => ({
  userId, amount, payout, result, multiplier, gameId: "dice", createdAt: new Date("2026-08-17T10:00:00Z"), user: user(userId),
});

test("wager race aggregates every paid bet per player", () => {
  const result = aggregateLeaderboard([
    bet("alice", 10, 0), bet("alice", 20, 40, "win", 2), bet("bob", 25, 0),
  ], "wagered", 10);
  assert.equal(result.total, 2);
  assert.equal(result.leaderboard[0].username, "alice");
  assert.equal(result.leaderboard[0].wagered, 30);
  assert.equal(result.leaderboard[0].wins, 1);
  assert.equal(result.leaderboard[0].netProfit, 10);
});

test("high roller ranks the largest single stake, not cumulative volume", () => {
  const result = aggregateLeaderboard([
    bet("volume", 60, 0), bet("volume", 60, 0), bet("whale", 100, 0),
  ], "high_roller", 10);
  assert.equal(result.leaderboard[0].username, "whale");
  assert.equal(result.leaderboard[0].biggestBet, 100);
});

test("profit, wins and biggest payout use their own scores", () => {
  const rows = [bet("lucky", 10, 100, "win", 10), bet("steady", 5, 8, "win", 1.6), bet("steady", 5, 8, "win", 1.6)];
  assert.equal(aggregateLeaderboard(rows, "profit", 10).leaderboard[0].username, "lucky");
  assert.equal(aggregateLeaderboard(rows, "wins", 10).leaderboard[0].username, "steady");
  assert.equal(aggregateLeaderboard(rows, "biggest_win", 10).leaderboard[0].username, "lucky");
});

test("pushes return stake without becoming losses or fake negative profit", () => {
  const row = aggregateLeaderboard([bet("pat", 25, 25, "push", 1)], "profit", 10).leaderboard[0];
  assert.equal(row.pushes, 1);
  assert.equal(row.losses, 0);
  assert.equal(row.netProfit, 0);
  assert.equal(row.winRate, 0);
});

test("player cards use the most-played game as their artwork", () => {
  const rows = [
    { ...bet("alice", 5, 0), gameId: "blackjack" },
    { ...bet("alice", 5, 0), gameId: "blackjack" },
    { ...bet("alice", 5, 0), gameId: "dice" },
  ];
  assert.equal(aggregateLeaderboard(rows, "wagered", 10).leaderboard[0].favoriteGame, "blackjack");
});

test("period windows align to UTC promotion boundaries", () => {
  const now = new Date("2026-08-19T15:42:00Z"); // Wednesday
  assert.equal(periodStart("daily", now).toISOString(), "2026-08-19T00:00:00.000Z");
  assert.equal(periodStart("weekly", now).toISOString(), "2026-08-17T00:00:00.000Z");
  assert.equal(periodStart("monthly", now).toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(nextPeriodBoundary("weekly", now).toISOString(), "2026-08-24T00:00:00.000Z");
});

test("practice bets are excluded at both leaderboard API query boundaries", () => {
  const globalRoute = read("src/app/api/leaderboard/route.ts");
  const overviewRoute = read("src/app/api/leaderboards/overview/route.ts");
  assert.match(globalRoute, /amount: \{ gt: 0 \}/);
  assert.match(overviewRoute, /amount: \{ gt: 0 \}/);
  assert.match(globalRoute, /result: \{ in: \["win", "lose", "push"\] \}/);
  assert.match(overviewRoute, /result: \{ in: \["win", "lose", "push"\] \}/);
});

test("settled paid bets project into joined tournament leaderboards", () => {
  const betRoute = read("src/app/api/bets/route.ts");
  const sync = read("src/lib/tournament-progress.ts");
  assert.match(betRoute, /syncTournamentProgress\(user\.id, game, stake/);
  assert.match(sync, /wagered: \{ increment: stake \}/);
  assert.match(sync, /wins: result\.won \? \{ increment: 1 \}/);
  assert.match(sync, /status: "active"/);

  const blackjackBet = read("src/app/api/blackjack/bet/route.ts");
  const blackjackAction = read("src/app/api/blackjack/action/route.ts");
  assert.match(blackjackBet, /syncTournamentProgress\(user\.id, "blackjack", amount/);
  assert.match(blackjackAction, /syncTournamentProgress\(user\.id, "blackjack", totalAmount/);
});
