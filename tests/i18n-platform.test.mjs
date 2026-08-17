import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const i18n = mod.exports;

test("explicit language wins over geo and browser detection", () => {
  assert.equal(i18n.resolveLocale({ cookie: "de", country: "IT", acceptLanguage: "fr" }), "de");
});

test("geo selects the platform language before Accept-Language", () => {
  assert.equal(i18n.resolveLocale({ country: "IT", acceptLanguage: "en" }), "it");
  assert.equal(i18n.resolveLocale({ country: "ES", acceptLanguage: "en" }), "es");
  assert.equal(i18n.resolveLocale({ country: "BR", acceptLanguage: "en" }), "pt");
  assert.equal(i18n.resolveLocale({ country: "AE", acceptLanguage: "en-AE" }), "en");
});

test("core navigation never falls back to raw translation keys", () => {
  const keys = ["common.back", "common.close", "nav.home", "nav.originals", "nav.liveCasino", "nav.table", "nav.leaderboards", "header.signup", "games.none"];
  for (const locale of i18n.LOCALES) for (const key of keys) assert.notEqual(i18n.translate(locale, key), key, `${locale} missing ${key}`);
});

test("server layout consumes the Edge-resolved locale before first paint", () => {
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /get\("x-locale"\)/);
  assert.match(layout, /<LocaleProvider initialLocale=\{locale\}>/);
  assert.match(layout, /<html lang=\{locale\}/);
});

test("core shell components consume the shared locale instead of fixed Italian labels", () => {
  const files = ["CasinoHeader.tsx", "CasinoSidebar.tsx", "MobileBottomNav.tsx", "HomeView.tsx", "HeroCarousel.tsx", "Carousel.tsx", "CompactGameShell.tsx"];
  for (const file of files) {
    const component = readFileSync(new URL(`../src/components/lobby/${file}`, import.meta.url), "utf8");
    assert.match(component, /useLocale/, `${file} is disconnected from global locale`);
    assert.doesNotMatch(component, /Promozione precedente|Promozione successiva|Scorri a sinistra|Scorri a destra|Chiudi impostazioni|Impostazioni di gioco/, `${file} contains a fixed Italian label`);
  }
});

test("hero game calls route through authenticated Original selection", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /ORIGINAL_IDS\.has\(target as OriginalId\) \? handleOriginalSelect\(target\)/);
});

test("hero marketing derives RTP copy from game math and routes Blackjack correctly", () => {
  const hero = readFileSync(new URL("../src/components/lobby/HeroCarousel.tsx", import.meta.url), "utf8");
  assert.match(hero, /TARGET_RTP, SLOTS_RTP/);
  assert.match(hero, /id: "blackjack"[\s\S]*?target: "blackjack"/);
  assert.doesNotMatch(hero, /92% RTP|1\.9% edge|baccarat\.jpg/);
});
