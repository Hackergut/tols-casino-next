# Bonus money / wagering system — Casino ↔ Governance

Bonus money is **real value** credited by Governance (or an operator), but for
the casino it is **not withdrawable** until the player has wagered a required
amount (the "playthrough"). Until then it is still **playable**: bets are funded
from real balance first, then bonus, and every stake counts toward release.

- Winnings are **non-sticky** — they always credit the real, withdrawable balance.
- Only the bonus **principal** is locked behind the wagering requirement.

## Data model (Prisma)

- `CasinoWallet.bonusBalance` — locked bonus available to play.
- `CasinoWallet.wageringRemaining` — total stake still to be wagered before release.
- `BonusCredit` — audit ledger: one row per grant (`amount`, `multiplier`,
  `status` = active/released/forfeited, `source`, `reason`, `expiresAt`).

Apply with `npm run db:push` (the Vercel build runs `prisma generate` only).

## How it works

1. **Credit** — Governance POSTs `governance.bonus_credit`. The casino:
   - `bonusBalance += amount`
   - `wageringRemaining += amount * multiplier`
   - writes a `BonusCredit` row, publishes `bonus:update` SSE.

2. **Play** — every bet debits real balance first, then bonus
   (`src/lib/bonus.ts` `applyBetDebit`), and reduces `wageringRemaining` by the
   stake. Validation uses the combined playable balance (`real + bonus`).

3. **Release** — the moment `wageringRemaining` reaches 0, all remaining bonus
   moves into `balance` (withdrawable), the active credits are marked
   `released`, and `casino.bonus_released` is pushed out to Governance.

## Governance → Casino (inbound webhook, HMAC-signed)

`POST /api/bridge/webhook` with `X-Bridge-Signature: sha256=<hmac>`:

```json
{ "type": "governance.bonus_credit", "payload": {
    "userId": "<casino user id>",
    "amount": 100,
    "multiplier": 20,
    "reason": "promo",
    "expiresAt": null
} }
```

Handled in `src/app/api/bridge/webhook/route.ts` → `creditBonus()`. Registered
in `isKnownInboundType()`.

## Casino → Governance (outbound)

| Event | When | Payload |
|---|---|---|
| `casino.bonus_released` | wagering completes and bonus converts to real | `{ userId, amount, balance }` |

Pushed via the existing `pushBridgeEvent()` from both bet paths
(`settle-bet.ts` instant bets and `game-rounds.ts` interactive bets).

## Operator surface (this repo)

Same semantics as the bridge, for direct admin use / testing:

- `GET /api/admin/bonus` — all bonus credits.
- `POST /api/admin/bonus` — `{ userId, amount, multiplier?, reason?, expiresAt? }`.

## Player endpoints / UI

- `GET /api/bonus` — `{ bonusBalance, wageringRemaining, balance, availableBalance, credits[] }`.
- `GET /api/wallet` and `GET /api/auth/me` — now include `bonusBalance` and `wageringRemaining`.
- Real-time: `bonus:update` SSE event over `GET /api/events`.
- UI: the **Wallet** section shows bonus balance + wagering remaining; the
  header shows a bonus badge when bonus is active; in-game balance reflects the
  combined playable amount.

## Real-time

`src/lib/realtime.ts` — added `bonus:update`. The existing SSE gateway forwards
it to the matching player (in-process bus; Redis pub/sub for multi-instance,
same as the existing balance events).
