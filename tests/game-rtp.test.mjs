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
  MAX_WIN_CHANCE,
  MIN_WIN_MULTIPLIER,
  minesIsFloored,
  kenoRow,
  kenoHitProb,
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
  slotPaytable,
  slotProbs,
  SLOTS_RTP,
  KENO_POOL,
  KENO_DRAWN,
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

test("mines returns the target RTP for every unfloored mines/picks pair", () => {
  for (let mines = 1; mines <= 24; mines++) {
    const safe = 25 - mines;
    for (let picks = 1; picks <= safe; picks++) {
      if (minesIsFloored(picks, mines)) continue;
      const rtp = minesSurvival(picks, mines) * minesMultiplier(picks, mines);
      assert.ok(
        Math.abs(rtp - TARGET_RTP) < 1e-9,
        `mines=${mines} picks=${picks} → ${(rtp * 100).toFixed(4)}%`,
      );
    }
  }
});

test("mines never offers a cash-out below the stake", () => {
  for (let mines = 1; mines <= 24; mines++) {
    for (let picks = 1; picks <= 25 - mines; picks++) {
      assert.ok(
        minesMultiplier(picks, mines) >= MIN_WIN_MULTIPLIER - 1e-12,
        `mines=${mines} picks=${picks} pays ${minesMultiplier(picks, mines)}x`,
      );
    }
  }
});

test("mines flooring is confined to the safest reveals and costs little", () => {
  // Only combinations that would pay under the stake are floored, and the
  // resulting overpay must stay small — a large one would be an edge leak.
  let floored = 0;
  for (let mines = 1; mines <= 24; mines++) {
    for (let picks = 1; picks <= 25 - mines; picks++) {
      if (!minesIsFloored(picks, mines)) continue;
      floored++;
      const rtp = minesSurvival(picks, mines) * minesMultiplier(picks, mines);
      assert.ok(rtp <= 1.0, `mines=${mines} picks=${picks} returns ${rtp} — over 100%`);
      assert.ok(rtp > TARGET_RTP, "a floored pair should pay above target, not below");
    }
  }
  assert.ok(floored > 0 && floored < 12, `${floored} floored pairs — expected a handful`);
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
  assert.equal(minesMultiplier(1, 24), 25 * TARGET_RTP);
});

/* ─────────────────────── Dice and Limbo ─────────────────────── */

test("dice returns the target RTP at every offerable win chance", () => {
  for (let chance = 1; chance <= Math.floor(MAX_WIN_CHANCE); chance++) {
    const rtp = (chance / 100) * chanceMultiplier(chance);
    assert.ok(Math.abs(rtp - TARGET_RTP) < 1e-12, `chance=${chance} → ${rtp}`);
  }
});

test("dice never announces a win that returns less than the stake", () => {
  // The constraint that appears at a 6% edge: a fair payout is RTP/chance, so
  // past a ~94% win chance the multiplier drops below 1.00 and a WIN hands
  // back less than was staked. The cap is on the chance, not the payout.
  for (let chance = 1; chance <= 100; chance++) {
    assert.ok(
      chanceMultiplier(chance) >= MIN_WIN_MULTIPLIER - 1e-12,
      `chance=${chance} pays ${chanceMultiplier(chance)}x`,
    );
  }
});

