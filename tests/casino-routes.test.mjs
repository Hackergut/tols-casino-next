import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/casino-routes.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, () => ({}));
const routes = mod.exports;

test("casino routes round-trip all durable screens", () => {
  for (const section of ["lobby", "originals", "rewards", "slots", "live", "table", "recent", "settings", "vip"]) {
    const path = routes.casinoPath(section);
    assert.equal(routes.parseCasinoRoute(path).section, section);
  }
});

test("every registered Original has a refresh-safe game URL", () => {
  for (const game of routes.ORIGINAL_IDS) {
    const path = routes.casinoPath("originals", game);
    assert.deepEqual(routes.parseCasinoRoute(path), { section: "originals", game });
  }
});

test("unknown paths and unknown games fail safely to a known screen", () => {
  assert.deepEqual(routes.parseCasinoRoute("/originals/not-a-game"), { section: "originals", game: null });
  assert.deepEqual(routes.parseCasinoRoute("/something-unknown"), { section: "lobby", game: null });
});

test("proxy rewrites durable casino routes to the client shell", () => {
  const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /isCasinoAppPath/);
  assert.match(proxy, /NextResponse\.rewrite\(new URL\("\/", req\.url\)/);
});

test("the shell synchronizes browser history and gates deep-linked games", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /window\.addEventListener\("popstate"/);
  assert.match(page, /window\.history\.pushState/);
  assert.match(page, /authed !== false \|\| !activeGame/);
  assert.match(page, /navigateBack\("originals"\)/);
});
