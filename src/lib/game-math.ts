/*
 * Payout calibration for the Originals.
 *
 * Every table in here is *generated* from a target RTP rather than typed by
 * hand, because hand-typed tables are how the previous versions ended up
 * paying 152% on Plinko 12-row and 64% on Wheel low: a number gets tweaked for
 * feel, nobody re-derives the expectation, and the error is invisible until it
 * shows up in the ledger.
 *
 * The rule here: a table's *shape* (how volatile it feels) is a design choice,
 * its *scale* is arithmetic. You pick relative weights; `normalise` fixes the
 * house edge. That makes a miscalibrated table impossible to express — the
 * only way to change RTP is to change HOUSE_EDGE.
 *
 * All of this is server-only truth. The client imports the same tables to draw
 * labels, but /api/bets recomputes every outcome; nothing here is trusted from
 * the browser.
 */

/**
 * House edge for the Originals. 6% → 94% RTP.
 *
 * Deeper than the 1% crypto-casino norm and closer to a land-based operator.
 * That is a commercial decision, not a technical one, and it has consequences
 * worth stating plainly:
 *
 *  - It is legal essentially everywhere; there is no upper bound on house edge
 *    in the jurisdictions this platform targets. What *is* regulated is
 *    disclosure, which is why the RTP badge in GameFrame is not optional.
 *  - It is visible. Players on crypto casinos compare RTP, and 94% against a
 *    99% competitor is a five-point gap on the one number they check.
 *  - It changes what a game can offer. See MAX_WIN_CHANCE below.
 */
export const HOUSE_EDGE = 0.06;
export const TARGET_RTP = 1 - HOUSE_EDGE;

/** Roulette is exempt: its edge is structural (single zero → 2.70%). */
export const ROULETTE_RTP = 36 / 37;

/** Slots run the deepest edge, as physical and online slots do. */
export const SLOTS_RTP = 0.92;

/**
 * Highest win chance a game may offer, in percent.
 *
 * This constraint does not exist at 99% RTP and is the one real casualty of
 * moving to 94%. A fair payout is RTP/chance, so once the win chance passes
 * TARGET_RTP the multiplier drops below 1.00 — the game announces a WIN and
 * hands back less than the stake. At 94% that happens above 94% win chance,
 * and the payout is already a meaningless 1.0000x at 93%.
 *
 * Rather than let a game quote "you win 97% of the time" and then pay 0.96x,
 * the win chance is capped so every win returns at least MIN_WIN_MULTIPLIER.
 * Dice's slider range and Limbo's minimum target both derive from this.
 */
export const MIN_WIN_MULTIPLIER = 1.02;
export const MAX_WIN_CHANCE = (TARGET_RTP * 100) / MIN_WIN_MULTIPLIER;

/* ────────────────────────── helpers ────────────────────────── */

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** Probability of exactly k successes in n fair coin flips. */
export function binomialPmf(n: number, k: number): number {
  return binomial(n, k) / Math.pow(2, n);
}

/**
 * Scale `values` so that sum(probs[i] * values[i]) === targetRtp.
 *
 * This is the single choke point that makes an over-paying table impossible:
 * whatever shape you hand it, the expectation comes out exact.
 */
export function normalise(values: number[], probs: number[], targetRtp: number): number[] {
  const raw = values.reduce((acc, v, i) => acc + v * probs[i], 0);
  if (raw <= 0) throw new Error("normalise: table has no positive expectation");
  const scale = targetRtp / raw;
  return values.map((v) => v * scale);
}

/** Expected return of a table — used by the tests to assert calibration. */
export function expectedValue(values: number[], probs: number[]): number {
  return values.reduce((acc, v, i) => acc + v * probs[i], 0);
}

/**
 * Round to 2dp without breaking calibration.
 *
 * Naive rounding shifts the expectation (Plinko 16-high moved ~0.4% that way).
 * This rounds every entry, measures the drift, and pushes the correction into
 * the highest-probability entries — the ones where a small absolute change is
 * least visible to a player reading the table.
 */