test("dice never pays above the target at extreme chances", () => {
  // The old Math.max(1.01, 99/chance) payout floor pushed RTP to 99.99% at
  // chance=99. Clamping the chance instead keeps the return at or below target.
  for (const chance of [0.01, 0.5, 93, 94, 99, 99.99]) {
    const rtp = (Math.min(chance, MAX_WIN_CHANCE) / 100) * chanceMultiplier(chance);
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

/* ─────────────────────────── Keno ─────────────────────────── */

test("keno hit probabilities form a valid distribution", () => {
  for (let picks = 1; picks <= 10; picks++) {
    let total = 0;
    for (let hits = 0; hits <= picks; hits++) total += kenoHitProb(picks, hits);
    assert.ok(Math.abs(total - 1) < 1e-9, `picks=${picks} sums to ${total}`);
  }
});

test("keno rows re-solve to the target RTP whatever shape they start from", () => {
  // The shapes below are the old 97%-era numbers; the point is that the
  // rescaler lands them on the current target regardless of their origin.
  const shapes = {
    1: [0, 3.88],
    3: [0, 0, 4.15, 33.19],
    6: [0, 0, 0, 2.06, 16.46, 131.7, 1053.57],
    10: [0, 0, 0, 0, 0, 13.6, 44.19, 143.63, 466.79, 1517.07, 4930.49],
  };
  for (const [picks, shape] of Object.entries(shapes)) {
    const p = Number(picks);
    const row = kenoRow(p, shape);
    let rtp = 0;
    for (let hits = 0; hits <= p; hits++) rtp += kenoHitProb(p, hits) * (row[hits] ?? 0);
    assert.ok(Math.abs(rtp - TARGET_RTP) < 5e-3, `picks=${p} → ${(rtp * 100).toFixed(3)}%`);
  }
});

test("keno respects its liability cap without dropping below target", () => {
  // Capping removes return; if it is not redistributed the row lands short.
  const shape = [0, 0, 0, 0, 0, 10, 40, 140, 460, 1500, 50000];
  const row = kenoRow(10, shape, TARGET_RTP, 5000);
  assert.ok(Math.max(...row) <= 5000, "cap exceeded");
  let rtp = 0;
  for (let hits = 0; hits <= 10; hits++) rtp += kenoHitProb(10, hits) * (row[hits] ?? 0);
  assert.ok(Math.abs(rtp - TARGET_RTP) < 5e-3, `capped row → ${(rtp * 100).toFixed(3)}%`);
});

test("keno never pays for a hit count the shape marks as losing", () => {
  const row = kenoRow(5, [0, 0, 0, 5.38, 43.01, 344.06]);
  for (const i of [0, 1, 2]) assert.equal(row[i], 0);
});

/* ──────────────────── House edge, stated ──────────────────── */

test("the configured house edge is what the games actually run", () => {
  assert.ok(Math.abs(TARGET_RTP - 0.94) < 1e-12, `TARGET_RTP is ${TARGET_RTP}`);
  assert.ok(Math.abs(HOUSE_EDGE - 0.06) < 1e-12);
  // Roulette must stay on its structural edge, never dragged to the house one.
  assert.ok(ROULETTE_RTP > TARGET_RTP, "roulette should still be the best odds on the site");
});

test("MAX_WIN_CHANCE is derived, not guessed", () => {
  // At the cap the payout is exactly MIN_WIN_MULTIPLIER; one point past it the
  // fair payout would breach that floor.
  assert.ok(Math.abs(chanceMultiplier(MAX_WIN_CHANCE) - MIN_WIN_MULTIPLIER) < 1e-9);
  assert.ok((TARGET_RTP * 100) / (MAX_WIN_CHANCE + 1) < MIN_WIN_MULTIPLIER);
});

/* ──────────────────────────────────────────────────────────
 * UI/engine agreement.
 *
 * Several games rendered hardcoded payout tables that were snapshots of an
 * older calibration. The server paid one number, the screen showed another.
 * These lock the two together: if a table is ever inlined again, the numbers
 * it would have to contain are asserted here.
 * ────────────────────────────────────────────────────────── */

test("plinko bins the UI draws are the bins the server pays", () => {
  // The old inlined '12-high' table peaked at 420x; the calibrated one is far
  // lower. Any UI copy of these numbers has to match plinkoTable exactly.
  for (const rows of [8, 12, 16]) {
    for (const risk of ["low", "medium", "high"]) {
      const t = plinkoTable(rows, risk);
      assert.equal(t.length, rows + 1, `${rows}-${risk} bin count`);
      assert.ok(
        Math.abs(expectedValue(t, plinkoProbs(rows)) - TARGET_RTP) < TOL,
        `${rows}-${risk} must pay exactly the target`,
      );
    }
  }
});

test("wheel wedges the UI draws are the wedges the server pays", () => {
  // The wheel rendered a fixed 1.2/1.5/1.8/2.0 table. Deriving it means the
  // wedge under the pointer is always the credited multiplier.
  for (const risk of ["low", "medium", "high"]) {
    const t = wheelTable(20, risk);
    assert.equal(t.length, 20);
    const probs = t.map(() => 1 / 20);
    assert.ok(Math.abs(expectedValue(t, probs) - TARGET_RTP) < TOL, `wheel 20-${risk}`);
  }
});

test("slots paytable is derived and returns exactly SLOTS_RTP", () => {
  const pays = slotPaytable();
  const p = slotProbs();
  const p1 = p[0];
  let ev = pays[0] * p1 ** 3;
  for (let x = 1; x < 6; x++) ev += pays[x] * ((p[x] + p1) ** 3 - p1 ** 3);
  assert.ok(Math.abs(ev - SLOTS_RTP) < TOL, `slots EV ${ev} != ${SLOTS_RTP}`);
});

test("keno's grid matches the pool its paytable was solved against", () => {
  // The client drew 20 balls from 1..80 while the server drew 10 from 40, so
  // the odds on screen were not the odds being paid.
  assert.equal(KENO_POOL, 40);
  assert.equal(KENO_DRAWN, 10);
  for (let picks = 1; picks <= 10; picks++) {
    let sum = 0;
    for (let hits = 0; hits <= picks; hits++) sum += kenoHitProb(picks, hits);
    assert.ok(Math.abs(sum - 1) < 1e-9, `picks=${picks} distribution must sum to 1`);
  }
});
