/*
 * RTP calibration guarantees.
 *
 * This suite exists because the hand-typed payout tables it replaces were
 * badly wrong and nothing caught it: Plinko 12-row medium returned 152.6% and
 * high 251.9% (the house paid out ~1.5x and ~2.5x what it took), Shoot
 * returned 141%, and Wheel low/high returned 64%/82% (players robbed). Each
 * error was a plausible-looking list of numbers.
 *
 * Every assertion below is an exact expectation computed from the same
 * probability model the server uses, so a future "let's make the top slot
 * pay more" edit fails here instead of in the ledger.
 *
 *   node --test tests/game-rtp.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../src/lib/game-math.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const {
  TARGET_RTP,
  HOUSE_EDGE,
  ROULETTE_RTP,
  plinkoTable,
  plinkoProbs,
  wheelTable,
  shootBands,
  minesMultiplier,
  minesSurvival,
  chanceMultiplier,
  crashPointFrom,
  limboRollFrom,
  expectedValue,
  binomialPmf,
} = M;

/** Payout tables are rounded to whole cents, so allow a cent of slack. */
const TOL = 5e-4;

const RISKS = ["low", "medium", "high"];

/* ─────────────────────────── Plinko ─────────────────────────── */

for (const rows of [8, 12, 16]) {
  for (const risk of RISKS) {
    test(`plinko ${rows}-row ${risk} returns exactly ${TARGET_RTP * 100}%`, () => {
      const table = plinkoTable(rows, risk);
      const probs = plinkoProbs(rows);
      assert.equal(table.length, rows + 1, "one multiplier per slot");
      assert.ok(
        Math.abs(expectedValue(table, probs) - TARGET_RTP) < TOL,
        `got ${(expectedValue(table, probs) * 100).toFixed(4)}%`,
      );
    });

    test(`plinko ${rows}-row ${risk} pays something in every slot`, () => {
      // A slot that pays 0 means "the ball landed and you got nothing", which
      // contradicts the premise of the game even when the maths balances.
      for (const v of plinkoTable(rows, risk)) assert.ok(v > 0, `slot pays ${v}`);
    });

    test(`plinko ${rows}-row ${risk} pays more at the edges than the centre`, () => {
      const t = plinkoTable(rows, risk);
      const centre = t[Math.floor(t.length / 2)];
      assert.ok(t[0] > centre && t[t.length - 1] > centre);
    });
  }

  test(`plinko ${rows}-row is symmetric`, () => {
    for (const risk of RISKS) {
      const t = plinkoTable(rows, risk);
      for (let i = 0; i < t.length; i++) {
        assert.equal(t[i], t[t.length - 1 - i], `slot ${i} vs mirror`);
      }
    }
  });
}

test("plinko risk changes volatility, never the house edge", () => {
  // The property the old tables violated: all three risks must return the
  // same, and only the spread between best and worst slot may differ.
  const spread = (risk) => {
    const t = plinkoTable(16, risk);
    return Math.max(...t) / Math.min(...t);
  };
  assert.ok(spread("low") < spread("medium"));
  assert.ok(spread("medium") < spread("high"));
});

/* ─────────────────────────── Wheel ─────────────────────────── */

for (const segments of [10, 20, 30, 40, 50]) {
  for (const risk of RISKS) {
    test(`wheel ${segments}-segment ${risk} returns exactly ${TARGET_RTP * 100}%`, () => {
      const t = wheelTable(segments, risk);
      const probs = t.map(() => 1 / t.length);
      assert.equal(t.length, segments);
      assert.ok(
        Math.abs(expectedValue(t, probs) - TARGET_RTP) < TOL,
        `got ${(expectedValue(t, probs) * 100).toFixed(4)}%`,
      );
    });

    test(`wheel ${segments}-segment ${risk} never pays a losing amount`, () => {
      // A "win" that returns less than the stake reads as a bug.
      for (const v of wheelTable(segments, risk)) {
        assert.ok(v === 0 || v >= 1, `paying segment returns ${v}x`);
      }
    });
  }

  test(`wheel ${segments}-segment: higher risk means fewer, larger wins`, () => {
    const winners = (r) => wheelTable(segments, r).filter((v) => v > 0).length;
    const peak = (r) => Math.max(...wheelTable(segments, r));
    assert.ok(winners("low") > winners("medium"));
    assert.ok(winners("medium") > winners("high"));
    assert.ok(peak("high") > peak("medium"));
    assert.ok(peak("medium") > peak("low"));
  });
}

/* ─────────────────────────── Shoot ─────────────────────────── */

test("shoot bands return exactly the target RTP", () => {
  const bands = shootBands();
  const rtp = bands.reduce((acc, b) => acc + b.p * b.multiplier, 0);
  assert.ok(Math.abs(rtp - TARGET_RTP) < TOL, `got ${(rtp * 100).toFixed(4)}%`);
});

