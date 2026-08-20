/*
 * Monte Carlo simulator for Sicilian Scopa Fast Bet.
 *
 * Reuses the exact production engine (`src/lib/scopa.ts`) so the published
 * probabilities and payout table correspond 1:1 to what the server executes
 * on real bets.
 *
 * Run (Node >= 22.6 with type stripping — the engine is .ts, this entry is
 * plain JS so Node only needs to strip the engine):
 *   node --experimental-strip-types scripts/scopa-sim.mjs 1000000
 *
 * The first argument is the number of rounds (default 1,000,000). Output is a
 * human-readable table plus the JS constant to paste into SCOPA_ODDS.
 */

import { playScopaRound, resolveScopaMarket } from "../src/lib/scopa.ts";

// ── Fast, high-quality PRNG for simulation ───────────────────────────────
// The production engine reads from the HMAC-SHA256 fair stream; for Monte
// Carlo we only need statistically uniform shuffles, so a seeded SplitMix32
// is plenty. Every round gets its own independent seed.
function splitmix32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

const MARKETS = [
  "player",
  "bank",
  "draw",
  "over",
  "under",
  "seven_of_coins_player",
  "seven_of_coins_bank",
  "sweep_over",
];

const N = Number(process.argv[2] ?? 1_000_000);
if (!Number.isFinite(N) || N < 1) {
  console.error("Usage: node --experimental-strip-types scripts/scopa-sim.mjs [rounds]");
  process.exit(1);
}

const counts = {
  player: 0,
  bank: 0,
  draw: 0,
  over: 0,
  under: 0,
  seven_of_coins_player: 0,
  seven_of_coins_bank: 0,
  sweep_over: 0,
};

// Reference stats (not bet markets) for sanity checks.
let sumCards = 0;
let sumCoins = 0;
let sumPoints = 0;
let minMoves = null;
let maxMoves = null;
let sweepRounds = 0;

const t0 = Date.now();
for (let round = 1; round <= N; round++) {
  const prng = splitmix32((round * 0x9e3779b9) ^ 0x51ab3d21);
  const r = playScopaRound(() => prng());

  for (const m of MARKETS) if (resolveScopaMarket(m, r)) counts[m]++;

  // Invariant checks (cheap, always on).
  const cards = r.playerCards.length + r.bankCards.length;
  const coins = r.playerCoins + r.bankCoins;
  if (cards !== 40) throw new Error(`round ${round}: cards=${cards}`);
  if (coins !== 10) throw new Error(`round ${round}: coins=${coins}`);
  if (r.playerSevenOfCoins === r.bankSevenOfCoins) throw new Error(`round ${round}: sevenOfCoins not unique`);
  if (r.playerPoints + r.bankPoints !== r.totalPoints) throw new Error(`round ${round}: point mismatch`);
  sumCards += cards;
  sumCoins += coins;
  sumPoints += r.totalPoints;
  if (r.moves.some((m) => m.sweep)) sweepRounds++;
  if (minMoves === null || r.moves.length < minMoves) minMoves = r.moves.length;
  if (maxMoves === null || r.moves.length > maxMoves) maxMoves = r.moves.length;

  if (round % 500_000 === 0) {
    const rate = Math.round(round / ((Date.now() - t0) / 1000));
    console.error(`  …${round.toLocaleString()} rounds (${rate.toLocaleString()} r/s)`);
  }
}

const seconds = (Date.now() - t0) / 1000;
console.log(`\nRounds: ${N.toLocaleString()}  ·  ${seconds.toFixed(1)}s  ·  ${Math.round(N / seconds).toLocaleString()} rounds/s`);
console.log(`Sanity — avg cards/round ${(sumCards / N).toFixed(1)} (expect 40), avg coins ${(sumCoins / N).toFixed(1)} (expect 10), avg points ${(sumPoints / N).toFixed(3)}`);
console.log(`Rounds with leftover-table sweep: ${((sweepRounds / N) * 100).toFixed(1)}%  ·  moves/round ${minMoves}..${maxMoves}`);

// ── Probabilities + confidence intervals ────────────────────────────────
const Z = 1.959964; // 95%
const stats = {};
for (const m of MARKETS) {
  const k = counts[m];
  const p = k / N;
  const se = Math.sqrt((p * (1 - p)) / N);
  stats[m] = { count: k, p, se, lower: Math.max(0, p - Z * se), upper: Math.min(1, p + Z * se) };
}

const RTP = 0.96;
const floor2 = (x) => Math.floor(x * 100) / 100;

console.log("\n— Markets —");
console.log(
  ["market", "p", "SE", "p_lower", "p_upper", "odds_ub", "odds_lb", "RTP@ub"].map((s) => s.padEnd(18)).join("")
);
for (const m of MARKETS) {
  const s = stats[m];
  const oddsUb = floor2(RTP / s.upper);
  const oddsLb = floor2(RTP / s.lower);
  const rtpUb = s.upper * oddsUb;
  console.log(
    [
      m.padEnd(18),
      s.p.toFixed(5).padEnd(18),
      s.se.toFixed(6).padEnd(18),
      s.lower.toFixed(5).padEnd(18),
      s.upper.toFixed(5).padEnd(18),
      oddsUb.toFixed(2).padEnd(18),
      oddsLb.toFixed(2).padEnd(18),
      (rtpUb * 100).toFixed(2) + "%",
    ].join("")
  );
}

console.log("\n— SCOPA_ODDS constant (upper-bound, floored 2dp) —");
console.log("{\n" + MARKETS.map((m) => `  ${m}: ${floor2(RTP / stats[m].upper).toFixed(2)},`).join("\n") + "\n}");

// Cross-checks: complementary markets should sum to ~1.
console.log("\n— Complementary sums (sanity) —");
console.log(`1X2 : ${(stats.player.p + stats.bank.p + stats.draw.p).toFixed(5)} (expect 1)`);
console.log(`O/U : ${(stats.over.p + stats.under.p).toFixed(5)} (expect 1)`);
console.log(`Sett: ${(stats.seven_of_coins_player.p + stats.seven_of_coins_bank.p).toFixed(5)} (expect 1)`);
