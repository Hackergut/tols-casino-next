#!/usr/bin/env node
/**
 * Destructive production smoke test for POST /api/bets.
 *
 * It creates one clearly-labelled QA account (using the web welcome balance),
 * checks that rejected requests never move the wallet, then places one real
 * one-cent Limbo bet. Run only when explicitly opted in:
 *
 *   ALLOW_LIVE_BET_TEST=1 LIVE_BASE_URL=https://www.tols.fun \
 *     node scripts/verify-live-bets.mjs
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";

if (process.env.ALLOW_LIVE_BET_TEST !== "1") {
  throw new Error("Refusing to touch a live wallet without ALLOW_LIVE_BET_TEST=1");
}

const baseUrl = new URL(process.env.LIVE_BASE_URL ?? "https://www.tols.fun");
if (baseUrl.protocol !== "https:") throw new Error("LIVE_BASE_URL must use HTTPS");

let cookie = "";

async function request(path, { method = "GET", body, rawBody } = {}) {
  const headers = { accept: "application/json", "user-agent": "TOLS-live-bet-verifier/1.0" };
  if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;

  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    redirect: "manual",
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} returned ${response.status} and non-JSON: ${text.slice(0, 300)}`);
  }
  return { status: response.status, json };
}

function logPass(label, detail = "") {
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function balance() {
  const result = await request("/api/auth/me");
  assert.equal(result.status, 200);
  assert.equal(result.json.success, true);
  assert.ok(result.json.data, "QA session disappeared");
  return result.json.data.balance;
}

async function expectRejected(label, options, expectedError, expectedStatus = 400) {
  const before = await balance();
  const result = await request("/api/bets", { method: "POST", ...options });
  assert.equal(result.status, expectedStatus, `${label}: ${JSON.stringify(result.json)}`);
  assert.equal(result.json.success, false, label);
  assert.match(result.json.error, expectedError, label);
  const after = await balance();
  assert.equal(after, before, `${label}: rejected request changed balance`);
  logPass(label, `${result.status} ${result.json.error}; balance unchanged at ${after}`);
}

const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
const username = `arenaqa_${suffix}`.slice(0, 20);
const registration = await request("/api/auth/register", {
  method: "POST",
  body: {
    username,
    email: `${username}@arena.invalid`,
    password: crypto.randomBytes(24).toString("base64url"),
    dateOfBirth: "1990-01-01",
  },
});
assert.equal(registration.status, 200, JSON.stringify(registration.json));
assert.equal(registration.json.success, true);
assert.ok(cookie.startsWith("tols_session="), "registration did not issue a session cookie");
const openingBalance = await balance();
assert.ok(openingBalance >= 0.01, `QA account needs at least 0.01 welcome balance, got ${openingBalance}`);
logPass("production QA account and wallet created", `${username}; opening balance ${openingBalance}`);

// JSON cannot represent NaN. This is the exact raw payload an attacker would
// try; the parser must reject it before any game or ledger code runs.
await expectRejected(
  "raw NaN token",
  { rawBody: '{"game":"coinflip","amount":NaN,"payload":{"choice":"heads"}}' },
  /Invalid body/,
);

// 1e999 is valid JSON syntax but JSON.parse materialises it as Infinity. This
// reaches the finite-number stake guard, unlike the malformed NaN token above.
await expectRejected(
  "non-finite stake",
  { rawBody: '{"game":"coinflip","amount":1e999,"payload":{"choice":"heads"}}' },
  /Invalid stake/,
);

await expectRejected(
  "sub-cent stake rounding to zero",
  { body: { game: "coinflip", amount: 0.004, payload: { choice: "heads" } } },
  /Invalid stake/,
);

await expectRejected(
  "stake above hard ceiling",
  { body: { game: "coinflip", amount: 100000.01, payload: { choice: "heads" } } },
  /Maximum stake is 100000/,
);

// Exactly MAX_STAKE gets past the ceiling and reaches the independent balance
// check. The QA wallet intentionally cannot fund it.
await expectRejected(
  "stake ceiling boundary is inclusive",
  { body: { game: "coinflip", amount: 100000, payload: { choice: "heads" } } },
  /Insufficient balance/,
);

await expectRejected(
  "Crash target above liability ceiling",
  { body: { game: "crash", amount: 0.01, payload: { cashOutAt: 1000000.01 } } },
  /Invalid cash-out target/,
);

await expectRejected(
  "Limbo non-finite target",
  { rawBody: '{"game":"limbo","amount":0.01,"payload":{"target":1e999}}' },
  /Invalid target multiplier/,
);

// The one destructive request: 0.014 must be charged as exactly 0.01 and the
// target must be normalised from 2.345 to 2.35. The returned ledger balance has
// to equal opening - charged stake + payout.
const beforeBet = await balance();
const liveBet = await request("/api/bets", {
  method: "POST",
  body: { game: "limbo", amount: 0.014, clientSeed: `arena-live-${suffix}`, payload: { target: 2.345 } },
});
assert.equal(liveBet.status, 200, JSON.stringify(liveBet.json));
assert.equal(liveBet.json.success, true);
const settled = liveBet.json.data;
assert.equal(settled.amount, 0.01, "server did not snap stake to one cent");
assert.equal(settled.payload.target, 2.35, "server did not normalise target to two decimals");
assert.ok(Number.isFinite(settled.payout), "payout is not finite");
assert.ok(Number.isFinite(settled.newBalance), "new balance is not finite");
const expectedBalance = beforeBet - 0.01 + settled.payout;
assert.ok(
  Math.abs(settled.newBalance - expectedBalance) < 1e-9,
  `settlement mismatch: expected ${expectedBalance}, got ${settled.newBalance}`,
);
assert.equal(await balance(), settled.newBalance, "wallet endpoint disagrees with bet settlement");
logPass(
  "real one-cent production bet",
  `bet ${settled.betId}; 0.014→${settled.amount}; target 2.345→${settled.payload.target}; ` +
    `payout ${settled.payout}; balance ${beforeBet}→${settled.newBalance}`,
);

console.log(`\nLIVE BET VERIFICATION PASSED against ${baseUrl.origin}`);
