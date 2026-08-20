# Telegram bot & Mini App

TOLS Casino runs inside Telegram as a Mini App. The bot is a thin shell around
it: it opens the app, answers a handful of commands, and handles Telegram Stars
payments. It deliberately does **not** run games, hold balances or take bets in
chat.

## Connecting a new bot

Everything except one BotFather step is scripted.

### 1. Create the bot

In [@BotFather](https://t.me/BotFather):

```
/newbot
```

Copy the token it gives you. If you are replacing an existing bot, `/revoke` on
the old one invalidates its token immediately — that is what actually cuts the
previous deployment loose, since a live token keeps working wherever it is
installed.

### 2. Configure the environment

```bash
TELEGRAM_BOT_TOKEN="123456:ABC-..."        # from BotFather
TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 32)"
APP_URL="https://www.tols.fun"             # must be HTTPS
```

`TELEGRAM_WEBHOOK_SECRET` is not optional. Telegram does not sign webhook
requests, so this shared secret is the only thing distinguishing a genuine
update from anyone POSTing JSON at the endpoint. **The webhook rejects every
request when it is unset** — it fails closed rather than open.

Optional:

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_CHAT_ID` | Where operational alerts are delivered |
| `TELEGRAM_THREAD_ID` | Topic id, for forum-style supergroups |
| `TELEGRAM_SUPPORT_HANDLE` | Public @handle used by `/support` |
| `TELEGRAM_WELCOME_BONUS` | Credited to new Telegram sign-ups (`0` = off) |
| `STARS_TO_USDT` | USDT per Star for top-ups (default `0.012`) |

### 3. Run the setup

```bash
npm run telegram:setup             # read-only — shows the current state
npm run telegram:setup -- --apply  # configure
```

`--apply` deletes any previous webhook (dropping its queued updates, so a
re-pointed bot does not wake to a backlog addressed to the old deployment),
registers this one with the secret token, publishes the command list, points
the ☰ menu button at the Mini App, and sets the profile description. It then
reads the webhook back to confirm it took.

### 4. The one manual step

BotFather has no API for registering a Mini App, so:

```
/newapp  →  select your bot  →  URL: https://www.tols.fun
```

### Tearing it down

```bash
npm run telegram:reset
```

Removes the webhook, commands and menu button. The bot itself still exists;
delete it in BotFather if that is what you want.

## Commands

| Command | Behaviour |
| --- | --- |
| `/start` | Welcome + buttons opening the Mini App |
| `/play` | Game shortcut grid, each deep-linking to one game |
| `/balance` | Points at the wallet **inside** the Mini App — see below |
| `/support` | Support handle and help centre links |
| `/help` | Command list |

### Why `/balance` does not print a balance

A chat message proves only that some Telegram account sent text. `from.id` is
not a session, and the bot has no way to verify it — anyone who can make the
bot reply, including in a group, would see the number. Identity is only
cryptographically established inside the Mini App, where `initData` is
HMAC-verified against the bot token, so that is where the balance lives.

The webhook never reads the database from chat input, and a test enforces it.

## How authentication works

```
Telegram client                  Mini App                     Server
──────────────────────────────────────────────────────────────────────
initData (signed by Telegram)
   └─► window.Telegram.WebApp.initData
             └─► POST /api/auth/telegram { initData }
                         └─► validateTelegramInitData()
                                 secret = HMAC("WebAppData", botToken)
                                 hash   = HMAC(secret, dataCheckString)
                                 constant-time compare
                                 reject if older than 24h
                         └─► session cookie
```

`src/lib/telegram-auth.ts` implements Telegram's documented algorithm and fails
closed on any mismatch, expiry or parse error. `tests/telegram.test.mjs` signs
real payloads and asserts that tampering with a field, signing with a different
bot's token, backdating, post-dating and omitting the hash are all rejected.

## Files

| Path | Role |
| --- | --- |
| `src/lib/telegram-api.ts` | Single typed Bot API client (`tg()`), never throws |
| `src/lib/telegram-auth.ts` | `initData` signature validation |
| `src/lib/telegram.ts` | Operational alerts, persisted for audit |
| `src/lib/payment/stars.ts` | Stars invoices and idempotent crediting |
| `src/app/api/telegram/webhook/route.ts` | Update handler |
| `src/app/api/auth/telegram/route.ts` | Mini App sign-in |
| `src/components/TelegramWebApp.tsx` | Client bootstrap |
| `scripts/telegram-setup.mjs` | Connect / inspect / reset |

## Telegram Stars

Players top up with Stars (`XTR`) through a Telegram invoice. Telegram charges
the user and POSTs `successful_payment` to the webhook, which credits the
wallet.

Crediting is idempotent: the row is flipped `pending → paid` and the wallet
incremented in one transaction, guarded by a conditional update, so a replayed
or double-delivered webhook cannot credit twice. If a payment arrives that is
already credited or unknown, the player is told to contact support rather than
being silently ignored — they have paid and need to know where the money went.

Stars are a deposit rail only. They cannot be withdrawn to crypto by a bot.

## Notes for the next person

**Framing.** Telegram renders the Mini App in an iframe from `web.telegram.org`,
so `frame-ancestors` in `next.config.ts` allows Telegram's origins and nothing
else. Blocking all framing blanks the app inside Telegram; allowing `*` would
give up clickjacking protection on a site with a bet button.

A CSP directive may only appear **once** — the browser keeps the first and
discards the rest. `frame-src` and `connect-src` were previously declared
twice, so the wider second copies (added to unblock vendor game iframes) were
dead. A test now fails the build on a duplicate directive.

**Route imports.** The webhook imports its database-backed helpers lazily. A
static import pulls Prisma in at module load, and if the client cannot
initialise, the route 500s *before* the secret check runs — which turns an
authentication failure into a server error and makes an unauthenticated caller
indistinguishable from a genuine one.

**The auth flag.** `TelegramWebApp.tsx` guards the initData exchange with
`sessionStorage` to prevent a reload loop. The flag is only set *after* the
server confirms a session; setting it before the request meant a network
failure left the user stuck logged out until they killed the app.
