import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("guest header exposes separate login and registration actions", () => {
  const header = read("src/components/lobby/CasinoHeader.tsx");
  assert.match(header, /onProfileNavigate\("login"\)/);
  assert.match(header, /onProfileNavigate\("register"\)/);
  assert.doesNotMatch(header, />Fun</);
});

test("global search lives in the hamburger sidebar, not the top header", () => {
  const header = read("src/components/lobby/CasinoHeader.tsx");
  const sidebar = read("src/components/lobby/CasinoSidebar.tsx");
  assert.doesNotMatch(header, /id="global-search"/);
  assert.match(sidebar, /type="search"/);
  assert.match(sidebar, /searchQuery/);
  const page = read("src/app/page.tsx");
  assert.match(page, /games=\{displayedGames\}/);
  assert.match(page, /<OriginalsView[\s\S]*?query=\{searchQuery\}/);
});

test("home hierarchy is hero then category tabs then Originals", () => {
  const home = read("src/components/lobby/HomeView.tsx");
  const render = home.slice(home.indexOf("return (", home.indexOf("export function HomeView")));
  assert.ok(render.indexOf("<HeroCarousel") < render.indexOf("<CategoryNav"));
  assert.ok(render.indexOf("<CategoryNav") < render.indexOf('row("TOLS Originals"'));
  assert.doesNotMatch(render, /<PromoStrip/);
});

test("Recent does not treat aborted history reads as lost bets", () => {
  const page = read("src/app/page.tsx");
  const feedback = read("src/components/casino/GameFeedback.tsx");
  assert.match(page, /\/api\/bets\/history\?limit=20/);
  assert.match(page, /\[activeSection, routeReady\]/);
  assert.doesNotMatch(page, /cmsOverrides\]\)/);
  assert.match(feedback, /installBetFetchGuard/);
});

test("the header and settings show the connected account, not the demo TOLSPlayer", () => {
  const header = read("src/components/lobby/CasinoHeader.tsx");
  const settings = read("src/components/lobby/ProfileSections.tsx");
  const callback = read("src/app/api/auth/google/callback/route.ts");
  const gate = read("src/components/lobby/AuthGate.tsx");
  assert.doesNotMatch(header, /TOLSPlayer/);
  assert.match(header, /sessionUser\?\.username/);
  assert.doesNotMatch(settings, /right=\"TOLSPlayer\"/);
  assert.match(settings, /\/api\/auth\/me/);
  assert.match(callback, /\/account\/settings/);
  assert.match(gate, /location\.assign\(["']\/api\/auth\/google["']\)/);
  assert.doesNotMatch(gate, /googleAvailable/);
});

test("mobile has one chat icon and guests are routed to registration", () => {
  const header = read("src/components/lobby/CasinoHeader.tsx");
  const page = read("src/app/page.tsx");
  assert.match(header, /MessageCircle[\s\S]*?hidden[\s\S]*?lg:inline-flex/);
  assert.match(page, /const handleChatOpen[\s\S]*?setGateMode\("register"\)/);
  assert.match(page, /onChat=\{handleChatOpen\}/);
  assert.match(page, /open=\{chatOpen && authed === true\}/);
});
