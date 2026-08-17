# Copilot — Bridge Casino ↔ Governance (hackguts-projects)

> **I 2 progetti Vercel REALI sono:**
> - `tols-casino-next` → https://vercel.com/hackguts-projects/tols-casino-next
> - `tolsgovernz` → https://vercel.com/hackguts-projects/tolsgovernz
> **NON usare tower.dev.fun / tower.tols.fun inventati.**

> **Codice già pronto sul branch `arena/01a00d5d-tols-casino-next` — non rigenerare.**

## Contesto
- Bridge dati JWT RS256: Governance firma con `PLATFORM_JWT_PRIVATE_KEY`, Casino verifica con `PLATFORM_JWT_PUBLIC_KEY`. Elimina mockup.
- File già pushati: `src/lib/platform-jwt.ts`, `src/lib/platform-auth.ts`, `src/app/api/platform/*` (health, whoami, deposits, withdrawals, payments, stats)

## Prompt copia-incolla

```
Sei su Hackergut/tols-casino-next, branch arena/01a00d5d-tols-casino-next (team hackguts-projects).

1. Verifica esistono:
   - src/lib/platform-jwt.ts, src/lib/platform-auth.ts
   - src/app/api/platform/health, whoami, deposits, withdrawals, payments, stats
   Se mancano: git apply docs/casino-platform-bridge.patch

2. Verifica next.config.ts CORS su /api/platform/:path* verso TOWER_HOST (da GOVERNANCE_TOWER_URL=https://tolsgovernz.vercel.app)
   e vercel.json headers su /api/platform/(.*)

3. npx tsc --noEmit --skipLibCheck — 0 errori su platform*

4. NON toccare .env.bridge-keys, NON rigenerare chiavi. Domini reali da Vercel Domains, non tower.dev.fun
```

## Env Vercel (1 minuto) — da .env.bridge-keys BLOCCO 1 e 2

- **tolsgovernz** → Settings → Environment Variables → Production → incolla BLOCCO 1 (GOVERNANCE_TOWER_URL=https://tolsgovernz.vercel.app, APP_URL=URL Casino, GOVERNANCE_BRIDGE_SECRET, PLATFORM_JWT_PRIVATE_KEY)
- **tols-casino-next** → Settings → Environment Variables → Production → incolla BLOCCO 2 (stesso ma PLATFORM_JWT_PUBLIC_KEY)

Merge PR #1 → Redeploy automatico → verifica:
```bash
curl https://tols-casino-next.vercel.app/api/platform/health | jq .
curl -H "Authorization: Bearer <jwt>" https://tols-casino-next.vercel.app/api/platform/deposits?limit=5 | jq .
```
