# TOLS — Ponte Casino ↔ Governance (hackguts-projects)

> **2 progetti Vercel REALI, team `hackguts-projects`**
> - **Casino** → `tols-casino-next` → https://vercel.com/hackguts-projects/tols-casino-next
> - **Governance** → `tolsgovernz` → https://vercel.com/hackguts-projects/tolsgovernz
>
> Repo git separati, deploy separati. Il ponte è **service-to-service HTTPS** (HMAC + JWT RS256), NON via admin panel.

## Prendi i domini REALI da Vercel (non inventare)

Vai su ogni progetto → **Settings → Domains** e copia il dominio mostrato da Vercel:

- **Casino** → es. `https://www.tols.fun` (ufficiale) 
- **Governance** → `https://gov.tols.fun` (o `https://tolsgovernz-hackguts-projects.vercel.app`, o custom se configurato)

Userai quei 2 URL come `APP_URL` (Casino) e `GOVERNANCE_TOWER_URL` (Governance). **Non usare `tower.dev.fun` / `tower.tols.fun` inventati.**

## Architettura

```
  Vercel hackguts-projects/tols-casino-next        Vercel hackguts-projects/tolsgovernz
  (Casino)                                          (Governance)
       │                                                   │
  Tower ──POST /api/bridge/webhook (HMAC)─────────────► Casino
       │  governance.rtp_update → OperationControl
  Casino ──POST /api/platform/* (JWT RS256)─────────► Tower mostra dati reali (no mockup)
       │  GET /api/platform/deposits, /withdrawals, /payments, /stats
       │  POST /api/platform/withdrawals/:id/approve|reject
```

Il JWT RS256 è ciò che **elimina i mockup**: la Governance firma con `PLATFORM_JWT_PRIVATE_KEY`, il Casino verifica con `PLATFORM_JWT_PUBLIC_KEY`.

## Env — su ENTRAMBI i progetti Vercel (stesso secret, chiavi diverse)

Genera secret UNA volta:
```bash
openssl rand -hex 32
# → a1b2c3... (64 hex)
# Coppia RS256 già generata in .env.bridge-keys (PRIVATE su Governance, PUBLIC su Casino)
```

| Var | Dove | Esempio reale | Note |
|-----|------|---------------|------|
| `GOVERNANCE_TOWER_URL` | **entrambi** | `https://gov.tols.fun` | Copia da Vercel → tolsgovernz → Domains. Alias `TOWER_URL`. |
| `APP_URL` | **entrambi** | `https://www.tols.fun` o `https://www.tols.fun` | Copia da Vercel → tols-casino-next → Domains. Su Governance serve per CORS. |
| `GOVERNANCE_BRIDGE_SECRET` | **entrambi** | `a1b2c3...` | **Stesso valore** su entrambi. Alias `GOVERNANCE_WEBHOOK_SECRET`. |
| `PLATFORM_JWT_PRIVATE_KEY` | **solo tolsgovernz** | `LS0t...` (base64 PEM) | Da `.env.bridge-keys` BLOCCO 1 — solo Governance firma. |
| `PLATFORM_JWT_PUBLIC_KEY` | **solo tols-casino-next** | `LS0t...` (base64 PEM) | Da `.env.bridge-keys` BLOCCO 2 — solo Casino verifica. |
| `PLATFORM_JWT_ISSUER` / `AUDIENCE` | entrambi | `tols-governance` / `tols-casino` | Default già ok. |
| `DATABASE_URL` / `DIRECT_URL` | solo Casino | `...pooler.supabase.com...` | Supabase. |

Su Vercel: **Project → Settings → Environment Variables → Production → Add → Save → Redeploy**.

## Deploy — già creati, verifica solo

1. **Casino** `tols-casino-next` → Vercel mostra già deploy. Se verde, ok. Se rosso, controlla `DATABASE_URL` e `PLATFORM_JWT_PUBLIC_KEY`.
2. **Governance** `tolsgovernz` → stesso. Verifica che `PLATFORM_JWT_PRIVATE_KEY` sia base64 corretto (senza newline).

### Verifica ponte (dopo aver messo env + mergiato PR)

```bash
# 1. Health Casino (pubblico)
curl https://www.tols.fun/api/platform/health | jq .
# o se hai tols.fun:
curl https://www.tols.fun/api/platform/health | jq .

# 2. Health con probe Governance
curl "https://www.tols.fun/api/bridge/health?probe=true" | jq .

# 3. JWT whoami (con token firmato da tolsgovernz)
# Genera token sulla Governance (node con PLATFORM_JWT_PRIVATE_KEY) poi:
curl -H "Authorization: Bearer <jwt>" https://www.tols.fun/api/platform/whoami | jq .
curl -H "Authorization: Bearer <jwt>" "https://www.tols.fun/api/platform/deposits?limit=5" | jq .
curl -H "Authorization: Bearer <jwt>" "https://www.tols.fun/api/platform/withdrawals?status=pending" | jq .
```
Se tornano dati reali, mockup eliminati.

## Endpoint Casino (questo repo)

**JWT RS256 (`Authorization: Bearer <jwt>`) — dati reali:**
- `GET /api/platform/health` (pubblico)
- `GET /api/platform/whoami`, `/deposits`, `/withdrawals`, `/payments`, `/stats`
- `POST /api/platform/withdrawals/:id/approve`, `.../reject`

**HMAC (`X-Bridge-Signature`) — bridge sottodominio:**
- `POST /api/bridge/webhook`, `GET /api/bridge/health?probe=true`, `POST /api/bridge/sync`

## Troubleshooting

- `PLATFORM_JWT_PUBLIC_KEY not configured` → incolla BLOCCO 2 su **tols-casino-next** (non su tolsgovernz).
- `Invalid signature` → PRIVATE e PUBLIC non sono coppia: rigenera coppia RS256 e rimetti BLOCCO 1 (PRIVATE) su tolsgovernz e BLOCCO 2 (PUBLIC) su casino, stesso `GOVERNANCE_BRIDGE_SECRET`.
- `Tower unreachable` → `GOVERNANCE_TOWER_URL` deve essere **l'URL reale di tolsgovernz** da Vercel Domains, non `tower.tols.fun` inventato.
- `Invalid iss/aud` → controlla `PLATFORM_JWT_ISSUER=tols-governance` e `AUDIENCE=tols-casino` su entrambi.
