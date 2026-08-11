"use client";

// Mobile bottom navigation — Shuffle-style, TOLS-themed.
// Icons: Menu · Search · Chat · Rewards · Casino (Casino replaces "Sport"
// since this platform has no sportsbook). Shown below the lg breakpoint.

import { Menu, Search, MessageCircle, Gift, Dices } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  activeSection: string;
  chatOpen: boolean;
  onMenu: () => void;
  onSearch: () => void;
  onChat: () => void;
  onRewards: () => void;
  onCasino: () => void;
}

export function MobileBottomNav({ activeSection, chatOpen, onMenu, onSearch, onChat, onRewards, onCasino }: Props) {
  const items: { id: string; label: string; icon: LucideIcon; action: () => void; active: boolean }[] = [
    { id: "menu", label: "Menu", icon: Menu, action: onMenu, active: false },
    { id: "search", label: "Search", icon: Search, action: onSearch, active: false },
    { id: "chat", label: "Chat", icon: MessageCircle, action: onChat, active: chatOpen },
    { id: "rewards", label: "Rewards", icon: Gift, action: onRewards, active: activeSection === "rewards" },
    { id: "casino", label: "Casino", icon: Dices, action: onCasino, active: activeSection === "originals" || activeSection === "lobby" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-lime/10 bg-background/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {items.map(({ id, label, icon: Icon, action, active }) => (
          <button
            key={id}
            onClick={action}
            className="btn-press flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active ? "var(--color-lime)" : "rgba(255,255,255,0.45)" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={active ? { background: "color-mix(in oklab, var(--color-lime) 15%, transparent)" } : undefined}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
