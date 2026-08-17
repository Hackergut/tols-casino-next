# TOLS Originals — framework and calibration

Two things live here: the shell every Original renders inside, and the payout
maths behind them. Both were rebuilt because the games had drifted apart
visually and, more seriously, several were mathematically broken.

## The RTP audit

Every game's real return was computed from its own probability model (exactly
where a closed form exists, by integration over the uniform where not). These
were the results **before** the rework:

| Game | Config | RTP before | Verdict |
| --- | --- | --- | --- |
| Plinko | 12-row high | **251.9%** | House loses ~1.5x the stake per ball |
| Plinko | 12-row medium | **152.6%** | House loses ~0.5x the stake per ball |
| Shoot | all | **141.0%** | House loses 41c per $1, every shot |
| Plinko | 12-row low | 95.9% | Player short-changed |
| Wheel | 20-low | **64.0%** | Player robbed — 36% edge |
| Wheel | 20-high | **82.0%** | Player robbed — 18% edge |
| Wheel | 20-medium | 97.5% | Off-target |
| Dice | target 99 | 99.99% | Payout floor pushed it near 100% |
| Slots | — | 96.98% | 2dp rounding drift off target |
| Keno | all pick counts | 96.9–97.1% | Hand-typed rows stranded at the old edge |
| Crash | varies | 98.8–99.1% | Edge double-counted, drifted with target |
| Dice/Mines/Keno/Roulette | — | correct | Left alone |

The Plinko, Shoot and Wheel numbers are the serious ones. Three of the twelve
games were unshippable: two paid out more than they took, and the Wheel's low
and high risk settings quietly ran a 36% and 18% house edge — meaning "risk"
was changing the house edge rather than the volatility, which is the one thing
a risk selector must never do.

Every one of these was a plausible-looking hand-typed list of numbers. That is
the failure mode this rework is designed to make impossible.

## How calibration works now

`src/lib/game-math.ts` generates every table from a target RTP. The rule:

> A table's **shape** — how volatile it feels — is a design choice.
> A table's **scale** is arithmetic.

You supply relative weights; `normalise()` fixes the expectation. There is no
way to express an over-paying table, because the only input that changes RTP is
`HOUSE_EDGE`.

```ts
export const HOUSE_EDGE = 0.06;      // → 94% RTP across the Originals
export const ROULETTE_RTP = 36 / 37; // structural single-zero edge, exempt
export const SLOTS_RTP = 0.92;       // slots run deeper, as they do offline
```

### Two constraints that only appear at a 6% edge

Dropping from a 1% to a 6% edge broke two games in ways a 1% edge hides, because
the fair payout `RTP / chance` now falls below 1.00 while the player is still
being told they won:

- **Sub-stake wins.** Above a 94% win chance, dice pays less than the stake — a
  "WIN" that shrinks your balance. The fix clamps the **chance**, not the
  payout: `MAX_WIN_CHANCE = TARGET_RTP * 100 / MIN_WIN_MULTIPLIER` (≈92.16%).
  Clamping the payout instead is exactly what pushed dice to 99.99% before.
- **Mines' safest reveal.** One mine, one pick survives 24/25 = 96% > 94%, so
  the fair payout is 0.9792x. A `MIN_WIN_MULTIPLIER` floor holds it at 1.02x.
  `minesIsFloored()` identifies the affected pairs; the tests assert there are
  fewer than 12, that each stays at or below 100% RTP, and that the overpay
  disappears from the second pick onward.

A 6% edge is legal in every market targeted — disclosure is what is regulated,
not the number, which is why the RTP badge is not optional — but it is five
points worse than a 99% competitor on the one figure players compare.

Three constraints beyond raw calibration, each learned from a defect the tests
caught:

- **`roundCalibrated`** — rounding to whole cents shifts the expectation, so
  the drift is measured and pushed back into the highest-probability entries,
  where a one-cent change is least visible.
- **`mirror`** — Plinko boards must be symmetric. Correcting slots
  independently produced a board whose left edge paid 9.77x and right paid
  9.82x.
