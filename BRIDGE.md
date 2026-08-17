# TOLS — Ponte Governance Tower ↔ Casino Platform

> **2 progetti Vercel separati, 2 repo git diversi, 1 dominio.**
> - **Casino** → questo repo `tols-casino-next` → `https://tols.fun` (dominio principale)
> - **Tower**  → altro repo `tols-governance-tower` → `https://tower.tols.fun` (sottodominio)
>
> Entrambi già connessi al dominio su Hostinger e deployati su Vercel come **progetti distinti**.
> Il ponte è **service-to-service via HTTPS + HMAC**, NON via admin panel.

## Architettura (progetto ↔ progetto)

```
                    Vercel Project A                Vercel Project B
                    tols-casino-next                tols-governance-tower
                    tols.fun                        tower.tols.fun
                    (sottodominio di tols.fun)
                         │                                 │
  Tower ──POST /api/bridge/webhook (HMAC)──────────────► Casino
    │  governance.rtp_update → OperationControl
    │  governance.session_invalidate → kill AuthSession
    │  governance.wallet_adjust / player_block / limits
    │
  Casino ──bridgeFetch() / pushBridgeEvent()──────────► Tower
       │  health, sync snapshot, bet/deposit events
       │  POST https://tower.tols.fun/api/bridge/events
       │  SSO token mint/verify (GOVERNANCE_BRIDGE_SECRET)
```

DNS (Hostinger): entrambi i domini puntano a Vercel. Vercel fa TLS automatico per root + wildcard/sottodominio.

## Env — identici su ENTRAMBI i progetti Vercel

Genera il secret UNA volta e copialo su entrambi:

```bash
openssl rand -hex 32
# → a1b2c3... (64 hex chars)
```

| Var | Dove | Esempio | Note |
|-----|------|---------|------|
| `GOVERNANCE_TOWER_URL` | **entrambi** | `https://tower.tols.fun` | Origin Tower. Alias `TOWER_URL`. |
| `APP_URL` | **entrambi** | `https://tols.fun` | Origin Casino. Alias `CASINO_URL`. Su Tower serve per CORS/redirect. |
| `GOVERNANCE_BRIDGE_SECRET` | **entrambi** | `a1b2c3...` | **Deve coincidere** su Tower e Casino. Alias `GOVERNANCE_WEBHOOK_SECRET`. |
| `TOLS_BASE_URL` | Casino | `https://tower.tols.fun/api` | Base API Tower se espone `/api` separato. Fallback a `towerOrigin/api`. |
| `TOLS_API_KEY` / `TOLS_APP_KEY` | Casino | `...` | Se la Tower richiede chiavi API. |
| `ADMIN_SESSION_SECRET` / `DATABASE_URL` / `DIRECT_URL` | Casino | `...` | Solo Casino (Supabase + admin). |

Su Vercel: `Project → Settings → Environment Variables → Production` (redeploy dopo).

## Deployment Vercel — 2 progetti separati

### A) Casino (`tols-casino-next` → `tols.fun`) — questo repo
1. Vercel → Add New → Project → Import `Hackergut/tols-casino-next` (preset Next.js).
2. Env → incolla tabella sopra (Production).
3. Deploy → `npm run build` (prisma generate + next build).
4. Domains → Add `tols.fun` + `www.tols.fun` → Vercel mostra i record DNS → Hostinger → DNS → sostituisci:
   ```
   A     @    76.76.21.21
   CNAME www  cname.vercel-dns.com
   ```
   (usa sempre i valori che mostra Vercel — sono autoritativi). Attendi TLS verde.

### B) Tower (`tols-governance-tower` → sottodominio) — altro repo
1. Vercel → Add New → Project → Import `TUO-ORG/tols-governance-tower` (altro git repo).
2. Env → **stesso** `GOVERNANCE_TOWER_URL`, `APP_URL`, `GOVERNANCE_BRIDGE_SECRET` + env specifiche della Tower.
3. Domains → Add `tower.tols.fun` (o `governance.tols.fun` — scegli 1 e usa lo stesso ovunque):
   ```
   CNAME tower  cname.vercel-dns.com
   ```
   Oppure se usi apex già su Casino, Vercel accetta il sottodominio automaticamente se il dominio root è già verificato. Attendi TLS verde.
4. Sulla Tower, crea le stesse route del ponte (vedi sezione "Cosa copiare sulla Tower") oppure riusa lo stesso `GOVERNANCE_BRIDGE_SECRET` per validare `X-Bridge-Signature`.

### Verifica che i 2 progetti si parlano

