#!/usr/bin/env node
/*
 * scripts/telegram-setup.mjs
 *
 * One command to point a NEW bot at this deployment and remove the old one's
 * connection. Replaces the previous set-telegram-webapp.mjs, which only set
 * the menu button and left the webhook, commands and any stale registration
 * untouched — so a re-pointed bot kept delivering updates to the old URL.
 *
 * Usage:
 *   node scripts/telegram-setup.mjs                    # show current state
 *   node scripts/telegram-setup.mjs --apply            # configure everything
 *   node scripts/telegram-setup.mjs --apply --url=https://www.tols.fun
 *   node scripts/telegram-setup.mjs --reset            # tear the connection down
 *
 * Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL from .env
 * (or the real environment, which wins).
 *
 * What --apply does, in order:
 *   1. getMe                 — verify the token and show which bot it is
 *   2. deleteWebhook         — drop any previous webhook, including one that
 *                              belongs to an older deployment, and discard
 *                              queued updates so the new bot does not wake up
 *                              to a backlog addressed to the old one
 *   3. setWebhook            — register THIS deployment, with a secret token
 *   4. setMyCommands         — publish the command list to the UI
 *   5. setChatMenuButton     — make the ☰ button open the Mini App
 *   6. setMyDescription      — text shown on the bot's profile before /start
 */

import { readFileSync } from "node:fs";

/* ── env ── */
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env — rely on the real environment */
}

const arg = (n) => {
  const hit = process.argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(n.length + 3) : true;
};

const APPLY = Boolean(arg("apply"));
const RESET = Boolean(arg("reset"));
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const URL_IN = (arg("url") === true ? undefined : arg("url")) || process.env.APP_URL;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const fail = (msg) => {
  console.error(red(`\n✗ ${msg}\n`));
  process.exit(1);
};

if (!TOKEN) {
  fail(
    "TELEGRAM_BOT_TOKEN is not set.\n\n" +
      "  Create the bot with @BotFather (/newbot), then put the token in .env:\n" +
      '    TELEGRAM_BOT_TOKEN="123456:ABC-..."',
  );
}

/*
 * Never throws. A DNS failure, a proxy blocking api.telegram.org or a dropped
 * TLS handshake would otherwise surface as an undici stack trace, which tells
 * an operator nothing about what to fix.
 */
const api = async (method, body = {}) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return await res.json();
  } catch (e) {
    const cause = e?.cause?.message ?? e?.message ?? "unknown error";
    return { ok: false, description: `cannot reach api.telegram.org — ${cause}`, __network: true };
  }
};

const step = async (label, method, body) => {
  const r = await api(method, body);
  if (r.ok) console.log(`  ${green("✓")} ${label}`);
  else console.log(`  ${red("✗")} ${label} ${dim(`— ${r.description ?? "failed"}`)}`);
  return r;
};

/* ── identify the bot ── */
const me = await api("getMe");
if (!me.ok) {
  if (me.__network) {
    fail(
      `${me.description}\n\n` +
        "  The Telegram API is unreachable from this machine. Check outbound HTTPS,\n" +
        "  a corporate proxy, or run this from the deployment environment instead.",
    );
  }
  fail(
    `The bot token was rejected: ${me.description}\n\n` +
      "  If you just created a new bot, copy the token from @BotFather again —\n" +
      "  revoking a token invalidates the old one immediately.",
  );
}

console.log(`\n${bold("Bot")}      @${me.result.username}  ${dim(`(id ${me.result.id})`)}`);

/* ── current state ── */
const hook = await api("getWebhookInfo");
const current = hook.result ?? {};
console.log(`${bold("Webhook")}  ${current.url || dim("(none)")}`);
if (current.pending_update_count) {
  console.log(`${bold("Pending")}  ${current.pending_update_count} queued update(s)`);
}
if (current.last_error_message) {
  console.log(`${bold("Last err")} ${red(current.last_error_message)}`);
}