- **`minPaying`** — a "win" that returns less than the stake reads as a bug.
  Wheel segments pay ≥ 1x, Plinko slots pay ≥ 0.1x (every slot pays something,
  which is Plinko's whole premise).

The Wheel needed a different formulation entirely. Normalising a free shape and
then clamping to 1x fights itself — the clamp only adds return, so the table
lands above target and cannot be pulled back (50-segment low risk came out at
110.8%). It now works from a budget: every winner gets 1x, and the remaining
RTP budget is shared out by weight. Both constraints hold by construction.

## Verification

`npm test` runs 110 RTP assertions. Every generated table is checked to return
exactly 94.0000% (within a cent of rounding tolerance), plus the structural
properties:

- Plinko: symmetric, every slot pays, edges pay more than the centre, and
  higher risk means a wider spread — *at the same RTP*.
- Wheel: higher risk means fewer and larger wins, no sub-1x "wins".
- Mines: correct for all 300 valid (mines, picks) combinations.
- Dice: flat 94% at every win chance up to `MAX_WIN_CHANCE`, and never
  announces a win that returns less than the stake.
- Crash: flat 94% at every cash-out target, verified by integration.
- Keno: rows are re-solved against the hypergeometric weights, and capping a
  row at the 5000x liability limit redistributes the capped return instead of
  silently undershooting.
- Roulette: keeps its real 97.297% single-zero edge rather than being forced
  down to 94% — it is deliberately the best return on the site, and a test
  asserts it stays above the Originals target.
- UI/engine agreement: the payout tables the games *draw* are the tables the
  server *pays*, asserted for plinko, wheel, slots and keno.

Note on the crash bust rate: `P(point === 1.00)` is about twice `HOUSE_EDGE`. That is the 2dp floor collapsing the sliver just above the bust
band down to 1.00 — presentation, not edge. The flat-RTP test is what pins the
actual return.

## The shell

`src/components/casino/GameFrame.tsx` is the single layout every Original uses,
following the Goated Originals structure with TOLS styling:

```
┌──────────────────────────────────────────────┐
│ title · RTP badge · recent multipliers       │
├───────────────┬──────────────────────────────┤
│ bet panel     │                              │
│  amount ½ 2×  │        game canvas           │
│  game inputs  │                              │
│  [ BET ]      │                              │
├───────────────┴──────────────────────────────┤
│ provably fair · seed commitment              │
└──────────────────────────────────────────────┘
```

Desktop puts controls to the left of the canvas so the bet button sits near the
cursor's resting position. Mobile stacks canvas-first with controls below,
because the canvas is what you watch and the bottom is what your thumb reaches.

### Why this replaced `game-shared.tsx`

`game-shared.tsx` already exported `GameLayout`, `GameHeader`, `GameBalance`,
`GameStats`, `GameActionButton`, `GameProvablyFair`, `GameHistory`,
`GameControlsPanel` and `useGameBet`. **Eight of those nine had zero call
sites.** Only `GameBetControls` was ever adopted, and slots and roulette
imported nothing at all. The abstraction existed; nobody used it; the games
diverged — `space-y-4`, `space-y-5`, `space-y-6`, and two bespoke wrappers.

`GameFrame` is narrower on purpose: it owns the frame and nothing else, so a
game cannot partially adopt it and drift again.

### Shared pieces

| Component | Role |
| --- | --- |
| `GameFrame` | Header, two-column body, fairness footer |
| `BetPanel` | Amount, ½/2×, quick chips, Max, game inputs, action slot |
| `BetButton` | The single action button, primary or danger |
| `StatRow` | Label/value pair (win chance, multiplier, profit) |
| `SegmentedControl` | Risk / mode / direction — one look for all of them |
| `useBet()` | The bet lifecycle: guard, POST, balance, history, fairness, busy |

`BetPanel` takes amounts as floats. The old shared control floored every input,
which made any stake below 1.00 impossible and turned "½" into a rounding trap
at low balances.

## Migration status

**All 11 Originals now render inside `GameFrame`.** `game-shared.tsx` has been
deleted — its last remaining export, `GameBetControls`, no longer has a caller.

The bet lifecycle is also shared now, via `useBet()`: stake guard, POST,
balance update, history, fairness commitment, busy flag. Each game had its own
copy, and they had drifted — some never recorded the fairness payload, some
left the action button spinning forever when a request threw.

## What the migration uncovered

Migrating the games surfaced defects that were invisible while each one owned
its own shell. These were client-side bugs, so the server-side RTP work above
never touched them.

| Game | Defect | Impact |
| --- | --- | --- |
| **Mines** | POSTed a full bet on *every tile reveal*, plus one on cash-out | Revealing 5 tiles charged **6x the stake** and paid once. Each POST also regenerated the board, so the mine you avoided had no relation to the one that killed you |
| **Crash** | POSTed twice per round — once at start with `cashOutAt: 0`, once on cash-out | Charged **2x the stake**; the opening bet was an unwinnable loss by construction, and the curve on screen came from a different crash point than the payout |
| **Shoot** | Resolved entirely in the browser with `Math.random()`, credited the balance locally | No provable fairness, no enforced RTP, payout settable from the console |
| **Keno** | Same — drew its own numbers and scored locally | Plus it drew **20 from 80** while the server draws **10 from 40**: the odds on screen were never the odds the paytable was solved for |
| **Plinko** | Drew the original *uncalibrated* bin labels (12-high peaked at 420x) | Bins advertised the 251%-RTP tables; the server paid the corrected ones |
| **Wheel** | Drew a fixed 1.2/1.5/1.8/2.0 wedge table | The pointer landed on a wedge reading one multiplier while a different one was credited — indistinguishable from a rigged wheel |
| **Slots** | Hand-copied paytable and a hardcoded "97% RTP" label | Advertised payouts the server no longer paid |

Every payout table a game renders is now derived from `game-math.ts`, so the
number on screen is the number credited. Four tests assert this directly.

### The two games that needed a rules change

Mines and Crash both relied on a progressive, mid-round interaction that a
one-shot `/api/bets` endpoint cannot settle honestly — there is no open round
for the server to attach later picks to, so the client would effectively be
choosing its own multiplier after seeing the outcome.

Both now commit up front: Mines picks its tiles then reveals; Crash sets its
cash-out before the round runs. One bet, one charge, one layout. For Mines this
is also strictly fairer than what it replaced, where the board was reshuffled
between clicks. Restoring a true mid-flight cash-out needs a stateful round API
(open round → cash out), which is a server change, not a UI one.

## Adding a game

1. Put the payout model in `game-math.ts`, generated from `TARGET_RTP`.
2. Add its RTP assertions to `tests/game-rtp.test.mjs`.
3. Resolve the outcome in `/api/bets` — the client never decides an outcome.
4. Render inside `GameFrame`, passing only the game-specific canvas and inputs.
