"use client";

// Lobby shell sidebar — extracted from page.tsx (Phase 2). Active route
// indicator slides between items with layoutId.
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Star } from "lucide-react";
import { springs } from "@/casino/lib/motion";
import { NAV_ITEMS } from "./lobby-types";

export function CasinoSidebar({ active, onSelect, open }: { active: string; onSelect: (id: string) => void; open: boolean }) {
  const reduced = useReducedMotion();
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => onSelect(active)} />}
      <aside
        className={`fixed left-0 top-14 z-40 h-[calc(100vh-56px)] w-52 border-r border-lime/10 bg-background transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
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
                <span className="relative z-10">{item.label}</span>
                {isActive && <ChevronRight className="relative z-10 ml-auto h-3 w-3" />}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
