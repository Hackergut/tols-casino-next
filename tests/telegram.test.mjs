/*
 * Telegram integration: initData signature validation and webhook hardening.
 *
 * The two places where getting it wrong is a security incident rather than a
 * bug:
 *
 *   1. validateTelegramInitData — this is what turns "some string the client
 *      sent" into "an authenticated Telegram user". If it can be forged, any
 *      visitor can sign in as any Telegram account. Tested against a real
 *      HMAC computed here with the documented algorithm.
 *
 *   2. The webhook's secret-token check — the only thing distinguishing a
 *      genuine Telegram update from anyone POSTing JSON at the endpoint.
 *
 * Both are asserted to FAIL CLOSED: no token, no secret, wrong hash, expired
 * timestamp all deny.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHmac } from "node:crypto";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function load(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

const { validateTelegramInitData } = await load("src/lib/telegram-auth.ts");
const { tg } = await load("src/lib/telegram-api.ts");

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

/** Build a correctly signed initData string, exactly as Telegram does. */
function signInitData(fields, token = BOT_TOKEN) {
  const params = new URLSearchParams(fields);
  const keys = [...params.keys()].filter((k) => k !== "hash").sort();
  const dcs = keys.map((k) => `${k}=${params.get(k)}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

const now = () => Math.floor(Date.now() / 1000);
const USER = JSON.stringify({ id: 42, username: "player", first_name: "Ada" });

/* ───────────────────────── initData validation ───────────────────────── */

test("a correctly signed initData authenticates the user", () => {
  const initData = signInitData({ user: USER, auth_date: String(now()), query_id: "AAE" });
  const parsed = validateTelegramInitData(initData, BOT_TOKEN);
  assert.ok(parsed, "valid initData must be accepted");
  assert.equal(String(parsed.user.id), "42");
  assert.equal(parsed.user.username, "player");
});

test("a tampered field is rejected", () => {
  // Sign as user 42, then try to become user 1 — the classic attack.
  const initData = signInitData({ user: USER, auth_date: String(now()) });
  const forged = initData.replace(
    encodeURIComponent(USER),
    encodeURIComponent(JSON.stringify({ id: 1, username: "admin", first_name: "Root" })),
  );
  assert.equal(validateTelegramInitData(forged, BOT_TOKEN), null);
});

test("initData signed with a different bot token is rejected", () => {
  // A second bot's token must not grant access to this bot's Mini App.
  const initData = signInitData({ user: USER, auth_date: String(now()) }, "999:OTHER-BOT");
  assert.equal(validateTelegramInitData(initData, BOT_TOKEN), null);
});

test("expired initData is rejected (replay window)", () => {
  const dayAgo = now() - 25 * 60 * 60;
  const initData = signInitData({ user: USER, auth_date: String(dayAgo) });
  assert.equal(validateTelegramInitData(initData, BOT_TOKEN), null);
});

test("initData dated in the future is rejected (clock skew abuse)", () => {
  const initData = signInitData({ user: USER, auth_date: String(now() + 3600) });
  assert.equal(validateTelegramInitData(initData, BOT_TOKEN), null);
});

test("missing hash, empty input and missing token all fail closed", () => {
  assert.equal(validateTelegramInitData("", BOT_TOKEN), null);
  assert.equal(validateTelegramInitData(`user=${encodeURIComponent(USER)}`, BOT_TOKEN), null);
  const good = signInitData({ user: USER, auth_date: String(now()) });
  assert.equal(validateTelegramInitData(good, ""), null, "no bot token must never authenticate");
});

test("initData without a user object is rejected", () => {
  const initData = signInitData({ auth_date: String(now()), query_id: "AAE" });
  assert.equal(validateTelegramInitData(initData, BOT_TOKEN), null);
});

/* ───────────────────────── Telegram API Client (tg) ───────────────────────── */

const originalFetch = global.fetch;

test("tg() handles network errors gracefully", async () => {
  global.fetch = async () => {
    throw new Error("simulated network error");
  };
  try {
    const res = await tg("getMe", {}, BOT_TOKEN);
    assert.equal(res.ok, false);
    assert.equal(res.description, "simulated network error");
  } finally {
    global.fetch = originalFetch;
  }
});

test("tg() handles malformed JSON gracefully", async () => {
  global.fetch = async () => ({
    status: 502,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    },
  });
  try {
    const res = await tg("getMe", {}, BOT_TOKEN);
    assert.equal(res.ok, false);
    assert.equal(res.description, "HTTP 502");
  } finally {
    global.fetch = originalFetch;
  }
});

test("tg() fails closed when bot token is missing", async () => {
  const res = await tg("getMe", {}, null);
  assert.equal(res.ok, false);
  assert.equal(res.description, "TELEGRAM_BOT_TOKEN is not set");
});

/* ───────────────────────── Webhook hardening ───────────────────────── */

const webhook = readFileSync(join(root, "src/app/api/telegram/webhook/route.ts"), "utf8");

test("the webhook refuses updates without the secret token", () => {
  assert.match(
    webhook,
    /x-telegram-bot-api-secret-token/,
    "the webhook must read Telegram's secret token header",
  );
  assert.match(webhook, /status:\s*401/, "an unverified update must be rejected with 401");
});

test("the webhook fails closed when no secret is configured", () => {
  // `!secret || ...` — an unset TELEGRAM_WEBHOOK_SECRET must deny everything
  // rather than accept everything, which is the direction this fails by default
  // if the check is written as a plain equality against an empty string.
  assert.match(
    webhook,
    /if\s*\(\s*!secret\s*\|\|/,
    "a missing secret must reject, not allow",
  );
});

test("the secret is compared in constant time", () => {
  assert.match(webhook, /safeEqual|timingSafeEqual/, "avoid leaking the secret through timing");
  assert.ok(
    !/got\s*!==\s*secret/.test(webhook),
    "a plain !== comparison on the secret is timing-attackable",
  );
});

test("the bot never reports a balance from an unauthenticated chat message", () => {
  /*
   * A chat message proves only that a Telegram account sent text — it is not a
   * session. Looking a wallet up by `from.id` and printing it would leak a
   * balance to anyone who can make the bot reply, including in a group.
   */
  assert.ok(
    !/casinoWallet|db\.|prisma/.test(webhook),
    "the webhook must not read wallets or the database from chat input",
  );
});

test("the webhook always acknowledges an authenticated update", () => {
  // Returning non-2xx makes Telegram retry the same update for hours.
  assert.match(webhook, /Response\.json\(\{\s*ok:\s*true\s*\}\)/);
});

/* ───────────────────────── Setup script ───────────────────────── */

const setup = readFileSync(join(root, "scripts/telegram-setup.mjs"), "utf8");

test("setup removes the previous connection before registering the new one", () => {
  const del = setup.indexOf('"deleteWebhook"');
  const set = setup.indexOf('"setWebhook"');
  assert.ok(del > -1 && set > -1, "both calls must exist");
  assert.ok(del < set, "the old webhook must be deleted before the new one is set");
  assert.match(setup, /drop_pending_updates:\s*true/, "a re-pointed bot must not inherit a backlog");
});

test("setup refuses a non-HTTPS Mini App URL", () => {
  // Telegram silently rejects http:// for both webhooks and Web Apps.
  assert.match(setup, /protocol\s*!==\s*"https:"/);
});

test("setup requires a webhook secret before applying", () => {
  assert.match(setup, /if\s*\(\s*!SECRET\s*\)/, "applying without a secret would leave the webhook shut");
});

test("setup only subscribes to update types the route handles", () => {
  const m = setup.match(/allowed_updates:\s*\[([^\]]+)\]/);
  assert.ok(m, "allowed_updates must be set explicitly");
  const listed = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  for (const u of listed) {
    assert.match(
      webhook,
      new RegExp(u.replace(/_/g, "_?")),
      `setup subscribes to "${u}" but the webhook never handles it`,
    );
  }
});

/* ───────────────────────── CSP ───────────────────────── */

test("CSP declares each directive exactly once", () => {
  /*
   * A repeated directive is not merged: the browser keeps the FIRST and drops
   * the rest. next.config.ts previously declared frame-src and connect-src
   * twice, so the wider second copies — added to unblock vendor game iframes —
   * were silently dead.
   */
  const cfg = readFileSync(join(root, "next.config.ts"), "utf8");
  const csp = cfg.slice(cfg.indexOf('key: "Content-Security-Policy"'));
  const body = csp.slice(0, csp.indexOf("].join"));

  const directives = [...body.matchAll(/^\s*[`"]([a-z-]+) /gm)].map((m) => m[1]);
  const seen = new Set();
  for (const d of directives) {
    assert.ok(!seen.has(d), `CSP directive "${d}" is declared more than once — later copies are ignored`);
    seen.add(d);
  }
  assert.ok(directives.includes("frame-ancestors"), "frame-ancestors must be present");
});

test("Telegram may frame the Mini App, and arbitrary sites may not", () => {
  const cfg = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(cfg, /frame-ancestors/);
  assert.match(cfg, /web\.telegram\.org/, "Telegram Web must be able to frame the app");
  const csp = cfg.slice(cfg.indexOf('key: "Content-Security-Policy"'));
  const ancestors = csp.match(/frame-ancestors ([^`"]*)/);
  assert.ok(ancestors, "frame-ancestors must be set");
  assert.ok(
    !ancestors[1].includes("*") || !/\*\s*$/.test(ancestors[1].trim()),
    "frame-ancestors must not be a bare wildcard",
  );
});
