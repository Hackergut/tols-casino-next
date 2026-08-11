# TOLS Casino — Production deployment checklist

A single source of truth for going live. Work top to bottom.

## 1. Domain + TLS
- Point your domain's A/AAAA records at the host.
- Caddy (`Caddyfile.prod`) obtains Let's Encrypt certs automatically when you
  use a real domain. Edit `casino.example.com` → your domain and run:
  `caddy run --config Caddyfile.prod`
- The reverse proxy forwards to the Next.js standalone server on :3000.

## 2. Database (Postgres)
- Easiest: `docker compose up -d` (uses `docker-compose.yml`, persists data in
  the `tols-pgdata` volume, restart: always, healthcheck).
- Or use a managed Postgres. Set `DATABASE_URL` in `.env` accordingly.
- Apply schema: `npx prisma db push` (additive) or `prisma migrate deploy`.
- Seed an operator: `npm run seed:admin -- --email=ops@yourdomain.com --password=...`

## 3. Next.js build
- `npm install`
- `npm run build` (type errors fail the build on Vercel; locally
  `ignoreBuildErrors` is lenient — fix them, don't rely on the leniency).
- `npm start` (uses standalone output) behind Caddy.

## 4. Environment (.env) — copy .env.example and fill:
- `DATABASE_URL` — Postgres URL.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — alerts.
- `TELEGRAM_WEBHOOK_SECRET` — run `node scripts/set-telegram-webhook.mjs --url=https://yourdomain --secret=$(openssl rand -hex 16)` and put the same secret here.
- `ADMIN_SESSION_SECRET` — 64+ random chars (operator sessions).
- `CRON_SECRET` — protects /api/cron/watch-deposits.
- `ALLOW_OUTCOME_CONTROL=false` (keep rigging disabled in prod).
- `LEGAL_AGE=18`, `REQUIRE_KYC=false` (set true to enforce KYC on withdrawals).
- Payments RPCs: `BTC_API_URL`, `ETH_RPC_URL`, `POLYGON_RPC_URL`, `SOL_RPC_URL`,
  `USDT_CONTRACT` (defaults are public free nodes; use Alchemy/Helius keys for volume).
- `STARS_TO_USDT=0.012` — Telegram Stars conversion.
- Email + OAuth: `APP_URL=https://yourdomain.com`, `RESEND_API_KEY`,
  `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Buy on-ramp (public widget keys, client bundle): `NEXT_PUBLIC_BUY_PROVIDER`
  (moonpay|transak), `NEXT_PUBLIC_BUY_API_KEY`.

## 5. Telegram Mini App
- BotFather: `/newapp` → set the Web App domain to your HTTPS domain.
- Set the menu button: `node scripts/set-telegram-webapp.mjs --url=https://yourdomain.com`
- Webhook (for Stars payments): `node scripts/set-telegram-webhook.mjs --url=https://yourdomain --secret=$TELEGRAM_WEBHOOK_SECRET`
- Admin sets public receive addresses: `PUT /api/admin/deposit-addresses`.

## 6. Google OAuth
- Google Cloud Console → Credentials → Create OAuth client (Web).
- Authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`.
- Put the client id/secret in `.env` (`GOOGLE_CLIENT_ID/SECRET`).

## 7. Deposit addresses (admin, before deposits work)
- Operator panel → set one public receive address per chain (BTC/ETH/USDT/SOL/MATIC).
- No private keys are stored server-side (watch-only). Deposits are credited by the
  on-chain watcher (`/api/cron/watch-deposits`, runs every minute via `vercel.json`
  on Vercel, or your own cron hitting it with `Authorization: Bearer $CRON_SECRET`).

## 8. Operational hygiene before real money
- Rotate all secrets (the .env on the dev machine has live Telegram/admin secrets).
- Backups for Postgres (the volume is not a backup).
- KYC provider (Onfido/Sumsub) if you enforce `REQUIRE_KYC=true`.
- License / AML / legal pages / geoblocking — jurisdiction-dependent, not code.
- Tests: there is no automated suite yet; verify the flows manually on staging.

## Processes on this dev box (stop before shipping)
- Next dev (`node .devpid`), cloudflared (`node .cfpid`), Postgres container
  `tols-postgres`. The cloudflared quick-tunnel URL is ephemeral — do NOT use it
  in prod; use the real domain.
