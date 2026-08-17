# Copilot — Istruzioni per completare il bridge Casino ↔ Governance

> **Non devi generare codice — il codice è già pronto e pushato sul branch `arena/01a00d5d-tols-casino-next`.**  
> Copilot deve solo verificare che sia tutto mergiato e deployato, oppure riapplicare il patch se il branch non è mergiato.

## Contesto
- **Casino** = `tols-casino-next` → `https://tols.fun` (questo repo, branch `arena/01a00d5d-tols-casino-next`)
- **Governance Tower** = altro repo `tols-governance` → `https://tower.tols.fun`
- Bridge dati JWT RS256: la Tower firma con `PLATFORM_JWT_PRIVATE_KEY`, il Casino verifica con `PLATFORM_JWT_PUBLIC_KEY`. Senza questo, la governance mostra mockup.

## Cosa è già fatto (non rifare)
- `src/lib/platform-jwt.ts` + `src/lib/platform-auth.ts` — JWT RS256 verify
- `src/app/api/platform/health|whoami|deposits|withdrawals|payments|stats` — 8 route reali Prisma
- `next.config.ts` + `vercel.json` — CORS su `/api/platform/*` verso `tower.tols.fun`
- `.env.bridge-keys` — coppia RS256 generata (PRIVATE su Tower, PUBLIC su Casino)
- `docs/casino-platform-bridge.patch` — snapshot patch
- BRIDGE.md + BRIDGE_TOWER_TEMPLATE.md — docs ponte

## Cosa dire a Copilot (prompt copia-incolla)

```
Sei su tols-casino-next, branch arena/01a00d5d-tols-casino-next.

1. Verifica che esistono:
   - src/lib/platform-jwt.ts (verifyPlatformJwt, signPlatformJwtForTest)
   - src/lib/platform-auth.ts (requirePlatformAuth)
   - src/app/api/platform/health/route.ts
   - src/app/api/platform/whoami/route.ts
   - src/app/api/platform/deposits/route.ts
   - src/app/api/platform/withdrawals/route.ts
   - src/app/api/platform/withdrawals/[id]/approve/route.ts
   - src/app/api/platform/withdrawals/[id]/reject/route.ts
   - src/app/api/platform/payments/route.ts
   - src/app/api/platform/stats/route.ts
   Se mancano, applica: git apply docs/casino-platform-bridge.patch

2. Verifica next.config.ts ha CORS su /api/platform/:path* verso TOWER_HOST
   e vercel.json ha headers su /api/platform/(.*)

3. Esegui: npx tsc --noEmit --skipLibCheck  (deve dare 0 errori su platform*)

4. Testa localmente (opzionale):
   - Imposta PLATFORM_JWT_PUBLIC_KEY e PLATFORM_JWT_PRIVATE_KEY da .env.bridge-keys
   - Genera JWT di test con node e chiama GET /api/platform/whoami con Authorization: Bearer <jwt>
   - GET /api/platform/health deve tornare 200 senza auth

5. NON toccare .env.bridge-keys (è gitignored), NON rigenerare chiavi
```

## Dopo Copilot — 2 cose da fare a mano su Vercel (1 minuto)

1. **Vercel → tols-governance → Settings → Environment Variables → Production**
   Incolla BLOCCO 1 da `.env.bridge-keys` (GOVERNANCE_TOWER_URL, APP_URL, GOVERNANCE_BRIDGE_SECRET, PLATFORM_JWT_PRIVATE_KEY, ISSUER, AUDIENCE) → Save

2. **Vercel → tols-casino-next → Settings → Environment Variables → Production**
   Incolla BLOCCO 2 da `.env.bridge-keys` (stesso ma con PLATFORM_JWT_PUBLIC_KEY) → Save

3. **Merge PR** `arena/01a00d5d-tols-casino-next` → `master` (o deploya il branch su Vercel) → Redeploy automatico

4. **Verifica:**
   ```bash
   curl https://tols.fun/api/platform/health | jq .
   # genera JWT sul Tower (o usa signPlatformJwtForTest) poi:
   curl -H "Authorization: Bearer <jwt>" https://tols.fun/api/platform/whoami | jq .
   curl -H "Authorization: Bearer <jwt>" "https://tols.fun/api/platform/deposits?limit=5" | jq .
   ```
   Se tornano dati reali, la governance ha eliminato i mockup ✅

## Se Copilot rigenera chiavi
NO — usa sempre quelle in `.env.bridge-keys` già generate, altrimenti Tower e Casino divergono e il bridge torna 401.
