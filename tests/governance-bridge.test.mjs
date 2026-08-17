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
  assert.match(page, /Crea connessione/);
  assert.doesNotMatch(page, /addPlatformConnection/);
});
