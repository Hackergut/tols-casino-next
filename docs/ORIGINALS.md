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
| Slots | — | 96.98% | 2dp rounding drift off the 97% target |
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
export const HOUSE_EDGE = 0.01;      // → 99% RTP across the Originals
export const ROULETTE_RTP = 36 / 37; // structural single-zero edge, exempt
export const SLOTS_RTP = 0.97;       // slots run deeper, as they do offline
```

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

`npm test` runs 81 RTP assertions. Every generated table is checked to return
exactly 99.0000% (within a cent of rounding tolerance), plus the structural
properties:

- Plinko: symmetric, every slot pays, edges pay more than the centre, and
  higher risk means a wider spread — *at the same RTP*.
- Wheel: higher risk means fewer and larger wins, no sub-1x "wins".
- Mines: correct for all 300 valid (mines, picks) combinations.
- Dice: flat 99% at every win chance from 1% to 98%, and never above 100% at
  the extremes.
- Crash: flat 99% at every cash-out target, verified by integration.
- Roulette: keeps its real 97.297% single-zero edge rather than being forced
  to 99%, because paying 35.6:1 on a straight-up would be unrecognisable.

Note on the crash bust rate: `P(point === 1.00)` is ~1.98%, about twice
`HOUSE_EDGE`. That is the 2dp floor collapsing the sliver just above the bust
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

`BetPanel` takes amounts as floats. The old shared control floored every input,
which made any stake below 1.00 impossible and turned "½" into a rounding trap
at low balances.

## Migration status

`game-dice.tsx` is the reference implementation — it contains only the target
slider, the over/under choice and the roll readout; everything else is the
frame.

Remaining to migrate: crash, limbo, coinflip, plinko, mines, wheel, keno,
shoot, slots, roulette. **Their maths is already fixed** (that lives on the
server, in `/api/bets`), so this is presentation work only, and each game can
move independently.

## Adding a game

1. Put the payout model in `game-math.ts`, generated from `TARGET_RTP`.
2. Add its RTP assertions to `tests/game-rtp.test.mjs`.
3. Resolve the outcome in `/api/bets` — the client never decides an outcome.
4. Render inside `GameFrame`, passing only the game-specific canvas and inputs.
