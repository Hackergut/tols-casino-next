/*
 * Compliance rules: age boundaries, consent versioning, VPN verdicts.
 *
 * Uses node:test so it adds no dependency. Run with:
 *   node --test tests/
 *
 * The logic under test is pure and lives in src/lib/compliance.ts; it is
 * transpiled on the fly below because the repo has no JS test pipeline. The
 * cases that matter are the boundaries — "the day before your 18th birthday"
 * is the one an average-days-per-year calculation gets wrong.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../src/lib/compliance.ts"), "utf8");

// The module under test is pure logic behind type annotations, so stripping
// the types with the compiler the repo already depends on is enough to import
// it — no bundler, no test framework, no new dependency.
const js = ts.transpileModule(source, {
  compilerOptions: { module: 99, target: 9 },
}).outputText;

const mod = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

const { isOfAge, parseConsent, assessVpn, CONSENT_VERSION, acceptAllConsent, serializeConsent } = mod;

/* ── Age ── */

test("isOfAge: exactly 18 today is of age", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  assert.equal(isOfAge(new Date("2008-08-17"), 18, now), true);
});

test("isOfAge: one day short of 18 is not", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  assert.equal(isOfAge(new Date("2008-08-18"), 18, now), false);
});

test("isOfAge: birthday later this month is not yet of age", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  assert.equal(isOfAge(new Date("2008-12-01"), 18, now), false);
});

test("isOfAge: leap-day birthday resolves on Mar 1 in non-leap years", () => {
  assert.equal(isOfAge(new Date("2008-02-29"), 18, new Date("2026-02-28")), false);
  assert.equal(isOfAge(new Date("2008-02-29"), 18, new Date("2026-03-01")), true);
});

/* ── Consent ── */

test("parseConsent: absent cookie means ask", () => {
  assert.equal(parseConsent(null), null);
  assert.equal(parseConsent(""), null);
});

test("parseConsent: malformed cookie means ask, never throws", () => {
  assert.equal(parseConsent("not-json"), null);
  assert.equal(parseConsent("%7Bbroken"), null);
});

test("parseConsent: a stale policy version means ask again", () => {
  const stale = encodeURIComponent(JSON.stringify({ necessary: true, analytics: true, v: "0", at: "x" }));
  assert.equal(parseConsent(stale), null);
});

test("parseConsent: round-trips a current choice", () => {
  const parsed = parseConsent(serializeConsent(acceptAllConsent()));
  assert.ok(parsed);
  assert.equal(parsed.analytics, true);
  assert.equal(parsed.marketing, true);
  assert.equal(parsed.v, CONSENT_VERSION);
});

test("parseConsent: necessary is always true even if the cookie says otherwise", () => {
  const tampered = encodeURIComponent(
    JSON.stringify({ necessary: false, analytics: false, marketing: false, v: CONSENT_VERSION, at: "x" }),
  );
  assert.equal(parseConsent(tampered).necessary, true);
});

/* ── VPN / geo ── */

test("assessVpn: restricted jurisdiction blocks on IP alone", () => {
  const r = assessVpn({ country: "US", ip: "1.2.3.4", edgeProxyFlag: false });
  assert.equal(r.verdict, "blocked");
});

test("assessVpn: blocking ignores a spoofable client timezone", () => {
  // A US IP claiming a Dubai clock must still be blocked — the licensing fact
  // is the IP, and the timezone is attacker-controlled.
  const r = assessVpn({ country: "US", ip: "1.2.3.4", edgeProxyFlag: false, clientTimezone: "Asia/Dubai" });
  assert.equal(r.verdict, "blocked");
});

test("assessVpn: consistent country and timezone is clear", () => {
  const r = assessVpn({ country: "AE", ip: null, edgeProxyFlag: false, clientTimezone: "Asia/Dubai" });
  assert.equal(r.verdict, "clear");
});

test("assessVpn: timezone inconsistent with country is only suspected, never blocked", () => {
  const r = assessVpn({ country: "AE", ip: null, edgeProxyFlag: false, clientTimezone: "America/Chicago" });
  assert.equal(r.verdict, "suspected");
  assert.match(r.reasons.join(" "), /timezone/);
});

test("assessVpn: an unmapped country produces no timezone signal", () => {
  // No mapping must mean "no evidence", not "mismatch" — otherwise every
  // visitor from an unlisted country is flagged.
  const r = assessVpn({ country: "ZM", ip: null, edgeProxyFlag: false, clientTimezone: "Europe/Rome" });
  assert.equal(r.verdict, "clear");
});

test("assessVpn: missing geo is unknown, not blocked", () => {
  // Fail open: an edge that reports no country must not lock everyone out.
  const r = assessVpn({ country: null, ip: null, edgeProxyFlag: false });
  assert.equal(r.verdict, "unknown");
});

test("assessVpn: Italy is playable by default", () => {
  // Guards the deliberate choice to keep the operator's own market off the
  // default blocklist; blocking it must be an explicit env decision.
  const r = assessVpn({ country: "IT", ip: null, edgeProxyFlag: false, clientTimezone: "Europe/Rome" });
  assert.equal(r.verdict, "clear");
});
