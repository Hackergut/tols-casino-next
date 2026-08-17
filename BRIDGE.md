# TOLS — Ponte Governance Tower ↔ Casino Platform

Il Casino è il frontend di gioco (`tols.fun`, questo repo `tols-casino-next`).
La Governance Tower è il control-plane (`tolscrypto.base44.app` o `governance.tols.fun` se self-hosted).
Il ponte è bidirezionale e firmato con un secret condiviso.

## Architettura

```
 Tower ──POST /api/bridge/webhook (HMAC)──► Casino
   │  governance.rtp_update → crea OperationControl
   │  governance.session_invalidate → kill AuthSession
   │  governance.wallet_adjust / player_block / limits_update
   │
 Casino ──bridgeFetch() / pushBridgeEvent()──► Tower
      health, sync snapshot, bet/deposit events (best-effort)
      SSO token mint/verify (GOVERNANCE_BRIDGE_SECRET)
```

## Env (identici su Tower e Casino)

| Var | Dove | Note |
|-----|------|------|
| `GOVERNANCE_TOWER_URL` | Casino | `https://tolscrypto.base44.app` (o `https://governance.tols.fun`). Se vuoto, derivato da `TOLS_BASE_URL`. |
| `TOLS_BASE_URL` | Casino | `https://tolscrypto.base44.app/api` |
| `APP_URL` | Casino | `https://tols.fun` |
| `GOVERNANCE_BRIDGE_SECRET` | **Entrambi** | `openssl rand -hex 32` — **deve coincidere**. Alias `GOVERNANCE_WEBHOOK_SECRET` accettato. |
| `TOLS_API_KEY` / `TOLS_APP_KEY` | Casino (o admin Settings) | Chiavi Tower API |
| `ADMIN_SESSION_SECRET` | Casino | `openssl rand -hex 32` |
| `DATABASE_URL` / `DIRECT_URL` | Casino | Supabase pooler/direct |

Genera il secret una volta e copialo su Vercel in entrambi i progetti:

```bash
openssl rand -hex 32
# → a1b2c3...
# Vercel → Project → Settings → Environment Variables → Production
# GOVERNANCE_BRIDGE_SECRET = a1b2c3...
# Su Tower: stessa variabile, stesso valore.
```

## Endpoint

| Method | Path | Auth | Descrizione |
|--------|------|------|-------------|
| `GET` | `/api/bridge/health?probe=true` | pubblico | Health DB + env + probe Tower (Vercel cron ogni 15m). Ritorna sempre 200 se DB ok, 503 se DB giù. |
| `GET` | `/api/bridge/config` | admin (`requireAdmin`) | Diagnostica bridge senza esporre secret. |
| `GET` | `/api/bridge/sync` | admin | Anteprima snapshot sync. |
| `POST` | `/api/bridge/sync` | admin | Push snapshot a Tower (`{ dryRun: true|false }`). |
| `POST` | `/api/bridge/webhook` | HMAC `X-Bridge-Signature: sha256=<hex>` o `CRON_SECRET` | Tower → Casino. `ping` è aperto anche senza HMAC per wiring check. |
| `GET` | `/api/bridge/webhook` | pubblico | Verifica che il webhook sia raggiungibile. |
| `POST` | `/api/bridge/sso` | sessione Casino | Minta token SSO (`userId`, `email`, `nonce`, `issuedAt`, HMAC). Valido 10m. |
| `GET` | `/api/bridge/sso?token=…` | HMAC token | Verifica token Tower→Casino, crea sessione, redirect a `/` (o JSON se `Accept: application/json`). |
| `GET/POST/…` | `/api/tols?path=/…` | admin | Proxy verso Tower API (già esistente, usato da Operations). |

### Firma webhook

```
rawBody = JSON.stringify({ type, payload })
sig = hex(hmac_sha256(rawBody, GOVERNANCE_BRIDGE_SECRET))
header: X-Bridge-Signature: sha256=<sig>
# alias accettati: X-Webhook-Signature, X-Tower-Signature, X-Governance-Signature
```

Esempio curl (Tower → Casino ping):

```bash
BODY='{"type":"ping","payload":{}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$GOVERNANCE_BRIDGE_SECRET" | awk '{print $2}')
curl -X POST https://tols.fun/api/bridge/webhook \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Signature: sha256=$SIG" \
  -d "$BODY"
```

Per test rapido senza secret (solo `ping`):

```bash
curl -X POST https://tols.fun/api/bridge/webhook -H "Content-Type: application/json" -d '{"type":"ping","payload":{}}'
```

### Eventi Tower → Casino supportati

`governance.rtp_update`, `governance.limits_update`, `governance.feature_flag`, `governance.session_invalidate`, `governance.wallet_adjust`, `governance.player_block`, `ping`.

## Vercel Deploy

Il repo è già configurato per Vercel Next.js (`vercel.json` + `next.config.ts`).

1. **Import su Vercel** → `Hackergut/tols-casino-next`, preset Next.js, `npm install` / `npm run build`.
2. **Env su Vercel** → copia da `.env.example` (vedi tabella sopra) in Production. `DATABASE_URL` = pooler 6543 `?pgbouncer=true&connection_limit=1`, `DIRECT_URL` = direct 5432.
3. **Deploy** → attende `next build` verde (Prisma generate incluso).
4. **Dominio** → Vercel → Settings → Domains → `tols.fun` + `www.tols.fun` → aggiorna DNS su Hostinger (A `@` 76.76.21.21, CNAME `www` cname.vercel-dns.com o come mostra Vercel) → attendi TLS verde.
5. **Verifica ponte**:
   ```bash
   curl https://tols.fun/api/bridge/health?probe=true | jq .
   curl https://tols.fun/api/bridge/webhook | jq .
   # da Tower:
   curl -X POST https://tols.fun/api/bridge/webhook -H "Content-Type: application/json" -d '{"type":"ping","payload":{}}' | jq .
   ```
6. **Admin UI** → `https://tols.fun/control/admin` → Operations → **Bridge — Governance ↔ Casino** per monitorare stato e lanciare Sync.

### CSP / CORS

`next.config.ts` aggiunge automaticamente `GOVERNANCE_TOWER_URL` a `frame-ancestors`, `frame-src` e `connect-src` e serve CORS su `/api/bridge/*`. Non serve configurare altro — basta impostare `GOVERNANCE_TOWER_URL` corretto prima del deploy.

### Cron Vercel

`vercel.json` programma `GET /api/bridge/health?probe=true` ogni 15 minuti (richiede piano Pro; su Hobby viene ignorato senza errore — il ponte funziona comunque, solo senza cron automatico).

## Troubleshooting

- **`Invalid bridge signature`** → secret diverso tra Tower e Casino. Rigenera, riallinea su entrambi i progetti, redeploy.
- **Tower `unreachable`** in `/api/bridge/health` → verifica `GOVERNANCE_TOWER_URL` / `TOLS_BASE_URL`, e che Tower esponga `/api/bridge/sync` o `/bridge/events`.
- **`ADMIN_SESSION_SECRET missing`** → imposta `ADMIN_SESSION_SECRET` (32+ char) su Vercel altrimenti `/api/ops/*` e `/api/bridge/config|sync` rispondono 503.
- **Build fallisce su `prisma generate`** → verifica `DATABASE_URL`/`DIRECT_URL` validi e che Vercel abbia network per scaricare i binari Prisma.
