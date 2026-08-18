import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadVipMath() {
  const js = ts.transpileModule(read("src/lib/vip.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const common = { exports: {} };
  new Function("module", "exports", js)(common, common.exports);
  return common.exports;
}

const vip = loadVipMath();

test("pointsFromWager floors the wagered amount correctly", () => {
  assert.equal(vip.pointsFromWager(0), 0);
  assert.equal(vip.pointsFromWager(0.5), 0);
  assert.equal(vip.pointsFromWager(0.99), 0);
  assert.equal(vip.pointsFromWager(1), 1);
  assert.equal(vip.pointsFromWager(1.5), 1);
  assert.equal(vip.pointsFromWager(99.99), 99);
  assert.equal(vip.pointsFromWager(123456.789), 123456);
});

test("vipLevelForWager returns correct level across tier boundaries", () => {
  // Tier 1: Spark (0)
  assert.equal(vip.vipLevelForWager(0), 1);
  assert.equal(vip.vipLevelForWager(499), 1);

  // Tier 2: Blaze (500)
  assert.equal(vip.vipLevelForWager(500), 2);
  assert.equal(vip.vipLevelForWager(1999), 2);

  // Tier 3: Storm (2,000)
  assert.equal(vip.vipLevelForWager(2000), 3);
  assert.equal(vip.vipLevelForWager(9999), 3);

  // Tier 4: Titan (10,000)
  assert.equal(vip.vipLevelForWager(10000), 4);

  // Tier 5: Nova (50,000)
  assert.equal(vip.vipLevelForWager(50000), 5);

  // Tier 6: Apex (200,000)
  assert.equal(vip.vipLevelForWager(200000), 6);

  // Tier 7: Myth (1,000,000)
  assert.equal(vip.vipLevelForWager(1000000), 7);
  assert.equal(vip.vipLevelForWager(5000000), 7); // Max tier logic holds
});

test("vipTier and cashbackRate return correct values and handle out-of-bounds", () => {
  assert.equal(vip.vipTier(1).name, "Spark");
  assert.equal(vip.cashbackRate(1), 0);

  assert.equal(vip.vipTier(4).name, "Titan");
  assert.equal(vip.cashbackRate(4), 10);

  assert.equal(vip.vipTier(7).name, "Myth");
  assert.equal(vip.cashbackRate(7), 20);

  // Out of bounds levels
  assert.equal(vip.vipTier(0), null);
  assert.equal(vip.cashbackRate(0), 0);

  assert.equal(vip.vipTier(8), null);
  assert.equal(vip.cashbackRate(8), 0);
});

test("vipProgress interpolates correctly and caps at max tier", () => {
  // Level 1 to 2 (0 to 500)
  assert.equal(vip.vipProgress(0), 0);
  assert.equal(vip.vipProgress(250), 50);
  assert.equal(vip.vipProgress(499), (499 / 500) * 100);

  // Level 2 to 3 (500 to 2000)
  // 500 points in: progress = 0
  // 1250 points in: (1250 - 500) / (2000 - 500) = 750 / 1500 = 50%
  assert.equal(vip.vipProgress(500), 0);
  assert.equal(vip.vipProgress(1250), 50);

  // Max tier
  assert.equal(vip.vipProgress(1000000), 100);
  assert.equal(vip.vipProgress(5000000), 100);
});
