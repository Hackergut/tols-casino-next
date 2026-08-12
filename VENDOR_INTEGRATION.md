# Vendor games — seamless-wallet integration

TOLS keeps the balance; the vendor runs the game and calls back for every money
movement. This is the generic contract — a specific aggregator (SoftSwiss,
Hub88, Slotegrator, Pragmatic direct, …) needs a thin adapter mapping its field
names and signature scheme onto the endpoints below.

## Endpoints

| Endpoint | Who calls it | Purpose |
|---|---|---|
| `POST /api/vendor/launch` | your frontend (signed-in player) | mint a launch token, get the game URL |
| `POST /api/vendor/callback` | the **vendor's** server | balance / bet / win / rollback |

## Configure (env)

| Variable | Required | Notes |
|---|---|---|
| `VENDOR_CALLBACK_SECRET` | yes | ≥16 chars. Shared with the vendor; signs callbacks (HMAC-SHA256). |
| `VENDOR_LAUNCH_SECRET` | no | Defaults to the callback secret. Signs launch tokens. |
| `VENDOR_ALLOWED_IPS` | no | Comma-separated vendor server IPs. Empty = rely on signature only. |

Set the same values on Vercel (Production) and locally in `.env`.

## What to give the vendor

- **Callback URL:** `https://tols.fun/api/vendor/callback`
- **Shared secret:** the value of `VENDOR_CALLBACK_SECRET`
- **Signature:** `X-Signature: hex(HMAC_SHA256(rawRequestBody, secret))`

## Callback contract

```
POST /api/vendor/callback
Header: X-Signature: <hmac-sha256 hex of the raw body>
Body:   { "action": "...", "token": "<launch token>", ... }
```

| action | extra fields | effect |
|---|---|---|
| `balance` | — | returns the player balance |
| `bet` / `debit` | `amount`, `txId`, `roundId?` | atomic debit, cannot go negative |
| `win` / `credit` | `amount`, `txId`, `roundId?` | atomic credit |
| `rollback` / `refund` | `refTxId`, `txId` | reverse a prior bet/win |

Response: `{ "status": "OK", "balance": 123.45, "currency": "USDT", "txId": "..." }`
or `{ "status": "ERROR", "code": "INSUFFICIENT_FUNDS", "message": "..." }`.

**Guarantees:** every mutation is keyed by the vendor's `txId` — replays return
the stored result (never double-spend); bets can't take a balance below zero;
a failed idempotency insert rolls back the wallet change in the same transaction.
All movements are recorded in the `VendorTxn` ledger for audit.

## Launch flow

```
1. Player opens a vendor game → frontend POSTs /api/vendor/launch { gameId, vendor }
2. Server returns { token, callbackUrl }
3. (vendor adapter) call the vendor's launch API with token + callbackUrl → game URL
4. Embed the game URL in an iframe
5. The vendor calls /api/vendor/callback with the token during play
```

## Adapting to a specific aggregator

Two small changes:
1. **Signature** — if the vendor signs differently (e.g. HMAC over sorted params,
   or an `Authorization` header), adjust `verifySignature` in `src/lib/vendor-wallet.ts`.
2. **Field names** — the callback already accepts common aliases (`transactionId`,
   `betTxId`); add any others in `src/app/api/vendor/callback/route.ts`.

Tell us which aggregator and we wire the exact adapter.
