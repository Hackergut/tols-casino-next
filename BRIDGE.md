# TOLS — Casino ↔ Governance Bridge (hackguts-projects)

> **2 REAL Vercel projects, team `hackguts-projects`**
> - **Casino** → `tols-casino-next` → https://vercel.com/hackguts-projects/tols-casino-next
> - **Governance** → `tolsgovernz` → https://vercel.com/hackguts-projects/tolsgovernz
>
> Separate git repos, separate deploys. The bridge is **service-to-service HTTPS** (HMAC + JWT RS256), NOT via the admin panel.

## Get the REAL domains from Vercel (do not invent them)

Go to each project → **Settings → Domains** and copy the domain Vercel shows:

- **Casino** → e.g. `https://www.tols.fun` (official)
- **Governance** → `https://gov.tols.fun` (or `https://tolsgovernz-hackguts-projects.vercel.app`, or custom if configured)

You will use those 2 URLs as `APP_URL` (Casino) and `GOVERNANCE_TOWER_URL` (Governance). **Do not use invented `tower.dev.fun` / `tower.tols.fun`.**

## Architecture

```
  Vercel hackguts-projects/tols-casino-next        Vercel hackguts-projects/tolsgovernz
  (Casino)                                          (Governance)
       │                                                   │
  Tower ──POST /api/bridge/webhook (HMAC)─────────────► Casino
       │  governance.rtp_update → OperationControl
  Casino ──POST /api/platform/* (JWT RS256)─────────► Tower shows real data (no mockups)
       │  GET /api/platform/deposits, /withdrawals, /payments, /stats
       │  POST /api/platform/withdrawals/:id/approve|reject
```

The RS256 JWT is what **removes the mockups**: Governance signs with `PLATFORM_JWT_PRIVATE_KEY`, the Casino verifies with `PLATFORM_JWT_PUBLIC_KEY`.

## Env — on BOTH Vercel projects (same secret, different keys)

Generate the secret ONCE:
```bash
openssl rand -hex 32
# → a1b2c3... (64 hex)
# RS256 keypair already generated in .env.bridge-keys (PRIVATE on Governance, PUBLIC on Casino)
```

| Var | Where | Real example | Notes |
|-----|-------|--------------|-------|
| `GOVERNANCE_TOWER_URL` | **both** | `https://gov.tols.fun` | Copy from Vercel → tolsgovernz → Domains. Alias `TOWER_URL`. |
| `APP_URL` | **both** | `https://www.tols.fun` | Copy from Vercel → tols-casino-next → Domains. On Governance it is used for CORS. |
| `GOVERNANCE_BRIDGE_SECRET` | **both** | `a1b2c3...` | **Same value** on both. Alias `GOVERNANCE_WEBHOOK_SECRET`. |
| `PLATFORM_JWT_PRIVATE_KEY` | **tolsgovernz only** | `LS0t...` (base64 PEM) | From `.env.bridge-keys` BLOCK 1 — only Governance signs. |
| `PLATFORM_JWT_PUBLIC_KEY` | **tols-casino-next only** | `LS0t...` (base64 PEM) | From `.env.bridge-keys` BLOCK 2 — only Casino verifies. |
| `PLATFORM_JWT_ISSUER` / `AUDIENCE` | both | `tols-governance` / `tols-casino` | Defaults already fine. |
| `DATABASE_URL` / `DIRECT_URL` | Casino only | `...pooler.supabase.com...` | Supabase. |

On Vercel: **Project → Settings → Environment Variables → Production → Add → Save → Redeploy**.

## Runtime connection creation (Admin)

The Casino no longer depends exclusively on env vars. In **Admin → Governance Bridge** there is a real creation flow:

1. configure `CONNECTION_ENCRYPTION_KEY` (or a stable `ADMIN_SESSION_SECRET` of at least 16 characters);
2. enter Governance origin/API base, Casino origin, API key, App key and the shared bridge secret;
3. press **Create connection**: the config is encrypted AES-256-GCM and saved server-side in `PlatformSetting`;
4. press **Test + register**: the Casino verifies the real Governance health endpoint and attempts to register the Casino callback on the endpoints supported by the Tower;
5. after the test, events, sync, webhook and SSO automatically use the active DB connection. Env vars remain only as a recovery fallback.

Admin-only API lifecycle:
- `GET|POST|DELETE /api/bridge/connection`
- `POST /api/bridge/connection/test`

The keys and secret are never returned to the browser; the API exposes only presence and the last four digits of the API keys.

## Deploy — already created, just verify

1. **Casino** `tols-casino-next` → Vercel already shows the deploy. If green, fine. If red, check `DATABASE_URL` and `PLATFORM_JWT_PUBLIC_KEY`.
2. **Governance** `tolsgovernz` → same. Verify that `PLATFORM_JWT_PRIVATE_KEY` is correct base64 (without newlines).

### Bridge verification (after setting env + merging the PR)

```bash
# 1. Casino health (public)
curl https://www.tols.fun/api/platform/health | jq .

# 2. Health with Governance probe
curl "https://www.tols.fun/api/bridge/health?probe=true" | jq .

# 3. JWT whoami (with a token signed by tolsgovernz)
# Generate a token on Governance (node with PLATFORM_JWT_PRIVATE_KEY) then:
curl -H "Authorization: Bearer <jwt>" https://www.tols.fun/api/platform/whoami | jq .
curl -H "Authorization: Bearer <jwt>" "https://www.tols.fun/api/platform/deposits?limit=5" | jq .
curl -H "Authorization: Bearer <jwt>" "https://www.tols.fun/api/platform/withdrawals?status=pending" | jq .
```

If real data comes back, the mockups are gone.

## Casino endpoints (this repo)

**JWT RS256 (`Authorization: Bearer <jwt>`) — real data (Governance controls the Casino):**
- `GET /api/platform` — catalog
- `GET /api/platform/health` (public)
- `GET /api/platform/whoami`, `/overview`, `/users`, `/wallets`, `/cashflow`, `/bets`, `/rtp`, `/promotions`
- `PATCH /api/platform/users/:id` — block / unblock
- `POST /api/platform/wallets/adjust` — credit / debit
- `PUT /api/platform/rtp` — house-edge bias
- `PUT /api/platform/promotions` — CMS cards
- `GET /api/platform/deposits`, `/withdrawals`, `/payments`, `/stats`
- `POST /api/platform/withdrawals/:id/approve`, `.../reject`

**HMAC (`X-Bridge-Signature`) — subdomain bridge:**
- `POST /api/bridge/webhook`, `GET /api/bridge/health?probe=true`, `POST /api/bridge/sync`

## Troubleshooting

- `PLATFORM_JWT_PUBLIC_KEY not configured` → paste BLOCK 2 on **tols-casino-next** (not on tolsgovernz).
- `Invalid signature` → PRIVATE and PUBLIC are not a pair: regenerate the RS256 keypair and put BLOCK 1 (PRIVATE) on tolsgovernz and BLOCK 2 (PUBLIC) on casino, with the same `GOVERNANCE_BRIDGE_SECRET`.
- `Tower unreachable` → `GOVERNANCE_TOWER_URL` must be **the real tolsgovernz URL** from Vercel Domains, not an invented `tower.tols.fun`.
- `Invalid iss/aud` → check `PLATFORM_JWT_ISSUER=tols-governance` and `AUDIENCE=tols-casino` on both.
