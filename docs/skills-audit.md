# Skills audit — egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine → TOLS

Audit of every skill in the [Slot & Casino Game Developer Skills for Stake Engine](https://github.com/egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine)
collection, mapped to the TOLS Next.js codebase. Status per skill:
**applied** (implemented in this pass), **present** (already satisfied by the
codebase), **partial** (some rules apply), or **n/a** (targets a different
stack — C++/Pixi/Svelte/Stake RGS).

## Applied in this pass

| Skill | What was implemented |
| --- | --- |
| `rng-crypto-specialist` | Bias-free integer mapping: new `fairIntUnbiased` (rejection sampling over 32-bit HMAC chunks, namespaced `…:u32` stream) in `src/lib/provably-fair-core.ts`; all bounded-range games switched to it (wheel, roulette, keno, mines, blackjack shoe, pool-rush); `/api/fair` verifier now replays full engine outcomes with dual-algorithm support (`outcome` current + `legacyOutcome` float-scaled) so pre-switch bets still verify; crypto core split into a pure, testable module. |
| `rtp-optimizer` / `senior-game-math-engineer` | Simulation-backed RTP evidence: `tests/rtp-simulation.test.mjs` replays the real outcome formulas over 300–400k seeded rolls (dice → 99% ±0.5%, wheel-medium → 94% ±0.5%) with a 99.7% confidence-interval report, plus a uniform-segment spread check. |
| `autoplay-system-designer` | Deterministic stop conditions with explicit reasons (`rounds-limit`, `stop-loss`, `take-profit`, `insufficient-balance`, `manual`, `error`) surfaced on `AutoBetStatus.stopReason`; insufficient-balance is now a graceful stop, never a failed retry loop; pure math extracted to `src/lib/auto-bet-math.ts` + contract tests (`tests/auto-bet.test.mjs`): rounds clamped [1,1000], stake never below min, non-negative stops. |
| `css-motion-designer` | Brand-palette motion recipes in `globals.css`: idle spark grid (step-animated, mix-blend overlay on the hero carousel), win accent scan (one lime band in WinCelebration, behind the payout card), loading orbit (conic sweep on busy `BetButton` via `::after`), inter-round sweep utility — all gated by `prefers-reduced-motion`. |
| `telemetry-analytics` | Structured product telemetry: `TelemetryEvent` model (event, userId, sessionId, props, url, createdAt + indexes), public `POST /api/telemetry` (rate-limited, validated, batched ≤50, fire-and-forget), client `track()` (`src/lib/client-telemetry.ts` — sendBeacon + buffer + pagehide flush), wired to `navigate`, `game_open`, `auth`. |
| `low-latency-systems` | Edge caching on the public read paths the lobby polls: `/api/games-lobby` `s-maxage=60` + SWR 600, `/api/casino-stats` `s-maxage=15` + SWR 60, `/api/jackpot` `s-maxage=30` + SWR 120 — repeat lobby mounts skip the DB read. |
| `slot-qa-engineer` | Three new `node --test` suites: `tests/provably-fair.test.mjs` (commitments, determinism, nonce monotonicity, bias-free uniformity with the legacy mapping compared, stream independence), `tests/rtp-simulation.test.mjs`, `tests/auto-bet.test.mjs`. |

## Already present (no change needed)

| Skill | Where TOLS already satisfies it |
| --- | --- |
| `game-math-director` | `src/lib/game-math.ts` — single choke-point `normalise()` makes miscalibrated tables impossible; targets, tolerances and sign-off gates in `tests/game-rtp.test.mjs` (exact-expectation suite). |
| `rng-crypto-specialist` (core) | SHA-256 commitments published pre-bet, HMAC-SHA256 outcome derivation, CSPRNG server seeds, monotonic per-user nonces, seed rotation revealing old seeds (see `src/lib/provably-fair*.ts`). |
| `turbo-spin-designer` | `quickPlay` global setting — presentation-only by construction (localStorage client state, never read server-side); "never change math, only timing" is structurally enforced. |
| `ui-slot-ux-designer` | Spin-state controls (`BetButton` busy/disabled/repeatable), 44px touch targets, reduced-motion defaults, mobile-first layout. |
| `slot-audio-engineer` | `src/lib/game-audio.ts` + volume toggle, per-game SFX mapping, `soundEnabled` preference; win celebration audio ducking in `GameFeedback`. |
| `event-animation-designer` | Framer Motion timelines with explicit durations/easing per tier in WinCelebration, AchievementToast; interruption via AnimatePresence + reduced-motion static fallbacks. |
| `slot-vfx-artist` | Particle systems capped per tier (confetti/coins/ambient), transform+opacity only, mobile particle budget halved. |
| `slot-ui-studio` | Shared primitives: `BetButton`, `StatRow`, `GameFrame`, `tols-game-card` chrome reused by games, lobby and promos. |
| `ux-retention-designer` | Daily streak, achievements, weekly race, VIP ladder — all data-backed with clear state transitions. |
| `freud-detection-ai` (partial) | Admin `RTP & Outcome Control` + action logging give operator-side visibility; a model-scored anomaly pipeline is future work. |

## Not applicable (different target stack)

| Skill | Why |
| --- | --- |
| `cpp-engine-core`, `cpp-performance-engineer` | C++ engine internals; TOLS games are DOM/SVG/TypeScript. |
| `parallel-computing` | CPU threading; the only parallelism here is async I/O + Next.js edge. |
| `wasm-integration` | No WebAssembly modules in the pipeline. |
| `pixi-svelte-integrator` | Svelte + PixiJS specific. |
| `stake-game-developer`, `stake-platform-architect`, `stake-engine-game-builder` | Stake RGS contract/currency scaling; TOLS uses its own `/api/bets` + Prisma ledger. |
| `provider-integration` | Only relevant when a real third-party game provider is added (the EuroVirtuals adapter is the future landing spot). |
| `book-generator`, `book-factory`, `game-info-author` | Slot reels/books pipelines; TOLS Originals are math-table games. |
| `slot-mechanics-designer`, `ai-game-designer`, `ai-game-developer`, `ai-slot-game-developer` | Design-process skills for building new slot titles/AI agents, not runtime optimizations. |
| `multi-agent-orchestrator`, `studio-scaling` | Team/agent orchestration, not app code. |

## Verification

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json
NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build
node --test tests/provably-fair.test.mjs tests/rtp-simulation.test.mjs tests/auto-bet.test.mjs tests/game-rtp.test.mjs
```

Note: `prisma generate` (schema adds `TelemetryEvent`) must run in an
environment with access to binaries.prisma.sh; the sandbox stub is
dev-only and not part of the repo.
