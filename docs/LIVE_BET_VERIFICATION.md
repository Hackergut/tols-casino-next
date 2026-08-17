# Live bet verification

## 2026-08-17 — production

The bet guards introduced in PR #2 were exercised against the deployed
production route at `https://www.tols.fun/api/bets`, not against a mock or a
local Prisma instance.

A one-shot verifier ran during Vercel preview build `950b404` and completed
successfully. It created the clearly-labelled account
`arenaqa_mswxbd0v_008`, used its promotional wallet, and made the following
authenticated requests while checking the wallet before and after every
rejection:

| Case | Expected production result |
| --- | --- |
| Raw JSON `NaN` token | `400 Invalid body`; balance unchanged |
| Valid JSON exponent `1e999` (materialises as `Infinity`) for stake | `400 Invalid stake`; balance unchanged |
| Stake `0.004` | `400 Invalid stake` after cent rounding; balance unchanged |
| Stake `100000.01` | `400 Maximum stake is 100000`; balance unchanged |
| Stake exactly `100000` | Passed the inclusive cap, then `400 Insufficient balance`; balance unchanged |
| Crash target `1000000.01` | `400 Invalid cash-out target`; balance unchanged |
| Limbo target `1e999` | `400 Invalid target multiplier`; balance unchanged |
| Limbo stake `0.014`, target `2.345` | Accepted as a real bet; response echoed stake `0.01` and target `2.35` |

The accepted bet was persisted as `cmswxbm5f0007ky04wkt7mlvd`. It lost with a
zero payout, moving the wallet from `10` to `9.99`. The verifier asserted that:

- the response's `newBalance` equalled `balance - charged stake + payout`;
- a fresh `GET /api/auth/me` returned the same settled balance;
- stake, payout, and resulting balance were finite;
- all rejected requests left the wallet unchanged.

The public production feed independently exposes the persisted settlement as a
Limbo bet for `arenaqa_mswxbd0v_008`, amount `0.01`, at
`2026-08-17T07:40:02.403Z`.

## Re-running

`scripts/verify-live-bets.mjs` is intentionally destructive: every run creates
one QA account and places one one-cent bet. It refuses to start unless the
operator explicitly sets `ALLOW_LIVE_BET_TEST=1` and should only be run against
a deployment whose test wallet policy is understood.
