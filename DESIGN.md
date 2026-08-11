# GoldenX — design tokens & motion conventions

Source of truth: the `@theme inline` block in `src/app/globals.css`. `tailwind.config.ts` is deleted — Tailwind v4 never read it (v3 syntax), and it was the root cause of `text-lime`/`bg-lime` resolving to nothing.

## Color

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | oklch(0.165 0.018 277) | page ground |
| `--surface` | oklch(0.205 0.024 277) | cards, sidebar, header |
| `--surface-raised` | oklch(0.245 0.027 277) | hovers, inputs, nested cards |
| `--overlay` | oklch(0.29 0.03 277) | popovers, modals, tooltips |
| `--lime-50…600` | ramp around #ccff00 | 300 = brand; only fill step |
| `--win / --loss / --pending` | lime / #ff4d5e / #ffc53d | bet outcomes |
| `--vip` | #9184d9 | premium surfaces only |

Rules: lime on ~5% of pixels, always meaning money or action. Text in lime only at 300 or lighter. Fills only at 300 (`bg-lime`), with `text-bg` ink. Hovers/glows use 400–600. Never a new hardcoded hex — Tailwind classes (`bg-surface`, `text-lime`, `border-border-strong`) or `var(--color-*)`.

Canvas contexts (game engines) cannot read `var()` — resolve once per mount:
`const lime = getComputedStyle(document.documentElement).getPropertyValue("--lime-300")` (Phase 4 wires a shared helper).

## Type

Inter for UI (500; headings 600). **Geist Mono for every number that is money, odds, a multiplier or a hash**, always `font-variant-numeric: tabular-nums`. Scale: 11 / 12 / 13 / 15 / 18 / 22 / 28 / 40.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120ms | hover, press, focus |
| `--dur-base` | 240ms | reveals, tabs, entrances |
| `--dur-slow` | 480ms | overlays, celebrations |
| `--ease-out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | CSS exits/fades |
| spring.snappy | stiffness 500, damping 32 | default interactive |
| spring.soft | stiffness 300, damping 28 | layout, sidebar, modals |
| spring.bounce | stiffness 600, damping 18 | landings (coins, wheel) |

Conventions: animate transform + opacity only. rAF owns game-critical timing; Framer Motion owns reactive skin. Every animated component calls `useReducedMotion()` and renders a static end-state. Particle cap: 50 below 768px. Focus: 2px lime ring, offset 2, on every interactive element.

## Phase 1 receipts (2026-08-09)

- `#ccff00` hardcodes: **338 → 100** (survivors are canvas fill/stroke contexts in game engines, migrated in Phase 4: 9 files)
- Inline `style={{}}` objects: **902 → 898** (bulk conversion continues per-component in Phases 2–4; survivors are dynamic values)
- `tailwind.config.ts` deleted; `@theme inline` is the single source of truth

## Phase 2 receipts

- Signature primitive: `src/casino/components/casino/PostedAmount.tsx` (digit roll + posted tick); motion presets in `src/casino/lib/motion.ts`
- Header: balance on PostedAmount, currency switcher with token brand colors, layoutId nav underline
- Sidebar: spring collapse (68px rail), layoutId active-route indicator
- LiveBetsFeed: AnimatePresence rows (stagger in, push down); JackpotTicker: odometer digits
- Lobby shell extracted from 868-line `page.tsx` into `src/components/lobby/*` (10 files, behavior unchanged); page.tsx now 300 lines
- Oswald display font dropped from chrome (Inter per type pairing); win/loss states moved to `--win`/`--loss` tokens

## Phase 3 receipts

- GameCard: Framer Motion rebuild — 3D tilt toward cursor (spring, ≤8°), spring scale/press, motion shimmer sweep, badge entrance stagger, skeleton shimmer until thumbnail load, reduced-motion static fallback
- GamesGrid: staggered mount + `layout` animations on filter change (cards fly, never snap); provider filter uses a sliding layoutId pill
- Lobby: hero jackpot on odometer digits; dead utility classes (`bg-grid-lime`, `text-glow-lime`, `animate-scan`) and all inline lime styles removed; emoji headers → Phosphor-style lucide icons; purple → `--vip`, red → `--loss`
- LobbyView (lobby shell): category tabs slide with layoutId
- GameDetailModal: de-Oswalded; chart + stat colors from tokens (`--win/--loss/--vip/--pending`)

