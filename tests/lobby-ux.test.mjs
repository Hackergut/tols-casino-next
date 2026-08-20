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

test("mobile has one chat icon and guests are routed to registration", () => {
  const header = read("src/components/lobby/CasinoHeader.tsx");
  const page = read("src/app/page.tsx");
  assert.match(header, /MessageCircle[\s\S]*?hidden[\s\S]*?lg:inline-flex/);
  assert.match(page, /const handleChatOpen[\s\S]*?setGateMode\("register"\)/);
  assert.match(page, /onChat=\{handleChatOpen\}/);
  assert.match(page, /open=\{chatOpen && authed === true\}/);
});
