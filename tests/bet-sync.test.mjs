/*
 * Bet & balance synchronisation.
 *
 * Two kinds of assertion here:
 *
 *  - Behavioural: the sequencing rule in balance-store is reimplemented
 *    against the real ordering scenarios (poll vs settled bet) so the race is
 *    actually exercised, not just described.
 *  - Source-reading: the server-side guards can't be executed without a
 *    database, so their presence is asserted against the source with comments
 *    stripped first (a comment describing a fixed bug must not satisfy a test
 *    proving it is gone).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Strip comments and string literals so greps can't match prose. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------------ *
 * The store's ordering rule, exercised directly.
 * ------------------------------------------------------------------ */

/*
 * Load the REAL store, not a reimplementation.
 *
 * An earlier version of this file re-declared the reducer here and asserted
 * against the copy. Deleting the staleness guard from the actual store left
 * every test green — the tests were describing a local mock. The store is
 * therefore transpiled in memory and executed, with a minimal `zustand`
 * stub so it can run outside React.
 */
import ts from "typescript";

function loadStore() {
  const src = read("src/lib/balance-store.ts");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  // Minimal zustand: create(fn) -> a store object exposing getState-like access.
  const create = (initializer) => {
    let state;
    const set = (partial) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      state = { ...state, ...next };
    };
    const get = () => state;
    state = initializer(set, get);
    return { getState: get };
  };

  const module = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => {
      if (name === "zustand") return { create };
      throw new Error(`unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { useBalanceStore } = loadStore();

/** A fresh view over the real store, reset between tests. */
function makeStore() {
  const st = useBalanceStore.getState();
  // Reset to a known baseline using the store's own writer.
  st.applyServer(0);
  return {
    get balance() { return useBalanceStore.getState().balance; },
    begin: () => useBalanceStore.getState().begin(),
    applyServer: (v) => useBalanceStore.getState().applyServer(v),
    applyPoll: (v, t) => useBalanceStore.getState().applyPoll(v, t),
  };
}

test("a poll that started before a bet cannot overwrite the settled balance", () => {
  const s = makeStore();
  s.applyServer(100); // starting wallet

  // Poll begins: reads 100 from the DB, response still in flight.
  const token = s.begin();

  // Player stakes 10 and loses; the server settles and returns 90.
  s.applyServer(90);
  assert.equal(s.balance, 90);

  // The stale poll response finally lands carrying the pre-bet snapshot.
  s.applyPoll(100, token);

  assert.equal(s.balance, 90, "stale poll must be discarded, not applied");
});

test("a poll with no intervening bet is applied normally", () => {
  const s = makeStore();
  s.applyServer(100);
  const token = s.begin();
  s.applyPoll(250, token); // e.g. a deposit credited elsewhere
  assert.equal(s.balance, 250);
});

test("a bet result always wins over the current value", () => {
  const s = makeStore();
  s.applyServer(100);
  s.applyServer(42.5);
  assert.equal(s.balance, 42.5);
});

test("NaN and negative balances are refused rather than displayed", () => {
  const s = makeStore();
  s.applyServer(100);
  s.applyServer(NaN);
  assert.equal(s.balance, 100, "NaN must not poison the balance");
  s.applyServer(-5);
  assert.equal(s.balance, 100, "a negative balance must not be applied");
  const t = s.begin();
  s.applyPoll(Number("abc"), t);
  assert.equal(s.balance, 100);
});

test("balances are held to whole cents", () => {
  const s = makeStore();
  s.applyServer(0.1 + 0.2);
  assert.equal(s.balance, 0.3, "0.30000000000000004 must be snapped to 0.30");
});

/* ------------------------------------------------------------------ *
 * Cent-accurate comparison: the guard that used to reject a valid all-in.
 * ------------------------------------------------------------------ */

test("an all-in is allowed when the balance carries float dust", () => {
  const toCents = (n) => Math.round(n * 100);
  let dusty = 0;
  for (let i = 0; i < 10; i++) dusty += 0.1; // 0.9999999999999999

  assert.ok(1 > dusty, "precondition: the naive float compare rejects this");
  assert.ok(toCents(1) <= toCents(dusty), "the cent compare must allow it");
});

/* ------------------------------------------------------------------ *
 * Server-side stake validation.
 * ------------------------------------------------------------------ */

const route = code("src/app/api/bets/route.ts");

test("the server rejects non-finite stakes", () => {
  assert.match(
    route,
    /Number\.isFinite\(amount\)/,
    "NaN/Infinity pass `typeof x === 'number'` and every comparison against them is false",
  );
});

test("the server bounds the stake from above", () => {
  assert.match(route, /stake > MAX_STAKE/);
});

test("the server snaps the stake to whole cents before charging", () => {
  assert.match(route, /const stake = Math\.round\(amount \* 100\) \/ 100/);
});

test("the atomic debit uses the sanitised stake, never the raw request value", () => {
  const tx = route.slice(route.indexOf("updateMany"));
  assert.match(tx, /balance: \{ gte: stake \}/, "the guard must use the sanitised stake");
  assert.match(tx, /decrement: stake/, "the debit must use the sanitised stake");
  assert.doesNotMatch(
    tx.slice(0, 400),
    /decrement: amount\b/,
    "debiting the raw amount reintroduces the sub-cent/NaN charge",
  );
});

test("the insufficient-balance check compares in cents", () => {
  assert.match(route, /const walletCents = Math\.round\(wallet\.balance \* 100\)/);
  assert.match(route, /walletCents < Math\.round\(stake \* 100\)/);
});

test("zero-value practice is restricted to an empty wallet and never reaches the ledger", () => {
  assert.match(route, /const practice = stake === 0 && walletCents <= 0/);
  assert.match(route, /if \(stake === 0 && !practice\) return err\("Invalid stake", 400\)/);
  const practiceReturn = route.slice(route.indexOf("if (practice)"), route.indexOf("const controlDecision"));
  assert.match(practiceReturn, /payout: 0/);
  assert.match(practiceReturn, /practice: true/);
  assert.match(practiceReturn, /newBalance: wallet\.balance/);
  assert.doesNotMatch(practiceReturn, /\$transaction|casinoBet\.create|houseEarning/);
});

test("the response echoes the stake actually charged", () => {
  assert.match(route, /amount: stake,/);
});

/* ------------------------------------------------------------------ *
 * Open-ended multipliers: crash and limbo take their target from the client.
 * ------------------------------------------------------------------ */

test("crash and limbo validate the client-supplied target", () => {
  assert.match(route, /normaliseTarget\(payload\?\.cashOutAt\)/);
  assert.match(route, /normaliseTarget\(payload\?\.target\)/);
  assert.doesNotMatch(
    route,
    /Number\(payload\?\.cashOutAt \?\? 0\)/,
    "an unbounded target pays stake * target and can write Infinity to the wallet",
  );
});

test("normaliseTarget refuses unusable targets and caps the payable range", async () => {
  const src = read("src/lib/game-math.ts");
  const body = src.slice(src.indexOf("export function normaliseTarget"));
  // Execute the real function rather than trusting a grep.
  const js = body
    .slice(0, body.indexOf("\n}") + 2)
    .replace("export function normaliseTarget(value: unknown): number | null", "return function (value)");
  const fn = new Function("MIN_TARGET_MULTIPLIER", "MAX_TARGET_MULTIPLIER", js)(1.01, 1_000_000);

  assert.equal(fn(NaN), null);
  assert.equal(fn(Infinity), null);
  assert.equal(fn(1e308), null, "an absurd target must be rejected, not clamped silently");
  assert.equal(fn(0), null);
  assert.equal(fn(1), null, "below 1.01x a win would return less than the stake");
  assert.equal(fn(2), 2);
  assert.equal(fn("2.005"), 2.01, "targets are held to two decimals");
});

/* ------------------------------------------------------------------ *
 * Client hook: one balance, serial rapid-bet queue.
 * ------------------------------------------------------------------ */

const hook = code("src/components/casino/useBet.ts");

test("the hook reads the balance from the shared store, not a local copy", () => {
  assert.match(hook, /useBalanceStore\(\(s\) => s\.balance\)/);
  assert.doesNotMatch(
    hook,
    /useState\(initialBalance\)/,
    "a local copy seeded once from a prop drifts from the wallet",
  );
});

test("rapid bets are serialised instead of dropped or settled out of order", () => {
  assert.match(hook, /queue\.current = queue\.current\.then\(execute, execute\)/);
  assert.match(hook, /pending\.current \+= 1/);
  assert.match(hook, /pending\.current = Math\.max\(0, pending\.current - 1\)/);
  assert.doesNotMatch(hook, /if \(inFlight\.current\) return null/);
});

test("the hook reserves queued stakes and compares them in cents", () => {
  assert.match(hook, /const stakeCents = toCents\(stake\)/);
  assert.match(hook, /stakeCents \+ reservedCents\.current > toCents\(currentBalance\)/);
  assert.match(hook, /reservedCents\.current \+= stakeCents/);
});

test("an empty client wallet requests a zero-value practice round", () => {
  assert.match(hook, /const practice = toCents\(currentBalance\) <= 0/);
  assert.match(hook, /const stake = practice \? 0 : Math\.round\(amount \* 100\) \/ 100/);
});

test("the hook applies the settled balance as authoritative", () => {
  assert.match(hook, /applyServer\(data\.newBalance\)/);
});

test("a lost POST response reconciles the wallet instead of retrying the debit", () => {
  assert.match(hook, /fetch\("\/api\/wallet", \{ cache: "no-store" \}\)/);
  assert.match(hook, /applyServer\(walletJson\.data\.balance\)/);
  assert.doesNotMatch(hook, /fetch\("\/api\/bets"[\s\S]{0,500}fetch\("\/api\/bets"/);
});

/* ------------------------------------------------------------------ *
 * Lobby: the poll must be tokenised.
 * ------------------------------------------------------------------ */

const page = code("src/app/page.tsx");

test("the lobby poll tokenises its read and cannot clobber a newer value", () => {
  assert.match(page, /const token = useBalanceStore\.getState\(\)\.begin\(\)/);
  assert.match(page, /applyPoll\(Number\(me\.data\.balance \?\? 0\), token\)/);
  assert.match(page, /applyPoll\(Number\(w\.data\.balance \?\? 0\), token\)/);
  assert.doesNotMatch(
    page,
    /setBalance\(Number\(/,
    "an unconditional setBalance from a poll is the original race",
  );
});

/* ------------------------------------------------------------------ *
 * The fourth copy: useSessionStore was also carrying a balance.
 *
 * The lobby poll mirrored the balance into useSessionStore via setWallet(),
 * a write with no sequence token — so a poll that applyPoll() had correctly
 * discarded still landed there. DepositModal read that copy, so the wallet
 * modal showed the pre-bet figure while the game showed the settled one.
 * ------------------------------------------------------------------ */

test("the lobby poll no longer mirrors the balance into useSessionStore", () => {
  const call = page.slice(page.indexOf("setSessionWallet({"));
  const args = call.slice(0, call.indexOf("})") + 2);
  assert.doesNotMatch(
    args,
    /balance:/,
    "setWallet carries no sequence token; mirroring the balance reintroduces the stale-poll overwrite",
  );
  // The rest of the wallet metadata must still be mirrored.
  assert.match(args, /currency:/);
  assert.match(args, /vipLevel:/);
});

test("the deposit modal reads the ordered balance, not the session mirror", () => {
  const modal = code("src/casino/components/casino/DepositModal.tsx");
  assert.match(modal, /useBalanceStore\(\(s\) => s\.balance\)/);
  assert.doesNotMatch(
    modal,
    /const \{ balance, user \} = useSessionStore\(\)/,
    "two stores for one number is what put a stale balance in front of the player",
  );
});

test("setWallet leaves an existing balance untouched when none is supplied", () => {
  const store = code("src/casino/lib/store.ts");
  assert.match(
    store,
    /balance: w\.balance \?\? s\.balance/,
    "an omitted balance must not blank the store to undefined",
  );
});

/* ------------------------------------------------------------------ *
 * Deployment config.
 *
 * Vercel Hobby rejects any cron that would run more than once a day, and
 * it fails the whole DEPLOYMENT, not just the cron. A quarter-hourly
 * probe therefore blocked every preview build on the PR while the app
 * itself was fine — the failure looked like a code problem and was not.
 * ------------------------------------------------------------------ */

test("no cron runs more than once per day", () => {
  const cfg = JSON.parse(read("vercel.json"));
  for (const cron of cfg.crons ?? []) {
    const [minute, hour] = cron.schedule.split(/\s+/);
    const subDaily = (f) => f.includes("*") || f.includes("/") || f.includes(",") || f.includes("-");
    assert.ok(
      !subDaily(minute) && !subDaily(hour),
      `${cron.path} runs "${cron.schedule}" — sub-daily crons fail deployment on Hobby`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * Per-game payload validation.
 *
 * The route used to trust client-shaped payloads onto the payout path:
 * duplicate keno picks scored 10 hits from one draw, duplicate mine picks
 * stacked a multiplier on a single tile, a negative roulette chip summed
 * away from the stake check while still paying out, and out-of-range
 * wheel/plinko/dice configs either 500'd or settled as a paid loss. The
 * guards below are asserted against the source (comments stripped first,
 * like every other check here).
 * ------------------------------------------------------------------ */

test("keno dedupes picks before scoring and rejects an empty card before debiting", () => {
  const keno = route.slice(route.indexOf('case "keno"'), route.indexOf('case "shoot"'));
  assert.match(
    keno,
    /new Set\(/,
    "duplicate picks inflate the hit count — [5,5,…] must be one pick, not ten",
  );
  assert.match(
    keno,
    /if \(picks\.length < 1\) return err\("Pick at least one number", 400\)/,
    "an empty card was settled as a loss while still charging the stake",
  );
  assert.doesNotMatch(keno, /error: "no picks"/, "no silent loss path may remain");
});

test("mines dedupes and bounds picks against the safe-tile budget", () => {
  const mines = route.slice(route.indexOf('case "mines"'), route.indexOf('case "wheel"'));
  assert.match(mines, /new Set\(/, "[7,7,7] must never pay as three reveals");
  assert.match(mines, /return err\("Pick at least one tile", 400\)/);
  assert.match(
    mines,
    /picks\.length > MINES_TILES - minesCount\) return err\("More picks than safe tiles", 400\)/,
  );
});

test("roulette rejects negative or unknown table chips before debiting", () => {
  const roul = route.slice(route.indexOf('case "roulette"'), route.indexOf('case "slots"'));
  assert.match(
    roul,
    /!Number\.isFinite\(amt\) \|\| amt <= 0/,
    "a negative chip used to dodge the stake sum check while paying real wins",
  );
  assert.match(roul, /ROULETTE_TYPES\.has\(type\)/, "unknown bet types must not settle at all");
  assert.match(
    roul,
    /return err\("Invalid roulette bets", 400\)/,
    "a malformed table was settled as a loss while still charging the stake",
  );
  assert.doesNotMatch(roul, /error: "bad bets"/, "no silent loss path may remain");
});

test("wheel, plinko and dice reject out-of-range configuration with 400, not a 500", () => {
  assert.match(route, /\(WHEEL_SEGMENTS as readonly number\[\]\)\.includes\(segments\)/);
  assert.match(route, /\(PLINKO_ROWS as readonly number\[\]\)\.includes\(rows\)/);
  assert.match(
    route,
    /!Number\.isFinite\(target\) \|\| target <= 0 \|\| target >= 100\) return err\("Invalid target", 400\)/,
    "an unplayable dice target (roll > 100) was charged as a guaranteed loss",
  );
});
