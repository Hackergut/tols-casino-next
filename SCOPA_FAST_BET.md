# Sicilian Scopa — Fast Bet

A "Fast Bet" casino minigame built on Sicilian Scopa: the player **does not play
Scopa** — they bet on the outcome of an automatic round between two virtual hands
(**Player** and **Bank**) under a fixed, published strategy. The whole round is a
pure function of a deck shuffled with the provably-fair stream (HMAC-SHA256), so
every round is verifiable after the fact.

---

## 1. Implemented rules (fixed, published strategy)

40-card Sicilian deck (Coins, Cups, Swords, Clubs × 1…10, with Queen=8, Knight=9,
King=10). Historical Primiera values (7→21, 6→18, Ace→16, …).

For every play, in priority order:

1. **Sweep** — capture every card on the table, if possible;
2. **Seven of Coins** — otherwise capture the 7 of Coins, if possible;
3. otherwise, among all legal captures, the one with the **most Coins**, then
   (tie) the **highest total captured value**;
4. otherwise **discard the lowest card** (value, then suit).

Scoring (§1.3 of the spec): +1 to whoever takes more cards, +1 to whoever takes
more Coins, +1 for the Seven of Coins, +1 for the highest Primiera, +1 per Sweep.
A tie in a category = no point. Equal total → **Draw (X)**.

### Correction to the original spec

The draft code had a domain bug: at the end of the round the cards left on the
table were never assigned, so they could remain **uncaptured** (and the Seven of
Coins could belong to no one, invalidating the "Seven of Coins" category and the
card/coin counts). The **standard Scopa rule** was applied: whoever made the last
capture takes the remaining cards (fallback to the Bank if nobody ever captured).
With this rule the Seven of Coins always belongs to exactly one side. This final
"sweep" happens in ~93.5% of rounds, so its impact on the probability calculation
is material.

---

## 2. Markets and odds

Monte Carlo simulation with **N = 10,000,000** rounds (≈36,850 rounds/s), using
**the same engine** that runs real bets (`src/lib/scopa.ts`). Standard error ≈
0.0001–0.00016 per market.

| Market | Probability p | SE | p_lower (95%) | p_upper (95%) |
|---|---|---|---|---|
| 1 · Player | 0.41702 | 0.00016 | 0.41672 | 0.41733 |
| 2 · Bank | 0.47778 | 0.00016 | 0.47747 | 0.47809 |
| X · Draw | 0.10520 | 0.00010 | 0.10501 | 0.10539 |
| Over 4.5 | 0.69811 | 0.00015 | 0.69782 | 0.69839 |
| Under 4.5 | 0.30189 | 0.00015 | 0.30161 | 0.30218 |
| Seven of Coins · Player | 0.51110 | 0.00016 | 0.51079 | 0.51141 |
| Seven of Coins · Bank | 0.48890 | 0.00016 | 0.48859 | 0.48921 |
| Sweep Over 0.5 | 0.78485 | 0.00013 | 0.78459 | 0.78510 |

The Bank (second to act) has a real structural edge (47.8% vs 41.7%), consistent
with the known two-player Scopa dynamic.

### Final odds (in production, `SCOPA_ODDS` in `src/lib/scopa.ts`)

`odds = floor(0.96 / p_upper)`, where `p_upper` is the **upper** bound of the 95%
confidence interval.

| Market | Odds (floor 2dp) | Effective RTP (worst-case) |
|---|---|---|
| 1 · Player | **2.30** | 95.99% |
| 2 · Bank | **2.00** | 95.62% |
| X · Draw | **9.10** | 95.90% |
| Over 4.5 | **1.37** | 95.68% |
| Under 4.5 | **3.17** | 95.79% |
| Seven of Coins · Player | **1.87** | 95.63% |
| Seven of Coins · Bank | **1.96** | 95.89% |
| Sweep Over 0.5 | **1.22** | 95.78% |

> **Note on the margin.** Section 3 of the spec suggested using the *lower bound*
> of the CI "to guarantee the house margin". That is the wrong direction:
> `odds = 0.96/p` makes the odds rise as p **decreases**, so with p_lower the
> player would be paid more and RTP could exceed the target. With p_upper instead
> it always holds that `RTP = p_true × odds ≤ p_upper × odds ≤ 0.96`, so the house
> margin is guaranteed. The lower-bound table differs by 1 cent only on Bank
> (2.01), Draw (9.14) and Under (3.18).

---

## 3. Provably fair

Same commit-reveal scheme as the rest of the platform (`src/lib/provably-fair.ts`):

1. The server publishes `SHA-256(serverSeed)` before the bet.
2. `nonce` increments per round.
3. `float(cursor) = HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) / 2^52`.
4. The deck is shuffled with **Fisher-Yates** using 39 floats (cursor 0…38).
5. The round is a pure function of the deck → **reproducible**.

Verification: `PUT /api/fair` with `{ game: "scopa", serverSeed, clientSeed, nonce }`
replays the round and returns the deck, moves and score; with `market` it also
returns the outcome and odds. Every bet payload already contains the deck + the
full move trace + the scores.

---

## 4. Files

