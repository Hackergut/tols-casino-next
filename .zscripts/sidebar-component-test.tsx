// Component-level interaction test for the lobby sidebar + header menu toggle.
// Mounts the REAL CasinoHeader and CasinoSidebar wired exactly like
// src/app/page.tsx, then simulates clicks and asserts on classes/state.
import React, { useState, act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost/games/slots",
  pretendToBeVisual: true,
});

const w: any = dom.window;
(globalThis as any).window = w;
(globalThis as any).document = w.document;
Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
(globalThis as any).HTMLElement = w.HTMLElement;
(globalThis as any).Element = w.Element;
(globalThis as any).Node = w.Node;
(globalThis as any).MouseEvent = w.MouseEvent;
(globalThis as any).CustomEvent = w.CustomEvent;
(globalThis as any).getComputedStyle = w.getComputedStyle.bind(w);
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
if (!w.matchMedia) {
  w.matchMedia = (q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
    dispatchEvent: () => false,
  });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { CasinoHeader } from "../src/components/lobby/CasinoHeader";
import { CasinoSidebar } from "../src/components/lobby/CasinoSidebar";

function Harness() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("lobby");
  const [searchQuery, setSearchQuery] = useState("");

  // Same wiring as page.tsx: handleSectionChange → navigate() → setMenuOpen(false)
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setMenuOpen(false);
    window.scrollTo?.({ top: 0 } as any);
  };

  return (
    <>
      <CasinoHeader
        balance={0}
        bonusBalance={0}
        wageringRemaining={0}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
        onProfileNavigate={handleSectionChange}
        onChatToggle={() => {}}
        onNotifToggle={() => {}}
        onWalletClick={() => {}}
        authed={false}
        inGame={false}
        games={[]}
        onGameClick={() => {}}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CasinoSidebar
          active={activeSection}
          onSelect={handleSectionChange}
          open={menuOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main><span>CURRENT:{activeSection}</span></main>
      </div>
    </>
  );
}

async function main() {
  const root = createRoot(document.getElementById("root")!);
  await act(async () => { root.render(<Harness />); });

  const aside = () => document.querySelector("aside.casino-sidebar") as HTMLElement | null;
  const toggle = () => document.querySelector('button[aria-label]') as HTMLElement | null; // first aria-labeled button = menu toggle left-most
  const isClosed = () => !!aside() && aside()!.className.includes("-translate-x-full");
  const isOpen = () => !!aside() && !isClosed();
  const section = () => document.querySelector("main span")!.textContent!.replace("CURRENT:", "");
  const click = (el: Element) => { el.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true })); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };

  const results: [string, boolean][] = [];
  const check = (name: string, ok: boolean) => results.push([name, ok]);

  console.log("DEBUG html length:", document.body.innerHTML.length);
  console.log("DEBUG buttons + aria-labels:");
  document.querySelectorAll("button").forEach((b, i) =>
    console.log("  ", i, JSON.stringify(b.getAttribute("aria-label") || ""), JSON.stringify((b.textContent || "").trim().slice(0, 24))),
  );
  console.log("DEBUG root children:", (document.getElementById("root")?.innerHTML || "").slice(0, 400));

  check("sidebar renders", !!aside());
  check("starts closed", isClosed());
  check("menu toggle button present", !!toggle());

  // Find the header toggle precisely: it contains a Menu/X icon and has aria-label "Toggle menu"
  const headerToggle = [...document.querySelectorAll("header button")].find((b) => /toggle menu/i.test(b.getAttribute("aria-label") || ""));

  check("header toggle found (aria-label)", !!headerToggle);

  // OPEN
  await act(async () => { click(headerToggle!); });
  check("opens on toggle click", isOpen());
  check("scrim present when open", !!document.querySelector("div.fixed.inset-0.z-40.bg-black\\/50") || !!document.querySelector("div.fixed.inset-0.z-40"));

  // Sidebar nav list renders sections
  const navBtns = () => [...aside()!.querySelectorAll("nav button")];
  check("renders 15 nav items", navBtns().length === 15);

  // Click "Originals"
  const originalsBtn = navBtns().find((b) => /originals/i.test(b.textContent || ""));
  check("'Originals' item present", !!originalsBtn);
  await act(async () => { click(originalsBtn!); });
  check("navigates to originals", section() === "originals");
  check("menu auto-closes after selection", isClosed());

  // Reopen then close via scrim
  await act(async () => { click(headerToggle as unknown as Element); });
  check("reopens", isOpen());
  const scrim = document.querySelector("div.fixed.inset-0.z-40");
  check("scrim exists", !!scrim);
  await act(async () => { click(scrim!); });
  check("scrim click closes the menu", isClosed());

  // Reopen then close via toggle
  await act(async () => { click(headerToggle as unknown as Element); });
  await act(async () => { click(headerToggle as unknown as Element); });
  check("toggle closes", isClosed());

  // Search input wiring
  await act(async () => { click(headerToggle as unknown as Element); });
  const input = aside()!.querySelector('input[type="search"]') as HTMLInputElement;
  check("search input present", !!input);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "cr");
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
  });
  // After typing, component should NOT crash and menu should stay open
  check("typing in search keeps menu open", isOpen());

  let pass = 0;
  for (const [name, ok] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (ok) pass++; }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