## Phase 4 receipts (game juice)

All nine engines are DOM/SVG (no canvas) — rAF loops kept for game timing, Framer Motion + timed SMIL layered for reactive visuals; every game checks `useReducedMotion()` and renders a static end-state.

- Crash: lime gradient area fill, glow stroke, comet head + fading trail, grid parallax tied to the multiplier, curve shatter + shake + red flash on bust, readout scales with value (log, capped 1.4×)
- Mines: true 3D tile flips (spring, backface), gem sparkle burst, bomb shockwave ring, cascade reveal of remaining mines on loss
- Plinko: squash-and-stretch ball at peg cadence, per-row peg pulse timed to the drop, slot glow proportional to multiplier, lagging trail
- Wheel: motion blur at speed, keyframed spring-settle overshoot (+9° then back), pointer tick deflection decelerating with the wheel
- Dice/Limbo: scramble + eased roll-up kept on rAF, result slam-in (scale 1.7→1 on expo), live win/loss gradient on threshold slider retinted to lime/red
- Coinflip: rotateX flip kept, added coin edge disc, landing squash-and-stretch, static-face fallback
- Keno: selection pop + sequential draw kept, hit burst vs quiet fade differentiates by motion; instant reveal under reduced motion
- Shoot: muzzle flash overlay, board recoil kick, impact particles
- `#ccff00` hardcodes: **338 → 0** across src/ (Phase 1: 338→100; Phase 4 finished the game files); win zones retinted from green to `--win` lime
- Balance displays in all nine games moved onto the PostedAmount signature

## Phase 5 receipts (celebration system)

- WinCelebration rebuilt on Framer Motion with four tiers: small (<2x) inline pulse chip, medium (2-10x) radial confetti burst + card glow, big (10-50x) full-screen overlay + coin shower + counter roll-up + dim, massive (50x+) adds radial shockwave, letterbox bars and sustained ambient particles. Payout posts with the signature hairline after the roll-up settles.
- Particle budget halved under 768px (hard cap 50); every tier has a reduced-motion static fallback.
- AchievementToast rebuilt on the same springs (soft entrance, bounce icon pop); queue logic untouched.
- Final counts across casino surfaces (56 files): `#ccff00` hardcodes **0**, inline `style={{}}` objects **638** (survivors are dynamic values: avatar colors, computed geometry, per-frame transforms).

## Phase 6 receipts (structural + production hardening, 2026-08-09)

Correction to Phase 4/5 counts: "0 hardcoded hex" only counted the literal
string `ccff00`. A wider audit found 314 decimal-RGB lime values
(`rgba(204,255,0,…)`), ~200 legacy palette hexes, and 154 dead `font-[Oswald]`
classes (Oswald was never loaded; silent fallback). All codemodded across 44
files to `var(--color-*)` / `color-mix(in oklab, …)`. Survivors are data-domain
colors only (wheel segment palette, crypto brand colors, confetti arrays,
avatar seeds).

- Reduced-motion: Header, GamePlayer wired to `useReducedMotion()`; plinko ball
  in GamePlayer converted from left/top keyframes to transform-only pixel
  keyframes measured from a board ref.
- All 20 legacy sections get uniform entrance/exit motion via one
  `AnimatePresence` wrapper at the shell (`casino-lobby-page.tsx`), keyed on
  active section.
- Sidebar width animation: reviewed and kept as the one sanctioned
  non-transform animation (collapse cannot be expressed as a transform without
  distorting content); instant under reduced motion.
- Schema: 10 models added that API routes referenced but never existed
  (Affiliate, Referral, CommissionLog, Tournament, TournamentEntry, CardPack,
  CollectibleCard, CardPull, MarketListing, ResponsibleLimit). Affiliate,
  tournaments, packs, marketplace, and limits routes were guaranteed runtime
  crashes before this.
- TypeScript: 108 errors → 0. Highlights: zustand curried `create<T>()()` for
  persist+partialize, React 19 `useRef(undefined)` signatures, react-query v5
  `defaultOptions.queries`, DataTable generic relaxed to `{ id: string }`,
  Prisma create inputs typed, null-narrowing captured before closures.
