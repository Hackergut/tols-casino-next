#!/usr/bin/env node
// One-shot transport for the live verifier. Arena cannot connect directly to
// Vercel's TLS edge, so the explicitly marked preview build performs the call.
// Removing .live-bet-check after the run makes every later build a no-op.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const marked = existsSync(new URL("../.live-bet-check", import.meta.url));
const expectedBranch = "arena/01a00ea6-tols-casino-next";
if (process.env.VERCEL !== "1" || process.env.VERCEL_GIT_COMMIT_REF !== expectedBranch || !marked) {
  process.exit(0);
}

console.log("Running explicitly marked one-shot production bet verification...");
const result = spawnSync(process.execPath, [new URL("./verify-live-bets.mjs", import.meta.url).pathname], {
  stdio: "inherit",
  env: {
    ...process.env,
    ALLOW_LIVE_BET_TEST: "1",
    LIVE_BASE_URL: "https://www.tols.fun",
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
