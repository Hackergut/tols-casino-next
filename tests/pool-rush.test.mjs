import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadPoolMath() {
  const js = ts.transpileModule(read("src/lib/pool-rush.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const common = { exports: {} };
  new Function("module", "exports", js)(common, common.exports);
  return common.exports;
}

const pool = loadPoolMath();

test("every Pool Rush level has exact 96% RTP", () => {
  for (const level of pool.POOL_RUSH_LEVELS) {
    const config = pool.POOL_RUSH_CONFIG[level];
    const probability = config.bands.reduce((sum, band) => sum + band.probability, 0);
    assert.ok(Math.abs(probability - 1) < 1e-12, `${level} probabilities sum to ${probability}`);
    assert.ok(Math.abs(pool.poolRushRtp(level) - pool.POOL_RUSH_RTP) < 1e-12, `${level} RTP drifted`);
  }
});

test("difficulty lowers hit frequency while raising the maximum payout", () => {
  const hitRates = pool.POOL_RUSH_LEVELS.map(pool.poolRushHitFrequency);
  const maxima = pool.POOL_RUSH_LEVELS.map((level) => pool.POOL_RUSH_CONFIG[level].bands.at(-1).multiplier);
  assert.deepEqual(hitRates.map((rate) => Math.round(rate * 100)), [50, 35, 25, 15]);
  assert.deepEqual(maxima, [10, 30, 100, 500]);
  for (let i = 1; i < hitRates.length; i++) {
    assert.ok(hitRates[i] < hitRates[i - 1]);
    assert.ok(maxima[i] > maxima[i - 1]);
  }
});

test("one uniform selects exactly one cumulative payout band", () => {
  const bands = pool.POOL_RUSH_CONFIG.intermediate.bands;
  assert.equal(pool.poolRushOutcome(0, "intermediate").balls, 0);
  assert.equal(pool.poolRushOutcome(0.649999, "intermediate").balls, 0);
  assert.equal(pool.poolRushOutcome(0.65, "intermediate").balls, 1);
  assert.equal(pool.poolRushOutcome(0.912, "intermediate").balls, 3);
  assert.equal(pool.poolRushOutcome(0.9999, "intermediate").balls, bands.at(-1).balls);
});

test("Pool Rush is decided by the server's committed fair stream", () => {
  const route = read("src/app/api/bets/route.ts");
  const gameCase = route.slice(route.indexOf('case "poolrush"'), route.indexOf('case "roulette"'));
  assert.match(gameCase, /poolRushOutcome\(fairFloat\(serverSeed, seed, nonce\), requestedLevel\)/);
  assert.match(gameCase, /payout: stake \* band\.multiplier/);
  assert.match(gameCase, /balls: band\.balls/);
  assert.match(route, /game === "poolrush" && stake !== 0/);
  assert.match(route, /"INVALID_LEVEL"/);
  assert.match(route, /"INSUFFICIENT_BALANCE"/);
});

test("public config and post-reveal verifier use the same paytable", () => {
  const config = read("src/app/api/games/poolrush/config/route.ts");
  const verify = read("src/app/api/games/poolrush/verify/route.ts");
  assert.match(config, /POOL_RUSH_CONFIG\[id\]\.bands/);
  assert.match(config, /POOL_RUSH_MIN_BET/);
  assert.match(config, /POOL_RUSH_MAX_BET/);
  assert.match(verify, /createHmac\("sha256", serverSeed\)/);
  assert.match(verify, /poolRushOutcome\(uniform, level\)/);
});

test("the client reveals copy only after the table animation timer", () => {
  const client = read("src/components/casino/game-poolrush.tsx");
  const afterResponse = client.slice(client.indexOf("const data = await place"));
  const timer = afterResponse.indexOf("window.setTimeout");
  const reveal = afterResponse.indexOf("setOutcome({");
  assert.ok(timer >= 0 && reveal > timer, "result copy must be set inside the post-animation timer");
  assert.match(afterResponse.slice(0, timer), /setPhase\("breaking"\)/);
  const durations = pool.POOL_RUSH_LEVELS.map((level) => pool.POOL_RUSH_CONFIG[level].animationMs);
  for (const duration of durations) {
    assert.ok(duration >= 3600 && duration <= 5000, `cinematic break duration ${duration}ms is outside the visible-motion range`);
  }
  assert.deepEqual(durations, [...durations].sort((a, b) => a - b), "harder breaks should not animate faster");
});