| File | Role |
|---|---|
| `src/lib/scopa.ts` | Deterministic engine (deck, strategy, scoring, markets, odds) + replay `timeline` |
| `src/lib/scopa-playback.ts` | Pure reducer to rebuild the table from the `timeline` (shared by both UIs) |
| `src/app/api/bets/route.ts` | The `"scopa"` case in the bet engine (resolution + payout + timeline) |
| `src/app/api/fair/route.ts` | Verification replay `PUT /api/fair` |
| `src/casino/components/casino/games/GamePlayer.tsx` | UI in the embedded casino (admin) |
| `src/components/casino/game-scopa.tsx` | UI in the public casino (`/`) |
| `src/app/globals.css` | `.scopa-*` block (table, cards, scoreboard, overlay) in the design system |
| `src/app/page.tsx` | Game registration in the public casino |
| `src/components/lobby/lobby-types.ts` | Entry in `ORIGINAL_GAMES` |
| `src/casino/components/casino/sections/Lobby.tsx` | Icon in the Originals rail |
| `public/games/originals/scopa.svg` | Catalogue artwork |
| `scripts/seed-scopa.mjs` | Registers the game in `casinoGame` |
| `scripts/scopa-sim.mjs` | Monte Carlo simulator (reuses the engine) |

### UX / animations

The server returns the full `timeline` (**deal** + **move** events). The client
replays it as a live round without reimplementing the strategy (pure reducer in
`scopa-playback.ts`): cards dealt with stagger, cards "flying" from the
table/hands to the piles via framer-motion `layoutId`, "SCOPA!" / "SWEEP" flash,
a progressive tally of the 5 scoring categories and a final Win/Loss/Draw banner.
A **Skip** button and `prefers-reduced-motion` shorten the replay. Both surfaces
(public casino and the casino embedded in the admin) share the same reducer and
the same rules, using each surface's design tokens (`--g-*` vs `--color-*`).

---

## 5. Operations

```bash
# 1. register the game in the catalogue (idempotent upsert)
node scripts/seed-scopa.mjs

# 2. recompute probabilities/odds (Node ≥ 22.6)
node --experimental-strip-types scripts/scopa-sim.mjs 10000000

# 3. type/lint check
npx tsc --noEmit && npx eslint src/lib/scopa.ts src/components/casino/game-scopa.tsx
```

## 6. Live launch — runbook

In order, on an environment with network access (Vercel/Supabase — in the local
sandbox the Prisma binary download is blocked):

```bash
# 1. Install (also runs "postinstall: prisma generate")
npm install

# 2. Database: apply the schema (creates/updates all tables, incl. CasinoGame)
npm run db:push        # or "prisma migrate deploy" if you use migrations

# 3. Bootstrap the admin operator (required for /control/admin)
node scripts/seed-admin.mjs --email=ops@tols.gg --password=Secret123

# 4. Register the game in the catalogue (idempotent upsert)
node scripts/seed-scopa.mjs

# 5. Build + start
npm run build
npm run start
```

Minimal `.env` config (see `.env.example`): `DATABASE_URL`, `DIRECT_URL`,
`APP_URL`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`. Keep `ALLOW_OUTCOME_CONTROL=false`
in production (disables force win/lose — see `src/lib/game-control.ts`).

### End-to-end verification

1. **Public lobby (`/`)** → *TOLS Originals* section → **Sicilian Scopa** card
   (image `public/games/originals/scopa.jpg`).
2. Open the game → pick a market (1X2 / Over-Under / Seven of Coins / Sweeps) →
   place a bet: the automatic round animates (dealing, captures, "SCOPA!" flash)
   and the result is shown with the 5-category tally.
3. **Admin** → *Casino Lobby* → Scopa (same engine, UI with the admin tokens) and
   *Games Catalog* for toggling/RTP (the row has `gameType: "original"`,
   `category: "originals"`, `alias: "scopa"`).
4. **Provably fair**: the bet returns `serverSeedHash`/`clientSeed`/`nonce`;
   after rotating the seeds (`POST /api/fair {rotate:true}`), `PUT /api/fair`
   with `{game:"scopa", serverSeed, clientSeed, nonce}` replays the round and
   returns deck + moves + score to compare against the saved payload.
5. **Generic flows already active for Scopa**: live bets feed, bet history,
   house earnings, jackpot (+0.5% stake), VIP/XP sync, rate limiting and
   responsible-gaming limits.

### Integrations completed for launch

- **Build unblocked**: created the missing admin module
  `src/components/admin/modules/deposit-addresses-page.tsx` (it was referenced by
  `control/admin` and absent → blocked `next build`); fixed the Recharts tooltip
  type in `ops/live-monitor-page.tsx` (type errors block the build on Vercel,
  where `ignoreBuildErrors=false`).
- **`/api/games`**: the response now includes `slug` and `image` (aliases of
  `alias`/`imageUrl`) so the casino embedded in the admin (Lobby, GamesGrid,
  Sidebar) maps games correctly, Scopa included.
- **Casino sidebar**: "Scopa" entry added to *TOLS Originals*.
- **Assets**: `scopa.jpg`/`scopa.png` rasterized from `scopa.svg` (the lobby card
  no longer falls back/404s).

## 7. Certification (production)

Per spec §6.2: for real production launch, re-run the simulation with
N ≥ 100,000,000, freeze the odds, and have the RTP/RNG/seed audit certified by an
accredited laboratory (GLI/BMM/eCOGRA), with the round history and the
responsible-gaming tools already present on the platform.
