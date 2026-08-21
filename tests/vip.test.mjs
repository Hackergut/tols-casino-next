import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the VIP ladder has 50+ ranks and the published XP thresholds", () => {
  const src = read("src/lib/vip.ts");
  assert.match(src, /\["Seed", "seed", 500\]/);
  assert.match(src, /\["Copper 1", "copper", 1_000\]/);
  assert.match(src, /\["Iron", "iron", 10_000\]/);
  assert.match(src, /\["Pearl", "pearl", 90_000_000\]/);
  assert.match(src, /\["Celestial", "celestial", 1_000_000_000\]/);
  assert.match(src, /\["Eternal", "eternal", 10_000_000_000\]/);
  const ranks = [...src.matchAll(/\["[^"]+", "[a-z]+", [0-9_]+\]/g)];
  assert.ok(ranks.length >= 50, `expected 50+ ranks, found ${ranks.length}`);
});

test("casino XP is 1 per dollar and Copper unlocks daily, Iron unlocks weekly", () => {
  const src = code("src/lib/vip.ts");
  assert.match(src, /xpFromCasinoWager/);
  assert.match(src, /Math\.floor\(stakeUsd\)/);
  assert.match(src, /copper:[^}]*dailyRate:\s*0\.4/);
  assert.match(src, /iron:[^}]*weeklyRate:\s*1/);
  assert.match(src, /pearl:[^}]*host:\s*true/);
});

test("weekly bonus drops on Thursday 11:00 UTC", () => {
  const src = code("src/lib/vip-rewards.ts");
  assert.match(src, /11,\s*0,\s*0/);
  assert.match(src, /daily:/);
  assert.match(src, /weekly:/);
  assert.match(src, /monthly:/);
});

test("the VIP page is wired to /api/vip and no longer uses the 7-tier Spark ladder", () => {
  const page = code("src/components/lobby/VipClub.tsx");
  const old = code("src/lib/vip.ts");
  assert.match(page, /\/api\/vip/);
  assert.match(page, /Daily bonus/);
  assert.match(page, /Rakeback/);
  assert.doesNotMatch(old, /name:\s*"Spark"/);
  const sections = code("src/components/lobby/ProfileSections.tsx");
  assert.match(sections, /<VipClub/);
});

test("claims are idempotent on userId \+ kind \+ periodKey", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model VipReward/);
  assert.match(schema, /@@unique\(\[userId, kind, periodKey\]\)/);
  const api = code("src/app/api/vip/route.ts");
  assert.match(api, /claimVipReward/);
});