- `next build` passes; smoke test: `/`, `/api/tournaments`, `/api/packs`,
  `/api/marketplace`, `/api/limits`, `/api/affiliate` all 200 with live DB.
- Hygiene: `.env` path made relative (was leaking a homedir), `.env.example`
  added, `examples/`, `mini-services/`, `tests/` excluded from typecheck.

## Phase 7 receipts (auth, crypto deposits, telegram monitoring, 2026-08-09)

### Auth (login + registration)
- `src/lib/auth.ts`: bcrypt hashing, signed HTTP-only cookie sessions (30d),
  getCurrentUser / requireUser / destroySession.
- Routes: /api/auth/{register,login,logout,me}. Validation (username 3–20
  alnum+underscore, email format, 8-char min password), uniqueness checks,
  uniform "Invalid credentials" to prevent account enumeration, referral-code
  attachment on signup.
- AuthModal.tsx: tabbed sign-in/register, layoutId tab slider, password reveal,
  reduced-motion aware. Mounted in shell.
- Header: Sign in/Register for guests, Sign out when authed. getSession() now
  prefers the real user, demo fallback for guests.
- New AuthSession model + /api/session route (header was fetching it but it did
  not exist — latent break fixed).

### Deposits (static addresses, QR, watch-only)
- SECURITY: no seed phrase or private key on the server, by design. Admin pastes
  PUBLIC receive addresses via PUT /api/admin/deposit-addresses, which rejects
  anything resembling a 12+ word seed phrase.
- DepositAddress model; chains.ts covers btc, eth, usdt_erc20, solana, polygon
  with per-chain payment URIs.
- /api/deposits/address returns address + generated QR (qrcode dep).
- DepositModal rebuilt: QR display, copyable address, memo warning, confirmation
  count, auth-gated.
- Deposits are NOT auto-credited: POST /api/deposits records pending; crediting
  only via POST /api/deposits/confirm (admin, idempotent, after confirmations).
- Withdrawals changed from auto-complete to pending + balance hold + manual
  approval (the old flow paid real money with zero review).

### Telegram monitoring
- src/lib/telegram.ts: fire-and-forget alerts, persisted to TelegramNotification
  (audit trail survives delivery failure; marked "unconfigured" when env unset so
  nothing drops silently).
- Wired into registration, login, deposit_pending, deposit (confirmed),
  withdrawal. Config via TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / TELEGRAM_THREAD_ID.

### Verified (runtime smoke, timeboxed server)
- session 200, register 200, dup 409, weak-pw 400, bad-login 401,
  deposit-address noauth 401 / authed 200 (+QR data-URI), deposit → pending 200.
- Telegram audit rows persisted for registration + deposit_pending.
- 0 TypeScript errors; next build passes.

### New env
- TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID (see .env.example).
- Deposit addresses set at runtime via admin API, not env.

### Still on the operator
- Set public receive addresses via the admin endpoint before deposits work.
- Licensing, KYC/age verification, and legal sign-off before real money. Not
  something code provides.

## Phase 9 receipts (3D tiles + RTP/outcome control, 2026-08-09)

### 3D game tiles
- Each of the 9 originals now renders a distinct lit, rotating WebGL object via
  the existing Game3DTile (raw three.js r160): finned rocket + exhaust (crash),
  layered gold coin (coinflip), dual pipped dice (dice), faceted gem (mines),
  segmented wheel (wheel), target rings + bullseye (shoot), ball-above-pegs
  (plinko), ball cluster (keno), teal icosahedron (limbo).
- Architecture kept from existing tile: IntersectionObserver spins up WebGL only
  when visible, disposes off-screen, honors reduced-motion, and always layers over
  the SVG poster as fallback (so tiles look polished even without WebGL).
- Removed a redundant @react-three/fiber+drei dependency (49 pkgs) — the raw-three
  tile is the better performer for a 9-tile grid.
- All 9 geometries validated; next build compiles the component.
- LIMIT: these are real-time 3D from geometry, NOT rendered illustration/character
  key art (no image-generation capability here). Composition informed by current
  crash/slot tile conventions via web search; no third-party art copied.