/* ── reset ── */
if (RESET) {
  console.log(`\n${bold("Removing the connection…")}`);
  await step("webhook deleted", "deleteWebhook", { drop_pending_updates: true });
  await step("commands cleared", "deleteMyCommands", {});
  await step("menu button reset", "setChatMenuButton", { menu_button: { type: "default" } });
  console.log(
    `\n${green("Done.")} The bot no longer points at any deployment.\n` +
      dim("  The bot itself still exists; delete it in @BotFather if that is what you want.\n"),
  );
  process.exit(0);
}

/* ── validate the target URL ── */
let origin = null;
if (URL_IN) {
  try {
    const u = new URL(URL_IN);
    if (u.protocol !== "https:") {
      fail(`APP_URL must be HTTPS — Telegram refuses http:// for webhooks and Mini Apps.\n  Got: ${URL_IN}`);
    }
    origin = u.origin;
  } catch {
    fail(`APP_URL is not a valid URL: ${URL_IN}`);
  }
}

if (!APPLY) {
  console.log(
    `\n${dim("Read-only. Re-run with --apply to configure:")}\n` +
      `  node scripts/telegram-setup.mjs --apply\n`,
  );
  if (!origin) console.log(red("  APP_URL is not set — required before --apply.\n"));
  if (!SECRET) console.log(red("  TELEGRAM_WEBHOOK_SECRET is not set — required before --apply.\n"));
  process.exit(0);
}

if (!origin) fail("APP_URL is not set. Pass --url=https://… or set it in .env");
if (!SECRET) {
  fail(
    "TELEGRAM_WEBHOOK_SECRET is not set.\n\n" +
      "  Without it the webhook route rejects every update, because a secret token\n" +
      "  is the only proof an incoming update really came from Telegram.\n\n" +
      "  Generate one:\n" +
      "    openssl rand -hex 32",
  );
}

/* ── apply ── */
console.log(`\n${bold("Configuring")} → ${origin}\n`);

// Drop the previous connection first. Without drop_pending_updates the new
// webhook immediately receives every message queued while the old one was
// unreachable, which for a re-pointed bot can be days of backlog.
await step("old webhook removed", "deleteWebhook", { drop_pending_updates: true });

await step("webhook registered", "setWebhook", {
  url: `${origin}/api/telegram/webhook`,
  secret_token: SECRET,
  // Only the update types the route actually handles. Narrowing this cuts the
  // request volume and stops Telegram retrying updates nothing will consume.
  allowed_updates: ["message", "callback_query", "pre_checkout_query"],
  max_connections: 40,
});

await step("commands published", "setMyCommands", {
  commands: [
    { command: "start", description: "Open TOLS Casino" },
    { command: "play", description: "Jump into a game" },
    { command: "balance", description: "View your wallet" },
    { command: "support", description: "Get help" },
    { command: "help", description: "Show all commands" },
  ],
});

await step("menu button set", "setChatMenuButton", {
  menu_button: { type: "web_app", text: "Play", web_app: { url: origin } },
});

await step("description set", "setMyDescription", {
  description:
    "Provably fair casino originals. Every result is committed by the server " +
    "before you bet and can be verified afterwards. 18+ only.",
});

await step("short description set", "setMyShortDescription", {
  short_description: "Provably fair casino originals. 18+",
});

/* ── verify ── */
const after = await api("getWebhookInfo");
const w = after.result ?? {};
const expected = `${origin}/api/telegram/webhook`;

console.log("");
if (w.url === expected) {
  console.log(green(`✓ Webhook confirmed: ${w.url}`));
  if (w.has_custom_certificate) console.log(dim("  (self-signed certificate in use)"));
} else {
  console.log(red(`✗ Webhook reads back as "${w.url || "(none)"}", expected "${expected}"`));
}

console.log(
  `\n${bold("One manual step remains in @BotFather:")}\n` +
    `  /newapp  → choose @${me.result.username} → set the Mini App URL to:\n` +
    `      ${origin}\n` +
    dim("  BotFather has no API for this, so it cannot be scripted.\n") +
    `\n${bold("Verify delivery:")} send /start to @${me.result.username}\n`,
);