```bash
# 1. Health Casino (verifica DB + reachability Tower)
curl https://tols.fun/api/bridge/health?probe=true | jq .

# 2. Webhook Casino raggiungibile
curl https://tols.fun/api/bridge/webhook | jq .

# 3. Ping Tower → Casino (senza secret, solo ping è aperto)
curl -X POST https://tols.fun/api/bridge/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"ping","payload":{}}' | jq .

# 4. Ping firmato (con secret condiviso)
BODY='{"type":"ping","payload":{}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$GOVERNANCE_BRIDGE_SECRET" | awk '{print $2}')
curl -X POST https://tols.fun/api/bridge/webhook \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Signature: sha256=$SIG" \
  -d "$BODY" | jq .

# 5. Health Tower (se la Tower espone lo stesso endpoint)
curl https://tower.tols.fun/api/bridge/health | jq .

# 6. Sync snapshot Casino → Tower (richiede login admin → cookie tols_admin)
curl -X POST https://tols.fun/api/bridge/sync \
  -H "Content-Type: application/json" \
  -b "tols_admin=..." \
  -d '{"dryRun":true}' | jq .
```

## Cosa copiare sulla Tower (altro git repo)

La Tower deve implementare il lato speculare. Copia questi 2 file dal Casino (o riusa la logica):

**1) `src/lib/governance-bridge.ts` → Tower: stesso file** (già compatibile con `TOWER_URL` / `GOVERNANCE_TOWER_URL`).
**2) Endpoint Tower:**

```ts
// Tower: POST /api/bridge/events  ← Casino → Tower
// Tower: POST /api/bridge/webhook → verifica X-Bridge-Signature con GOVERNANCE_BRIDGE_SECRET
// Tower: GET  /api/bridge/health  ← health per monitoraggio
// Opzionale: Tower → Casino push usa lo stesso signBridgePayload()
```

Firma speculare Tower → Casino:
```ts
const raw = JSON.stringify({ type, payload });
const sig = createHmac('sha256', process.env.GOVERNANCE_BRIDGE_SECRET).update(raw).digest('hex');
fetch('https://tols.fun/api/bridge/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Bridge-Signature': `sha256=${sig}` },
  body: raw
});
```

Se la Tower è in altro stack (non Next.js), basta replicare la verifica HMAC:
```
expected = hex(hmac_sha256(rawBody, GOVERNANCE_BRIDGE_SECRET))
confronta con header X-Bridge-Signature (togli prefisso sha256=)
timingSafeEqual(expected, received)
```

## Endpoint Casino (questo repo)

| Method | Path | Auth | Descrizione |
|--------|------|------|-------------|
| `GET` | `/api/bridge/health?probe=true` | pubblico | Health DB + env + probe Tower. Cron Vercel ogni 15m. |
| `GET` | `/api/bridge/config` | admin | Diagnostica senza secret. |
| `GET` | `/api/bridge/sync` | admin | Anteprima snapshot. |
| `POST` | `/api/bridge/sync` | admin | Push snapshot a Tower. |
| `POST` | `/api/bridge/webhook` | HMAC | Tower → Casino. `ping` aperto anche senza HMAC. |
| `GET` | `/api/bridge/webhook` | pubblico | Verifica raggiungibilità. |
| `POST` | `/api/bridge/sso` | sessione | Minta token SSO 10m. |
| `GET` | `/api/bridge/sso?token=…` | HMAC token | Verifica + login cross-domain. |

### Eventi Tower → Casino
`governance.rtp_update`, `governance.limits_update`, `governance.feature_flag`, `governance.session_invalidate`, `governance.wallet_adjust`, `governance.player_block`, `ping`.

### Firma HMAC
```
sig = hex(hmac_sha256(rawBody, GOVERNANCE_BRIDGE_SECRET))
header: X-Bridge-Signature: sha256=<sig>
alias: X-Webhook-Signature, X-Tower-Signature, X-Governance-Signature
```

## CSP / CORS

`next.config.ts` in questo repo aggiunge `GOVERNANCE_TOWER_URL` a `frame-ancestors`, `frame-src`, `connect-src` e serve CORS su `/api/bridge/*` verso il sottodominio. Sulla Tower aggiungi speculare `APP_URL` (`https://tols.fun`) alla tua CSP/CORS.

## Troubleshooting

- `Invalid bridge signature` → secret diverso tra i 2 progetti Vercel. Riallinea `GOVERNANCE_BRIDGE_SECRET` su entrambi, redeploy.
- `Tower unreachable` in health → verifica `GOVERNANCE_TOWER_URL` (deve essere `https://tower.tols.fun`, non `https://tols.fun`) e che Tower abbia `GOVERNANCE_BRIDGE_SECRET`.
- Sottodominio non risolve → Hostinger DNS: `CNAME tower → cname.vercel-dns.com` (o A record come mostra Vercel) + `tower.tols.fun` aggiunto in Vercel → Project → Domains della Tower.
- `ADMIN_SESSION_SECRET missing` su `/api/bridge/sync` → imposta su Vercel Casino.
- Build `prisma generate` fallisce → verifica `DATABASE_URL` Direct vs Pooler.