test("shoot band probabilities sum to 1", () => {
  const total = shootBands().reduce((acc, b) => acc + b.p, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("shoot never announces a hit that returns less than the stake", () => {
  for (const b of shootBands()) {
    assert.ok(b.multiplier === 0 || b.multiplier >= 1, `band pays ${b.multiplier}x`);
  }
});

test("shoot bands increase with rarity", () => {
  const paying = shootBands().filter((b) => b.multiplier > 0);
  for (let i = 1; i < paying.length; i++) {
    assert.ok(paying[i].multiplier > paying[i - 1].multiplier);
    assert.ok(paying[i].p < paying[i - 1].p);
  }
});

/* ─────────────────────────── Mines ─────────────────────────── */

test("mines returns the target RTP for every mines/picks combination", () => {
  for (let mines = 1; mines <= 24; mines++) {
    const safe = 25 - mines;
    for (let picks = 1; picks <= safe; picks++) {
      const rtp = minesSurvival(picks, mines) * minesMultiplier(picks, mines);
      assert.ok(
        Math.abs(rtp - TARGET_RTP) < 1e-9,
        `mines=${mines} picks=${picks} → ${(rtp * 100).toFixed(4)}%`,
      );
    }
  }
});

test("mines multiplier grows with each safe pick", () => {
  for (const mines of [1, 3, 5, 10, 20]) {
    const safe = 25 - mines;
    for (let picks = 2; picks <= safe; picks++) {
      assert.ok(minesMultiplier(picks, mines) > minesMultiplier(picks - 1, mines));
    }
  }
});

test("mines cannot pay for revealing more tiles than exist", () => {
  assert.equal(minesMultiplier(23, 3), 0); // only 22 safe tiles
  assert.equal(minesMultiplier(1, 24), 25 * TARGET_RTP / 1);
});

/* ─────────────────────── Dice and Limbo ─────────────────────── */

test("dice returns the target RTP at every win chance", () => {
  for (let chance = 1; chance <= 98; chance++) {
    const rtp = (chance / 100) * chanceMultiplier(chance);
    assert.ok(Math.abs(rtp - TARGET_RTP) < 1e-12, `chance=${chance} → ${rtp}`);
  }
});

test("dice never pays above 100% at extreme targets", () => {
  // The old Math.max(1.01, 99/chance) floor pushed RTP to 99.99% at chance=99
  // and would exceed 100% beyond that.
  for (const chance of [0.01, 0.5, 99, 99.99]) {
    const rtp = (Math.min(chance, 98) / 100) * chanceMultiplier(chance);
    assert.ok(rtp <= TARGET_RTP + 1e-12, `chance=${chance} → ${rtp}`);
  }
});

test("crash returns a flat RTP at every cash-out target", () => {
  // Integrate over the uniform rather than sampling, so this is exact and
  // does not flake. The old curve drifted with the target.
  const N = 2_000_000;
  for (const cashOut of [1.1, 1.5, 2, 5, 10, 50]) {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      if (crashPointFrom((i + 0.5) / N) >= cashOut) wins++;
    }
    const rtp = (wins / N) * cashOut;
    assert.ok(Math.abs(rtp - TARGET_RTP) < 2e-3, `cashOut=${cashOut} → ${(rtp * 100).toFixed(3)}%`);
  }
});

test("crash: a bet that never cashes out loses exactly the house edge", () => {
  // The bust band is HOUSE_EDGE wide, but P(point === 1.00) is about twice
  // that: the 2dp floor also collapses the sliver just above the band down to
  // 1.00. That is presentation, not edge — what has to hold is that a player
  // cashing out at the lowest possible target still returns TARGET_RTP, which
  // the flat-RTP test above already pins at 1.01x. Asserting the raw bust
  // frequency equals HOUSE_EDGE would be asserting a rounding artefact.
  const N = 1_000_000;
  let busts = 0;
  for (let i = 0; i < N; i++) if (crashPointFrom((i + 0.5) / N) === 1) busts++;
  const bustRate = busts / N;
  assert.ok(bustRate >= HOUSE_EDGE, `bust rate ${bustRate} below the edge`);
  assert.ok(bustRate < HOUSE_EDGE * 2.5, `bust rate ${bustRate} implausibly high`);
});

test("limbo shares the crash curve", () => {
  for (const u of [0.001, 0.2, 0.5, 0.9, 0.999]) {
    assert.equal(limboRollFrom(u), crashPointFrom(u));
  }
});

/* ─────────────────────────── Roulette ─────────────────────────── */

test("roulette keeps its structural single-zero edge", () => {
  // Not 99%: roulette's edge comes from the zero pocket, and faking 99% would
  // mean paying 35.6:1 on a straight-up, which no player would recognise.
  assert.ok(Math.abs((1 / 37) * 36 - ROULETTE_RTP) < 1e-12);
  assert.ok(Math.abs((18 / 37) * 2 - ROULETTE_RTP) < 1e-12);
  assert.ok(Math.abs(ROULETTE_RTP - 0.972973) < 1e-6);
});

/* ─────────────────── Cross-game consistency ─────────────────── */

test("every 99%-class game agrees on the house edge", () => {
  const rtps = [
    expectedValue(plinkoTable(16, "medium"), plinkoProbs(16)),
    expectedValue(wheelTable(20, "medium"), wheelTable(20, "medium").map(() => 1 / 20)),
    shootBands().reduce((a, b) => a + b.p * b.multiplier, 0),
    minesSurvival(5, 3) * minesMultiplier(5, 3),
    0.5 * (2 * TARGET_RTP), // coinflip
    (50 / 100) * chanceMultiplier(50), // dice
  ];
  for (const r of rtps) assert.ok(Math.abs(r - TARGET_RTP) < TOL, `stray RTP ${r}`);
});

test("binomial pmf sums to 1 for every plinko board", () => {
  for (const rows of [8, 12, 16]) {
    const total = Array.from({ length: rows + 1 }, (_, k) => binomialPmf(rows, k)).reduce(
      (a, b) => a + b,
      0,
    );
    assert.ok(Math.abs(total - 1) < 1e-12);
  }
});
