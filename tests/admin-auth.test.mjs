/*
 * Admin authentication testing.
 *
 * Covers requireAdmin edge cases, specifically the 503 error path for
 * misconfigured secrets, and verifies behavior against mocked cookies and env.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";
import { createHmac } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function load(mockCookieValue) {
  const src = readFileSync(join(root, "src/lib/admin-auth.ts"), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  // NOTE: This project currently tests internal Next.js/DB logic by
  // stripping out imports matching 'from "next/headers"' or '@\/lib\/db' and injecting mocks.
  // Although not standard across other frameworks, it follows the existing
  // pattern found in `compliance.test.mjs`, `telegram.test.mjs`, and `bet-sync.test.mjs`.

  const mockHeaders = `
    export const cookies = () => ({
      get: (name) => {
        if (name === "tols_admin" && ${mockCookieValue !== undefined}) {
          return { value: ${mockCookieValue ? '"' + mockCookieValue + '"' : 'null'} };
        }
        return undefined;
      }
    });
  `;

  js = js.replace(
    /from\s+['"]next\/headers['"]/g,
    `from "data:text/javascript,${encodeURIComponent(mockHeaders)}"`
  );

  js = js.replace(
    /from\s+['"]@\/lib\/db['"]/g,
    `from "data:text/javascript,export const db = {}"`
  );

  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

function mockResponse() {
  const prevResponse = globalThis.Response;
  globalThis.Response = class Response {
    static json(body, init) {
      return { body, init };
    }
  };
  return () => { globalThis.Response = prevResponse; };
}

test("requireAdmin returns 503 when secret is missing and cookie is present with a valid format", async () => {
  const prevEnv = process.env.ADMIN_SESSION_SECRET;
  const restoreResponse = mockResponse();

  try {
    const mod = await load("part1.part2");

    // Simulate missing or invalid secret length (less than 32 chars).
    process.env.ADMIN_SESSION_SECRET = "short";

    const result = await mod.requireAdmin();

    assert.deepEqual(result, {
      response: {
        body: { success: false, error: "Admin auth is not configured" },
        init: { status: 503 }
      }
    });
  } finally {
    process.env.ADMIN_SESSION_SECRET = prevEnv;
    restoreResponse();
  }
});

test("requireAdmin returns 401 when no session cookie is present", async () => {
  const prevEnv = process.env.ADMIN_SESSION_SECRET;
  const restoreResponse = mockResponse();

  try {
    const mod = await load(undefined);

    process.env.ADMIN_SESSION_SECRET = "01234567890123456789012345678901"; // 32 chars

    const result = await mod.requireAdmin();

    assert.deepEqual(result, {
      response: {
        body: { success: false, error: "Unauthorized" },
        init: { status: 401 }
      }
    });
  } finally {
    process.env.ADMIN_SESSION_SECRET = prevEnv;
    restoreResponse();
  }
});

test("requireAdmin returns 401 when the session token is invalid (bad signature)", async () => {
  const prevEnv = process.env.ADMIN_SESSION_SECRET;
  const restoreResponse = mockResponse();

  try {
    // Valid format but invalid signature
    const payload = JSON.stringify({ userId: "1", username: "admin", issuedAt: Date.now() });
    const b64 = Buffer.from(payload).toString("base64url");
    const mod = await load(`${b64}.badsig`);

    process.env.ADMIN_SESSION_SECRET = "01234567890123456789012345678901";

    const result = await mod.requireAdmin();

    assert.deepEqual(result, {
      response: {
        body: { success: false, error: "Unauthorized" },
        init: { status: 401 }
      }
    });
  } finally {
    process.env.ADMIN_SESSION_SECRET = prevEnv;
    restoreResponse();
  }
});

test("requireAdmin returns the session when a valid token is provided", async () => {
  const prevEnv = process.env.ADMIN_SESSION_SECRET;
  const restoreResponse = mockResponse();

  try {
    const secret = "01234567890123456789012345678901";
    process.env.ADMIN_SESSION_SECRET = secret;

    const issuedAt = Date.now();
    const payload = JSON.stringify({ userId: "1", username: "admin", issuedAt });
    const b64 = Buffer.from(payload).toString("base64url");
    const sig = createHmac("sha256", secret).update(b64).digest("hex");
    const token = `${b64}.${sig}`;

    const mod = await load(token);

    const result = await mod.requireAdmin();

    assert.deepEqual(result, {
      session: {
        userId: "1",
        username: "admin",
        issuedAt
      }
    });
  } finally {
    process.env.ADMIN_SESSION_SECRET = prevEnv;
    restoreResponse();
  }
});
