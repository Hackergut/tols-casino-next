# Copilot — Casino ↔ Governance Bridge (hackguts-projects)

> **The 2 REAL Vercel projects are:**
> - `tols-casino-next` → https://vercel.com/hackguts-projects/tols-casino-next
> - `tolsgovernz` → https://vercel.com/hackguts-projects/tolsgovernz
> **Do NOT use invented tower.dev.fun / tower.tols.fun.**

> **Code already ready on branch `arena/01a00d5d-tols-casino-next` — do not regenerate.**

## Context
- RS256 JWT data bridge: Governance signs with `PLATFORM_JWT_PRIVATE_KEY`, Casino verifies with `PLATFORM_JWT_PUBLIC_KEY`. Removes the mockups.
- Files already pushed: `src/lib/platform-jwt.ts`, `src/lib/platform-auth.ts`, `src/app/api/platform/*` (health, whoami, deposits, withdrawals, payments, stats)

## Copy-paste prompt

```
You are on Hackergut/tols-casino-next, branch arena/01a00d5d-tols-casino-next (team hackguts-projects).

1. Verify the following exist:
   - src/lib/platform-jwt.ts, src/lib/platform-auth.ts
   - src/app/api/platform/health, whoami, deposits, withdrawals, payments, stats
   If missing: git apply docs/casino-platform-bridge.patch

2. Verify next.config.ts CORS on /api/platform/:path* toward TOWER_HOST (from GOVERNANCE_TOWER_URL=https://gov.tols.fun)
   and vercel.json headers on /api/platform/(.*)

3. npx tsc --noEmit --skipLibCheck — 0 errors on platform*

4. Do NOT touch .env.bridge-keys, do NOT regenerate keys. Real domains from Vercel Domains, not tower.dev.fun
```

## Vercel env (1 minute) — from .env.bridge-keys BLOCK 1 and 2

- **tolsgovernz** → Settings → Environment Variables → Production → paste BLOCK 1 (GOVERNANCE_TOWER_URL=https://gov.tols.fun, APP_URL=Casino URL, GOVERNANCE_BRIDGE_SECRET, PLATFORM_JWT_PRIVATE_KEY)
- **tols-casino-next** → Settings → Environment Variables → Production → paste BLOCK 2 (same but PLATFORM_JWT_PUBLIC_KEY)

Merge PR #1 → Automatic redeploy → verify:
```bash
curl https://www.tols.fun/api/platform/health | jq .
curl -H "Authorization: Bearer <jwt>" https://www.tols.fun/api/platform/deposits?limit=5 | jq .
```
