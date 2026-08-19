/*
 * Framework consistency tests.
 *
 * The point of the shared frame is that no game can quietly diverge. These
 * assert the properties that make that true, by reading the source rather
 * than rendering: every Original must be in the registry, must render inside
 * GameFrame, must take its outcome from the server, and must never re-derive
 * a payout locally.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const casino = join(root, "src/components/casino");

const GAME_FILES = readdirSync(casino).filter(
  (f) => f.startsWith("game-") && f.endsWith(".tsx") && f !== "game-frame.css",
);

const registry = readFileSync(join(root, "src/lib/originals-registry.ts"), "utf8");

/** Strip comments so prose describing a fixed bug cannot fail a source check. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Game ids declared in the registry union. */
const UNION = registry.slice(
  registry.indexOf("export type OriginalId"),
  registry.indexOf(";", registry.indexOf("export type OriginalId")),
);
const REGISTERED = [...UNION.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

test("every game component is in the Originals registry", () => {
  assert.ok(GAME_FILES.length >= 11, `expected 11+ games, found ${GAME_FILES.length}`);
  for (const f of GAME_FILES) {
    const id = f.replace(/^game-/, "").replace(/\.tsx$/, "");
    assert.ok(
      REGISTERED.includes(id),
      `${f} has no registry entry — its lobby card would have no name, artwork or RTP`,
    );
  }
});

test("every registry entry has a matching component", () => {
  for (const id of REGISTERED) {
    assert.ok(
      GAME_FILES.includes(`game-${id}.tsx`),
      `registry lists "${id}" but src/components/casino/game-${id}.tsx does not exist`,
    );
  }
});

test("every game renders inside the shared frame", () => {
  for (const f of GAME_FILES) {
    const src = code(readFileSync(join(casino, f), "utf8"));
    assert.match(src, /<GameFrame/, `${f} does not use GameFrame`);
    assert.match(src, /gameId="[a-z]+"/, `${f} does not pass gameId to GameFrame`);
  }
});

test("no game hand-rolls its own back button or header", () => {
  // These were the markers of a bespoke shell before the migration.
  for (const f of GAME_FILES) {
    const src = code(readFileSync(join(casino, f), "utf8"));
    assert.ok(
      !/<h1\s+className="text-xl font-bold text-white">/.test(src),
      `${f} still renders its own <h1> header instead of using GameFrame's`,
    );
    assert.ok(
      !/onClick=\{onBack\}/.test(src),
      `${f} still renders its own back button — GameFrame owns that`,
    );
  }
});

test("no game decides its own outcome", () => {
  /*
   * Shoot and Keno used to resolve rounds in the browser. A game may use
   * Math.random for presentation (quick-pick, spin count, decorative reel
   * fill), but must never use it to choose a payout, and must never credit
   * the balance itself.
   */
  for (const f of GAME_FILES) {
    const src = code(readFileSync(join(casino, f), "utf8"));
    assert.ok(
      !/setBalance\((?:b|prev|balance)\s*=>/.test(src),
      `${f} mutates the balance locally — only the server may decide it`,
    );
  }
});

test("games place bets through the shared hook, not raw fetch", () => {
  for (const f of GAME_FILES) {
    const src = code(readFileSync(join(casino, f), "utf8"));
    assert.ok(
      !/fetch\(\s*['"]\/api\/bets['"]/.test(src),
      `${f} calls /api/bets directly — use useBet() so the lifecycle stays identical`,
    );
  }
});

test("the registry never hardcodes an RTP", () => {
  // RTP must reference an exported server-math constant so a card cannot
  // advertise a return the engine does not pay.
  const rtpLines = registry
    .split("\n")
    .filter((l) => /^\s+rtp:/.test(l) && !/rtp\??:\s*(number|string)/.test(l));
  assert.ok(rtpLines.length >= 11, "expected an rtp field per game");
  for (const line of rtpLines) {
    assert.ok(
      /(TARGET_RTP|SLOTS_RTP|ROULETTE_RTP|POOL_RUSH_RTP|SCOPA_RTP)/.test(line),
      `registry RTP must reference a game-math constant, got: ${line.trim()}`,
    );
  }
});

test("settings persist only presentation state", () => {
  const s = readFileSync(join(root, "src/lib/game-settings.ts"), "utf8");
  const partialize = s.slice(s.indexOf("partialize:"));
  for (const forbidden of ["balance", "payout", "serverSeed", "nonce"]) {
    assert.ok(
      !partialize.includes(forbidden),
      `"${forbidden}" must never be persisted to localStorage — the server is authoritative`,
    );
  }
});

test("every registry artwork file actually exists", () => {
  // Four games pointed at .jpg files that were only ever .png, so their cards
  // in the "More from TOLS Originals" rail rendered as empty boxes.
  const paths = [...registry.matchAll(/image:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(paths.length >= 11, "expected an image per game");
  for (const rel of paths) {
    const file = join(root, "public", rel.replace(/^\//, ""));
    assert.ok(existsSync(file), `registry references ${rel} but that file does not exist`);
  }
});
