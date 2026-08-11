# TOLS — Deployment (Vercel + Supabase + tols.fun)

Stack: **Vercel** (Next.js app) · **Supabase** (Postgres) · **tols.fun** (domain, DNS at Hostinger).

Values marked _(from .env)_ already exist in your local `.env` — copy them across.
Never paste secrets into this file; it is committed to the repo.

---

## 1. Supabase

1. Create a project at supabase.com.
2. **Project Settings → Database → Connection string**, copy two forms:
   - **Transaction pooler** (host `…pooler.supabase.com`, port **6543**) → `DATABASE_URL`, append `?pgbouncer=true&connection_limit=1`.
   - **Session / direct** (port **5432**) → `DIRECT_URL`.
3. From your machine, create the schema on Supabase:
   ```bash
   npx prisma db push
   ```
   (Reads `DIRECT_URL`. Creates all 41 tables. Fresh production DB — no test data carried over.)

## 2. Vercel

1. **Add New → Project → Import** `distefanmarco370-coder/tols-casino`.
2. Framework preset: **Next.js** (auto-detected). Build command and output are default.
3. Add the environment variables below (**Project → Settings → Environment Variables**), for Production.
4. Deploy.

## 3. Domain (tols.fun)

1. Vercel → Project → **Settings → Domains → Add** `tols.fun` (and `www.tols.fun`).
2. Vercel shows the exact DNS records. In **Hostinger → DNS**, replace the parking record:

   | Type  | Name | Value                     |
   |-------|------|---------------------------|
   | A     | `@`  | `76.76.21.21`             |
   | CNAME | `www`| `cname.vercel-dns.com`    |

   (Use whatever Vercel's dashboard shows — it is authoritative.)
3. Wait for DNS + TLS to go green in Vercel.

## 4. Telegram Mini App (only AFTER tols.fun is live on Vercel)

Point the bot at the new domain (run once, with your bot token):
```bash
TOKEN="<TELEGRAM_BOT_TOKEN from .env>"
# Menu button → Mini App
curl -s "https://api.telegram.org/bot$TOKEN/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"Play Casino","web_app":{"url":"https://tols.fun/"}}}'
# Webhook → new domain
curl -s "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tols.fun/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET from .env>","allowed_updates":["message","pre_checkout_query"]}'
```

---

## Environment variables (Vercel)

### Required
| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler (6543, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Supabase direct (5432) |
| `ADMIN_SESSION_SECRET` | _(from .env)_ — 32-byte hex, admin auth fails closed without it |
| `APP_URL` | `https://tols.fun` |
| `CRON_SECRET` | _(from .env)_ |
| `ALLOW_OUTCOME_CONTROL` | `false` — never `true` in production |

### Telegram
| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | _(from .env)_ |
| `TELEGRAM_CHAT_ID` | _(from .env)_ |
| `TELEGRAM_WEBHOOK_SECRET` | _(from .env)_ |
| `TELEGRAM_WELCOME_BONUS` | `0` for production (or a promo amount) |
| `TELEGRAM_THREAD_ID` | _(from .env, may be empty)_ |

### Optional (set only if the feature is used)
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY`, `MAIL_FROM` | Transactional email (else mail is dev-logged only) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `NEXT_PUBLIC_BUY_PROVIDER`, `NEXT_PUBLIC_BUY_API_KEY` | Buy-crypto widget (publishable key) |
| `TOLS_BASE_URL`, `TOLS_API_KEY`, `TOLS_APP_KEY` | TOLS Platform API |
| `STARS_TO_USDT`, `USDT_CONTRACT` | Payment conversion / chain config |
| `LEGAL_AGE`, `REQUIRE_KYC`, `ENABLE_DEMO_USER` | Compliance / demo flags |

> `NEXT_PUBLIC_*` are shipped to the browser by design — only publishable values belong there.