### RTP / outcome control (internal prototype)
- GameControl model: precedence user_game > user > game > global; priority + recency
  tie-breaks. Modes: force_win, force_lose, rtp (0..2 hot/cold bias), streak
  (N wins then M losses, cycling), normal. Optional forcedMultiplier.
- Wired into /api/bets for all 9 games: overrides the fair result AFTER computation;
  every bet response carries controlApplied for monitoring.
- Admin CRUD at /api/admin/game-controls (admin-gated); console page
  "RTP & Outcome Control" to create/toggle/reset/delete rules with live
  betsAffected + streakPos counters. /api/admin/users added for the user picker.
- VERIFIED end-to-end against a running server:
  - force_lose (user+game): 6/6 bets forced L, each tagged (force_lose)
  - force_win w/ mult 3: 5/5 bets W@3
  - streak 2W/3L: exact "W W L L L W W L L L" cycle
  - counters: 10 & 5 betsAffected, streakPos cycled to 0
- SAFETY: overrides the provably-fair result. UI carries a warning banner; it is
  an internal team analysis tool and must never be enabled on a public real-money
  deployment (forcing outcomes there would be fraud).

## Phase 10 receipts (painted art wired in, 2026-08-09)

Received 36 FLUX-generated PNGs (9 tiles, 5 mascot poses, 6 icons, 4 banners,
3 backgrounds) and wired them into the app.

### Tiles (the win)
- 9 painted tile PNGs → public/games/originals/*.png alongside the SVGs.
- Game3DTile gains a `posterSrc` prop: prefers the painted PNG, falls back to
  the SVG poster on error, 3D still layers over when visible. Card passes the PNG.
- DB catalog originals updated to imageUrl=/games/originals/{slug}.png so the
  main lobby grid shows the painted art too.
- Quality: dice, mines-gem, coinflip, wheel, limbo excellent; crash reads a bit
  like a mountain not a rocket, greens skew emerald vs brand lime — regenerate
  those two prompts if you want tighter brand match (script + prompts in artpack).

### Other art
- art.ts manifest maps every asset to a path (one place to swap files).
- Mascot.tsx: painted mascot with pose prop (hero/wave/win/think/vip), used in
  the game loading state. NOTE: FLUX seed-lock did not hold character identity —
  poses hero/wave/think are on-model, win/vip drifted to different characters.
  Usable subset; regenerate win/vip with an image-to-image or a locked reference
  for full consistency.
- Banner.tsx: painted promo banner with headline/CTA overlay (left negative
  space matches the generated art). All 4 banners strong.
- Icons copied to public/art/icons but mixed quality (gem clean; others muddy) —
  left in the manifest, not wired into UI yet; regenerate before using.
- Backgrounds copied to public/art/backgrounds, available via manifest.

### Verified
- 0 TypeScript errors; next build passes; tiles render with card overlay.

## Phase 11 receipts (admin UI/UX polish + password, 2026-08-09)

### Access
- Admin lives at /control/admin (unchanged) with a localStorage-gated login.
- Password set to **Admin2024** (was lowercase admin2024). Overridable via
  NEXT_PUBLIC_ADMIN_PASSWORD. Verified Admin2024 is the active value in the
  built bundle and the route serves HTTP 200.

### Login gate — rebuilt to premium brand
- Radial-gradient backdrop + ambient lime/vip blur blobs.
- Glass card (backdrop-blur, lime-tinted border, layered shadow + lime glow).
- Lime gradient shield badge; title "Control Panel"; subtitle.
- Password field with Lock icon, show/hide (Eye) toggle, autofocus, autocomplete.
- Loading spinner on submit (350ms deliberate delay); branded inline error box;
  shake animation on wrong password (added @keyframes shake to globals.css).
- "Enter Control Panel" primary button (lime); "Internal team access only" footer.

### Dashboard chrome
- Sticky header bar enriched: "Control Panel" label + pulsing lime "Live" pill on
  the left, "← Back to Casino" on the right, stronger backdrop-blur.
- PageHeader: bottom border, lime underline accent under the title, outline
  "Sign out" button.
- Sidebar already premium (motion, lime glow, categories, theme toggle, mobile) —
  primary token maps to --lime-300 so the whole admin accents in brand lime.

### Verified
- 0 TypeScript errors; next build passes; /control/admin serves 200 with the
  branded gate; Admin2024 confirmed active.
