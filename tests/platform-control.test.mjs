import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Governance catalog lists users, wallets, cashflow, RTP and promotions", () => {
  const catalog = read("src/lib/platform-http.ts");
  assert.match(catalog, /\/api\/platform\/users/);
  assert.match(catalog, /\/api\/platform\/wallets\/adjust/);
  assert.match(catalog, /\/api\/platform\/cashflow/);
  assert.match(catalog, /\/api\/platform\/rtp/);
  assert.match(catalog, /\/api\/platform\/promotions/);
  assert.match(catalog, /\/api\/platform\/overview/);
});

test("platform users and wallets require JWT and can block or credit", () => {
  const users = read("src/app/api/platform/users/[id]/route.ts");
  assert.match(users, /requirePlatformAuth/);
  assert.match(users, /blocked/);
  const wallets = read("src/app/api/platform/wallets/adjust/route.ts");
  assert.match(wallets, /balance: \{ increment/);
  assert.match(wallets, /balance:update/);
});

test("platform RTP and promotions are writable from Governance", () => {
  const rtp = read("src/app/api/platform/rtp/route.ts");
  assert.match(rtp, /export async function PUT/);
  assert.match(rtp, /mode: \"rtp\"/);
  const promo = read("src/app/api/platform/promotions/route.ts");
  assert.match(promo, /cmsCard\.upsert/);
  assert.match(promo, /requirePlatformAuth/);
});

test("retired Casino admin still redirects to Governance", () => {
  const config = read("next.config.ts");
  assert.match(config, /\/control\/:path\*/);
});
