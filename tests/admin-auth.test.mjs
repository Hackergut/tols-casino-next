import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";

// `mock.module` is from `node:module` not `node:test` in node 22.
// Wait, `mock.module` is actually from `node:test` mock property but only in later v22 versions.

// Let's use `bet-sync.test.mjs` pattern which the codebase ALREADY uses for EXACTLY THIS PURPOSE.
// We will write a Custom Require function to safely intercept ALL imports in the transpiled module.

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function loadAdminAuth() {
  const src = read("src/lib/admin-auth.ts");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const moduleObj = { exports: {} };
  const requireNode = createRequire(import.meta.url);

  const mockRequire = (id) => {
    if (id === "next/headers") {
      return { cookies: () => ({ get: () => null, set: () => {}, delete: () => {} }) };
    }
    if (id === "@/lib/db") {
      return { db: { crmActivity: { create: async () => {} } } };
    }
    // Return standard node modules using Node's require
    return requireNode(id);
  };

  const run = new Function("require", "module", "exports", "process", "Buffer", "console", js);
  run(mockRequire, moduleObj, moduleObj.exports, process, Buffer, console);
  return moduleObj.exports;
}

const { createAdminToken, verifyAdminToken } = loadAdminAuth();

test("admin-auth", async (t) => {
  const originalEnv = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "super_secret_test_key_must_be_32_chars_long";

  t.after(() => {
    process.env.ADMIN_SESSION_SECRET = originalEnv;
  });

  await t.test("createAdminToken creates a valid token", (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const mockNow = 1700000000000;
    t.mock.timers.setTime(mockNow);

    const token = createAdminToken("user_123", "admin_bob");
    assert.ok(token);
    assert.ok(token.includes("."));
  });

  await t.test("verifyAdminToken verifies a valid token", (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const mockNow = 1700000000000;
    t.mock.timers.setTime(mockNow);

    const token = createAdminToken("user_123", "admin_bob");
    const session = verifyAdminToken(token);

    assert.ok(session);
    assert.strictEqual(session.userId, "user_123");
    assert.strictEqual(session.username, "admin_bob");
    assert.strictEqual(session.issuedAt, mockNow);
  });

  await t.test("verifyAdminToken returns null for missing token", () => {
    assert.strictEqual(verifyAdminToken(undefined), null);
    assert.strictEqual(verifyAdminToken(""), null);
  });

  await t.test("verifyAdminToken returns null for malformed token", () => {
    assert.strictEqual(verifyAdminToken("just_a_string"), null);
    assert.strictEqual(verifyAdminToken("part1.part2.part3"), null);
  });

  await t.test("verifyAdminToken returns null for invalid signature", (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    t.mock.timers.setTime(1700000000000);

    const token = createAdminToken("user_123", "admin_bob");
    const parts = token.split(".");
    const invalidSigToken = `${parts[0]}.invalidsignature`;

    assert.strictEqual(verifyAdminToken(invalidSigToken), null);
  });

  await t.test("verifyAdminToken returns null for expired token", (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const mockNow = 1700000000000;
    t.mock.timers.setTime(mockNow);

    const token = createAdminToken("user_123", "admin_bob");

    // Fast forward 9 hours (max age is 8 hours)
    const MAX_AGE_SECONDS = 60 * 60 * 8;
    t.mock.timers.setTime(mockNow + (MAX_AGE_SECONDS * 1000) + 1);

    const session = verifyAdminToken(token);
    assert.strictEqual(session, null);
  });

  await t.test("throws error when ADMIN_SESSION_SECRET is missing or too short", () => {
    process.env.ADMIN_SESSION_SECRET = "too_short";
    assert.throws(
      () => createAdminToken("user_123", "admin_bob"),
      /ADMIN_SESSION_SECRET missing or shorter than 32 chars/
    );

    process.env.ADMIN_SESSION_SECRET = undefined;
    assert.throws(
      () => createAdminToken("user_123", "admin_bob"),
      /ADMIN_SESSION_SECRET missing or shorter than 32 chars/
    );

    process.env.ADMIN_SESSION_SECRET = "super_secret_test_key_must_be_32_chars_long";
  });
});
