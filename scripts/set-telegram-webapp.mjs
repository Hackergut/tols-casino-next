// scripts/set-telegram-webapp.mjs
// Configures the bot's Telegram menu button to open the casino as a Mini App.
//
// Usage:
//   node scripts/set-telegram-webapp.mjs --url=https://yourdomain.com
//   node scripts/set-telegram-webapp.mjs --url=https://yourdomain.com --text="Open Casino"
//
// Requirements:
//   - TELEGRAM_BOT_TOKEN in .env (the bot that owns the Mini App).
//   - The URL MUST be HTTPS (Telegram rejects http URLs for Web Apps).
//   - The domain must be associated with the bot via BotFather → /newapp (or
//     "Bot Settings → Menu URL"). This script sets the menu button; BotFather
//     association is a one-time manual step.
//
// Running with no --url only calls getMe (token sanity check) and prints the
// current menu button.

import { readFileSync } from "fs";

try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error("TELEGRAM_BOT_TOKEN missing in .env"); process.exit(1); }

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const url = arg("url");
const text = arg("text") || "Open Casino";
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const me = await api("getMe", {});
if (!me.ok) { console.error("Bot token invalid:", me); process.exit(1); }
console.log("Bot:", me.result.username, `(id ${me.result.id})`);

const current = await api("getChatMenuButton", { chat_id: 0 });
console.log("Current menu button:", JSON.stringify(current.result));

if (!url) { console.log("\nNo --url given; nothing to set. Pass --url=https://... to set the Mini App menu button."); process.exit(0); }
if (!/^https:\/\//i.test(url)) { console.error("URL must be HTTPS"); process.exit(1); }

const res = await api("setChatMenuButton", {
  menu_button: { type: "web_app", text, web_app: { url } },
});
if (!res.ok) { console.error("setChatMenuButton failed:", res); process.exit(1); }
console.log(`\nMenu button set -> opens ${url} (${text})`);
console.log("Remember: associate the domain with the bot in BotFather (/newapp).");
