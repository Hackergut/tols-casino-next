"use client";

// Lobby shell sidebar — grouped into sections (Personal / Games / Discover).
// Active route indicator slides between items with layoutId; a transparent
// scrim closes the off-canvas drawer on mobile.
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Search } from "lucide-react";
import { springs } from "@/casino/lib/motion";
import { SIDEBAR_SECTIONS } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

export function CasinoSidebar({ active, onSelect, open, searchQuery, onSearchChange }: { active: string; onSelect: (id: string) => void; open: boolean; searchQuery: string; onSearchChange: (value: string) => void }) {
  const reduced = useReducedMotion();
  const { t } = useLocale();
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => onSelect(active)} />}
      <aside
        className={`casino-sidebar fixed left-0 top-14 z-40 h-[calc(100dvh-56px)] w-[min(84vw,280px)] border-r border-lime/10 bg-background transition-transform duration-300 md:top-14 md:h-[calc(100dvh-56px)] lg:static lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/6 px-3 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") onSelect(active); }}
              placeholder={t("search.placeholder")}
              className="h-10 w-full rounded-xl border border-white/8 bg-white/[.035] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-lime/35"
            />
          </label>
        </div>
        <nav className="space-y-5 px-3 py-4">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.id}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                {t(section.titleKey)}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item.id)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
                        isActive ? "text-lime" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="lobby-nav-active"
                          transition={reduced ? { duration: 0 } : springs.snappy}
                          className="absolute inset-0 rounded-lg bg-lime/10"
                        />
                      )}
                      <item.icon className="relative z-10 h-4 w-4 shrink-0" />
                      <span className="relative z-10">{t(item.labelKey)}</span>
                      {isActive && <ChevronRight className="relative z-10 ml-auto h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
