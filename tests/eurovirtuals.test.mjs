import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("EuroVirtuals callbacks live under /api/eurovirtuals/{action}", () => {
  const route = read("src/app/api/eurovirtuals/[action]/route.ts");
  assert.match(route, /player_info/);
  assert.match(route, /case \"bet\"/);
  assert.match(route, /case \"win\"/);
  assert.match(route, /case \"rollback\"/);
  assert.match(route, /case \"adjustment\"/);
  assert.match(route, /verifyEvCallback/);
});

test("EuroVirtuals connection is persisted encrypted server-side", () => {
  const source = read("src/lib/eurovirtuals-connection.ts");
  assert.match(source, /eurovirtuals\.connection\.v1/);
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /\/api\/eurovirtuals\/\$\{action\}/);
  assert.match(source, /evRuntimeCredentials/);
});

test("admin Virtual Games page exposes full callback URLs and a saveable connection", () => {
  const page = read("src/components/admin/modules/virtual-games-page.tsx");
  assert.match(page, /\/api\/admin\/virtual-games\/connection/);
  assert.match(page, /EuroVirtuals API connection/);
  assert.match(page, /Seamless-wallet callbacks/);
  assert.match(page, /api\.staging\.betkraft\.co\.uk/);
});

test("launch and games use runtime credentials, not env-only", () => {
  const src = read("src/lib/eurovirtuals.ts");
  assert.match(src, /evRuntimeCredentials/);
  assert.match(src, /verifyEvCallback/);
});