export function roundCalibrated(
  values: number[],
  probs: number[],
  targetRtp: number,
  opts: {
    /** Indices that must keep equal values (mirrored Plinko slots). */
    mirror?: boolean;
    /** Paying entries may not fall below this. */
    minPaying?: number;
  } = {},
): number[] {
  if (opts.mirror) return roundMirrored(values, probs, targetRtp, opts.minPaying);
  return roundFree(values, probs, targetRtp, opts.minPaying);
}

/**
 * Symmetric variant: a Plinko board must mirror around its centre, so slot i
 * and slot n-1-i are corrected together as one unit. Correcting them
 * independently (as the free solver does) produces boards where the left edge
 * pays 9.77x and the right pays 9.82x — visibly unfair, and the kind of thing
 * a player screenshots.
 */
function roundMirrored(
  values: number[],
  probs: number[],
  targetRtp: number,
  minPaying?: number,
): number[] {
  const n = values.length;
  const out = values.map((v) => Math.round(v * 100) / 100);
  if (minPaying !== undefined) {
    for (let i = 0; i < n; i++) if (values[i] > 0) out[i] = Math.max(out[i], minPaying);
  }
  // Force exact mirror symmetry before correcting.
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const j = n - 1 - i;
    const v = Math.max(out[i], out[j]);
    out[i] = v;
    out[j] = v;
  }

  // Pair index → combined probability.
  const pairs: Array<{ idx: number[]; p: number }> = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push({ idx: [i, n - 1 - i], p: probs[i] + probs[n - 1 - i] });
  }
  if (n % 2 === 1) {
    const m = Math.floor(n / 2);
    pairs.push({ idx: [m], p: probs[m] });
  }
  pairs.sort((a, b) => b.p - a.p);

  for (let pass = 0; pass < 4096; pass++) {
    const drift = targetRtp - expectedValue(out, probs);
    if (Math.abs(drift) < 1e-12) break;
    let moved = false;
    for (const pair of pairs) {
      if (pair.p <= 0) continue;
      const perCent = pair.p * 0.01;
      let cents = Math.trunc(drift / perCent);
      if (cents === 0) cents = drift > 0 ? 1 : -1;
      const base = out[pair.idx[0]];
      const next = Math.round((base + cents / 100) * 100) / 100;
      if (next < 0) continue;
      if ((base === 0) !== (next === 0)) continue;
      if (minPaying !== undefined && base > 0 && next < minPaying) continue;
      const candidate = [...out];
      for (const i of pair.idx) candidate[i] = next;
      if (Math.abs(targetRtp - expectedValue(candidate, probs)) >= Math.abs(drift) - 1e-15) continue;
      for (const i of pair.idx) out[i] = next;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return out;
}

function roundFree(
  values: number[],
  probs: number[],
  targetRtp: number,
  minPaying?: number,
): number[] {
  const out = values.map((v) => Math.round(v * 100) / 100);
  if (minPaying !== undefined) {
    for (let i = 0; i < out.length; i++) if (values[i] > 0) out[i] = Math.max(out[i], minPaying);
  }
  // Correct from the highest-probability entries down: a one-cent change there
  // moves the expectation most, so the drift is absorbed in the fewest steps
  // and with the smallest visible change to any single payout.
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);

  for (let pass = 0; pass < 4096; pass++) {
    const drift = targetRtp - expectedValue(out, probs);
    if (Math.abs(drift) < 1e-12) break;

    let moved = false;
    for (const i of order) {
      if (probs[i] <= 0) continue;
      // One cent on this entry moves the expectation by probs[i] * 0.01.
      const perCent = probs[i] * 0.01;
      if (perCent <= 0) continue;
      // Never overshoot: take the largest whole-cent step that keeps the drift
      // moving toward zero. Trunc (not round) guarantees |newDrift| < |drift|.
      let cents = Math.trunc(drift / perCent);
      if (cents === 0) cents = drift > 0 ? 1 : -1;
      const next = Math.round((out[i] + cents / 100) * 100) / 100;
      if (next < 0) continue;
      // Never turn a losing slot into a paying one or vice versa — that would
      // change the game's shape, not its scale.
      if ((out[i] === 0) !== (next === 0)) continue;
      // Keep paying entries above the stake where the caller requires it.
      if (minPaying !== undefined && out[i] > 0 && next < minPaying) continue;
      // Only accept a step that actually reduces the error.
      const candidate = [...out];
      candidate[i] = next;
      if (Math.abs(targetRtp - expectedValue(candidate, probs)) >= Math.abs(drift) - 1e-15) continue;
      out[i] = next;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return out;
}

/* ────────────────────────── Plinko ────────────────────────── */

export type Risk = "low" | "medium" | "high";
export const PLINKO_ROWS = [8, 12, 16] as const;
export type PlinkoRows = (typeof PLINKO_ROWS)[number];

/*
 * Plinko shape. A ball falling through `rows` pegs lands in slot k with
 * binomial probability, so the centre is overwhelmingly likely and the edges
 * are rare. The payout curve therefore has to rise steeply toward the edges
 * just to stay flat in expectation.
 *
 * `edgeGain` controls how steep: low risk barely rises (frequent small wins),
 * high risk rises hard (rare huge wins). Both land on the same RTP — risk
 * changes the distribution of the return, never the house edge. That is the
 * property the old hand-typed tables violated.
 */
const PLINKO_SHAPE: Record<Risk, { edgeGain: number; floor: number }> = {
  low: { edgeGain: 2.2, floor: 0.5 },
  medium: { edgeGain: 4.6, floor: 0.3 },
  high: { edgeGain: 8.5, floor: 0.2 },
};

export function plinkoTable(rows: PlinkoRows, risk: Risk): number[] {
  const { edgeGain, floor } = PLINKO_SHAPE[risk];
  const mid = rows / 2;
  const probs: number[] = [];
  const shape: number[] = [];

  for (let k = 0; k <= rows; k++) {
    probs.push(binomialPmf(rows, k));
    // Distance from centre, 0..1.
    const d = Math.abs(k - mid) / mid;
    // Exponential rise toward the edges. The floor keeps centre slots from
    // reaching zero: a Plinko that pays nothing in the middle feels broken
    // even when the maths is fine.
    shape.push(floor + Math.pow(d, 2) * Math.exp(edgeGain * d));
  }

  // Mirrored so slot i and its opposite always pay the same, and floored so
  // every slot returns something — Plinko's premise is that the ball always
  // pays, just unequally.
  return roundCalibrated(normalise(shape, probs, TARGET_RTP), probs, TARGET_RTP, {
    mirror: true,
    minPaying: 0.1,
  });
}

export function plinkoProbs(rows: PlinkoRows): number[] {
  return Array.from({ length: rows + 1 }, (_, k) => binomialPmf(rows, k));
}

/* ────────────────────────── Wheel ────────────────────────── */

export const WHEEL_SEGMENTS = [10, 20, 30, 40, 50] as const;
export type WheelSegments = (typeof WHEEL_SEGMENTS)[number];

/*
 * Wheel. `hitRate` is the fraction of segments that pay at all; the rest are
 * losses. Low risk pays on most segments at just above 1x, high risk pays on
 * few at a large multiple. Again: same RTP, different feel.
 */
const WHEEL_SHAPE: Record<Risk, { hitRate: number; spread: number }> = {
  low: { hitRate: 0.7, spread: 0.35 },
  medium: { hitRate: 0.4, spread: 1.6 },
  high: { hitRate: 0.15, spread: 3.2 },
};

export function wheelTable(segments: WheelSegments, risk: Risk): number[] {
  const { hitRate, spread } = WHEEL_SHAPE[risk];

  /*
   * Budget formulation rather than shape-then-normalise.
   *
   * A paying segment must return at least the stake — landing on a lit segment
   * and getting 0.81x back reads as a broken win. But normalising a free shape
   * and then clamping to 1x fights itself: the clamp only ever adds return, so
   * the table lands above target and the solver cannot pull it back down
   * (50-segment low risk came out at 110.8%).
   *
   * Instead: hand every winner 1x, then share out what is left of the RTP
   * budget. Both constraints hold by construction.
   *
   *   total budget    = TARGET_RTP * segments
   *   floor spend     = winners * 1
   *   surplus         = budget - winners, distributed by the shape weights
   *
   * This also bounds the winner count: `winners` can never exceed the budget,
   * or there is nothing left above the floor.
   */
  const budget = TARGET_RTP * segments;
  const maxWinners = Math.max(1, Math.floor(budget / 1.15));
  const winners = Math.max(1, Math.min(maxWinners, Math.round(segments * hitRate)));
  const surplus = budget - winners;

  // Relative claim each winner has on the surplus. A steep curve concentrates
  // it into a few big multipliers (high risk); a flat one spreads it thin.
  const weights: number[] = [];
  for (let i = 0; i < winners; i++) {
    const t = winners === 1 ? 1 : i / (winners - 1);
    weights.push(Math.pow(t, 1 + spread * 1.6) + 1e-6);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const tiers = weights.map((w) => 1 + (surplus * w) / weightSum);

  // Spread winners evenly around the wheel so it reads as varied rather than
  // "all the good ones are bunched together".
  const shape = new Array<number>(segments).fill(0);
  const step = segments / winners;
  for (let i = 0; i < winners; i++) {
    shape[Math.floor(i * step) % segments] = tiers[i];
  }

  const probs = Array.from({ length: segments }, () => 1 / segments);
  return roundCalibrated(shape, probs, TARGET_RTP, { minPaying: 1 });
}

/* ────────────────────────── Shoot ────────────────────────── */

/*
 * Shoot resolves one roll into a multiplier band. The old version had bands
 * summing to 141% RTP — it paid out more than it took, on every single shot.
 *
 * `minWin` guards a subtler failure than miscalibration: after normalising, a
 * band can land below 1.0, so the game announces a hit and returns less than
 * the stake. That reads as a bug to a player even though the maths is right,
 * so the lowest paying band is pinned at 1.1x and the rest absorb the cost.
 */
const SHOOT_BANDS: Array<{ p: number; shape: number }> = [
  { p: 0.45, shape: 0 },
  { p: 0.3, shape: 1.5 },
  { p: 0.15, shape: 2.4 },
  { p: 0.07, shape: 4.5 },
  { p: 0.025, shape: 11 },
  { p: 0.005, shape: 40 },
];

const SHOOT_MIN_WIN = 1.1;

export function shootBands(): Array<{ p: number; cumulative: number; multiplier: number }> {
  const probs = SHOOT_BANDS.map((b) => b.p);
  let mults = normalise(SHOOT_BANDS.map((b) => b.shape), probs, TARGET_RTP);

  // Pin any paying band that normalised below the stake, then re-solve the
  // remaining bands so the total still lands on TARGET_RTP.
  const pinned = mults.map((m, i) => SHOOT_BANDS[i].shape > 0 && m < SHOOT_MIN_WIN);
  if (pinned.some(Boolean)) {
    const fixedReturn = pinned.reduce(
      (acc, isPinned, i) => acc + (isPinned ? SHOOT_MIN_WIN * probs[i] : 0),
      0,
    );
    const freeIdx = mults.map((_, i) => i).filter((i) => !pinned[i] && SHOOT_BANDS[i].shape > 0);
    const freeShapes = freeIdx.map((i) => SHOOT_BANDS[i].shape);
    const freeProbs = freeIdx.map((i) => probs[i]);
    const scaled = normalise(freeShapes, freeProbs, TARGET_RTP - fixedReturn);
    mults = mults.map((m, i) => {
      if (pinned[i]) return SHOOT_MIN_WIN;
      const at = freeIdx.indexOf(i);
      return at >= 0 ? scaled[at] : m;
    });
  }

  const rounded = roundCalibrated(mults, probs, TARGET_RTP);
  let acc = 0;
  return SHOOT_BANDS.map((b, i) => {
    acc += b.p;
    return { p: b.p, cumulative: acc, multiplier: rounded[i] };
  });
}

/* ────────────────────────── Mines ────────────────────────── */

export const MINES_TILES = 25;

/**
 * Fair multiplier after `picks` safe tiles with `mines` live.
 *
 * The inverse of the survival probability, times (1 - edge). Derived rather
 * than tabulated, so it is correct for every one of the 24 × 24 combinations.
 */
export function minesMultiplier(picks: number, mines: number, tiles = MINES_TILES): number {
  if (picks <= 0) return 1;
  const safe = tiles - mines;
  if (picks > safe) return 0;
  let inverse = 1;
  for (let i = 0; i < picks; i++) {
    inverse *= (tiles - i) / (safe - i);
  }
  // At a 6% edge the safest possible reveal (1 mine, 1 pick) survives 96% of
  // the time, so the fair payout is 0.979x — a cash-out that returns less than
  // the stake. The floor keeps that cash-out honest; the cost is a hair under
  // the target RTP on exactly that one combination, which is the right way
  // round. It resolves itself after the second pick.
  return Math.max(MIN_WIN_MULTIPLIER, inverse * TARGET_RTP);
}

/**
 * Whether a (picks, mines) pair pays the exact target, or is floored.
 * Only the very safest reveals are floored — see minesMultiplier.
 */
export function minesIsFloored(picks: number, mines: number, tiles = MINES_TILES): boolean {
  if (picks <= 0 || picks > tiles - mines) return false;
  let inverse = 1;
  for (let i = 0; i < picks; i++) inverse *= (tiles - i) / (tiles - mines - i);
  return inverse * TARGET_RTP < MIN_WIN_MULTIPLIER;
}

/** Probability of surviving `picks` reveals. */
export function minesSurvival(picks: number, mines: number, tiles = MINES_TILES): number {
  const safe = tiles - mines;
  let p = 1;
  for (let i = 0; i < picks; i++) p *= (safe - i) / (tiles - i);
  return p;
}

/* ────────────────────────── Keno ────────────────────────── */

export const KENO_POOL = 40;
export const KENO_DRAWN = 10;

/**
 * P(exactly `hits` of the player's `picks` appear in the draw).
 *
 * Hypergeometric: choosing `KENO_DRAWN` from `KENO_POOL` without replacement.
 */
export function kenoHitProb(picks: number, hits: number): number {
  const denom = binomial(KENO_POOL, KENO_DRAWN);
  if (denom === 0) return 0;
  return (binomial(picks, hits) * binomial(KENO_POOL - picks, KENO_DRAWN - hits)) / denom;
}

/**
 * Rescale a Keno paytable row to the target RTP.
 *
 * Keno's rows were hand-typed against a 97% target — the same fragility that
 * left Plinko at 152%. Rather than retype forty rows for the new edge, the
 * shape is kept (which hits pay, and their relative size, is the game's feel)
 * and only the scale is re-solved against the real hypergeometric weights.
 *
 * `cap` reflects the real liability limit: an uncapped row can quote a
 * 10-of-10 payout the platform would not actually honour.
 */
export function kenoRow(picks: number, shape: number[], targetRtp = TARGET_RTP, cap = 5000): number[] {
  const probs = shape.map((_, hits) => kenoHitProb(picks, hits));
  const scaled = normalise(shape, probs, targetRtp);

  // Capping removes return, so whatever the cap takes away is redistributed
  // across the uncapped paying entries — otherwise the row silently lands
  // below target, which is exactly the drift this module exists to prevent.
  if (scaled.some((v) => v > cap)) {
    const lost = scaled.reduce((acc, v, i) => acc + (v > cap ? (v - cap) * probs[i] : 0), 0);
    const freeIdx = scaled.map((_, i) => i).filter((i) => scaled[i] <= cap && shape[i] > 0);
    const freeMass = freeIdx.reduce((acc, i) => acc + scaled[i] * probs[i], 0);
    if (freeMass > 0) {
      const boost = 1 + lost / freeMass;
      for (const i of freeIdx) scaled[i] *= boost;
    }
    for (let i = 0; i < scaled.length; i++) if (scaled[i] > cap) scaled[i] = cap;
  }

  return scaled.map((v) => Math.round(v * 100) / 100);
}

/* ────────────────────────── Dice / Limbo / Crash ────────────────────────── */

/**
 * Dice and Limbo share one rule: pay RTP/chance, so the return is flat at
 * every target.
 *
 * The upper clamp is MAX_WIN_CHANCE, not an arbitrary 98: past that point the
 * fair multiplier falls below the stake, so clamping the *chance* keeps every
 * win worth winning. Clamping the payout instead (what the old
 * `Math.max(1.01, …)` did) silently pushes RTP above target at the extremes —
 * that is how dice reached 99.99% before.
 */
export function chanceMultiplier(winChancePercent: number): number {
  const clamped = Math.min(MAX_WIN_CHANCE, Math.max(0.01, winChancePercent));
  return (TARGET_RTP * 100) / clamped;
}

/**
 * Crash point from a uniform.
 *
 * The standard construction: an instant-bust band of exactly the house edge,
 * then a 1/(1-u) tail. Deriving the bust chance from HOUSE_EDGE (rather than
 * hardcoding 0.02 alongside a separate 0.99 factor, as before) is what makes
 * the RTP come out flat at every cash-out target instead of drifting.
 */
export function crashPointFrom(u: number): number {
  if (u < HOUSE_EDGE) return 1.0;
  const scaled = (u - HOUSE_EDGE) / (1 - HOUSE_EDGE);
  const point = 1 / (1 - scaled);
  return Math.max(1, Math.floor(point * 100) / 100);
}

/** Limbo shares the crash curve — same distribution, different presentation. */
export function limboRollFrom(u: number): number {
  return crashPointFrom(u);
}

/* ────────────────────────── Slots ──────────────────────────
 * 3 reels × 3 rows, centre row is the single payline, SYM1 is wild.
 *
 * This lived inline in the bet route while the UI carried a hand-copied
 * paytable for display. The two drifted the moment the edge changed — the UI
 * still advertised the old numbers while the server paid new ones. One
 * exported table now feeds both.
 */
export const SLOT_WEIGHTS = [3, 13, 11, 9, 7, 5]; // SYM1(wild)..SYM6
const SLOT_BASE_PAY = [60, 4, 6, 9, 14, 22]; // base 3-of-a-kind, SYM1..SYM6

/** Reel-strip symbol probabilities, SYM1..SYM6. */
export function slotProbs(): number[] {
  const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  return SLOT_WEIGHTS.map((w) => w / total);
}

/**
 * Paytable normalised so E[multiplier] on the centre line === SLOTS_RTP.
 * Wilds complete any symbol, so symbol x wins on (p[x] + p[wild])^3 minus the
 * all-wild case, which pays at the wild rate instead.
 */
export function slotPaytable(): number[] {
  const p = slotProbs();
  const p1 = p[0];
  let rawE = SLOT_BASE_PAY[0] * p1 ** 3;
  for (let x = 1; x < 6; x++) rawE += SLOT_BASE_PAY[x] * ((p[x] + p1) ** 3 - p1 ** 3);
  const scale = SLOTS_RTP / rawE;
  return SLOT_BASE_PAY.map((v) => v * scale);
}
