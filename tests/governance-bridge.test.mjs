import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Governance connection is persisted server-side with authenticated encryption", () => {
  const source = read("src/lib/governance-connection.ts");
  assert.match(source, /db\.platformSetting\.upsert/);
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /getAuthTag/);
  assert.match(source, /CONNECTION_ENCRYPTION_KEY.*ADMIN_SESSION_SECRET/);
  assert.doesNotMatch(source, /localStorage/);
});

test("connection API supports full create, read and delete lifecycle", () => {
  const route = read("src/app/api/bridge/connection/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /requireAdmin/);
  assert.match(route, /publicGovernanceConnection/);
});

test("connection handshake probes health and registers the Casino callback", () => {
  const route = read("src/app/api/bridge/connection/test/route.ts");
  assert.match(route, /connection\.healthPath/);
  assert.match(route, /webhookUrl: `\$\{connection\.casinoOrigin\}\/api\/bridge\/webhook`/);
  assert.match(route, /\/api\/platform\/connections/);
  assert.match(route, /x-bridge-signature/);
  assert.match(route, /recordGovernanceConnectionTest/);
});

test("runtime events and inbound webhooks use the persisted connection", () => {
  const bridge = read("src/lib/governance-bridge.ts");
  const webhook = read("src/app/api/bridge/webhook/route.ts");
  assert.match(bridge, /stored\?\.towerApiBase/);
  assert.match(bridge, /stored\?\.apiKey/);
  assert.match(bridge, /stored\?\.bridgeSecret/);
  assert.match(webhook, /verifyRuntimeBridgeSignature/);
  assert.match(webhook, /x-bridge-timestamp/);
});

test("admin bridge page creates and tests a backend connection through APIs", () => {
  const page = read("src/components/admin/modules/bridge-page.tsx");
  assert.match(page, /fetch\('\/api\/bridge\/connection'/);
  assert.match(page, /fetch\('\/api\/bridge\/connection\/test'/);
  assert.match(page, /Create connection/);
  assert.match(page, /GovernanceLiveLink/);
  assert.doesNotMatch(page, /addPlatformConnection/);
});

test("Governance is always gov.tols.fun / tolsgovernz, never Base44", () => {
  const source = read("src/lib/governance-bridge.ts");
  assert.match(source, /gov\.tols\.fun/);
  assert.match(source, /tolsgovernz/);
  assert.match(source, /isGovernanceTowerHost/);
  assert.match(source, /base44\.app/);
  assert.match(source, /probeGovernanceHealth/);
  assert.match(source, /\/api\/platform\/health/);
  assert.match(source, /pushSettledBet/);
  assert.doesNotMatch(source, /tolscrypto\.base44\.app/);
  const page = read("src/components/admin/modules/bridge-page.tsx");
  assert.doesNotMatch(page, /base44/);
  const tols = read("src/app/api/tols/route.ts");
  assert.doesNotMatch(tols, /base44/);
  const store = read("src/stores/admin.ts");
  assert.doesNotMatch(store, /base44/);
});

test("health probes the Governance origin on gov.tols.fun", () => {
  const health = read("src/app/api/bridge/health/route.ts");
  assert.match(health, /probeGovernanceHealth/);
  assert.match(health, /heartbeat/);
  assert.match(health, /casino\.health/);
  assert.match(health, /link:/);
  assert.doesNotMatch(health, /path: stored\?\.healthPath \|\| ""/);
});

test("settled bets are pushed to Governance", () => {
  const settle = read("src/lib/settle-bet.ts");
  const rounds = read("src/lib/game-rounds.ts");
  assert.match(settle, /pushSettledBet/);
  assert.match(rounds, /pushSettledBet/);
});

test("admin dashboard connectivity uses the Governance bridge", () => {
  const dash = read("src/components/admin/modules/dashboard-page.tsx");
  assert.match(dash, /\/api\/bridge\/health\?probe=true/);
  assert.doesNotMatch(dash, /\/api\/tols\?path=\//);
});

test("live Governance link animates packets between Casino and Tower", () => {
  const live = read("src/components/admin/modules/governance-live-link.tsx");
  assert.match(live, /heartbeat=1/);
  assert.match(live, /animateMotion/);
  assert.match(live, /Casino ↔ Governance/);
});
