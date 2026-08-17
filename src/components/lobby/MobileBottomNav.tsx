"use client";

// Mobile bottom navigation — Shuffle-style, TOLS-themed.
// Home · Casino · Rewards · Chat · Menu. "Home" returns to the lobby landing
// (there was no way back to it from the thumb bar before); Search lives in the
// always-visible top bar so it isn't duplicated here. Shown below lg.

import { Home, Dices, Gift, MessageCircle, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface Props {
  activeSection: string;
  chatOpen: boolean;
  onHome: () => void;
  onCasino: () => void;
  onRewards: () => void;
  onChat: () => void;
  onMenu: () => void;
}

export function MobileBottomNav({ activeSection, chatOpen, onHome, onCasino, onRewards, onChat, onMenu }: Props) {
  const { t } = useLocale();
  const items: { id: string; label: string; icon: LucideIcon; action: () => void; active: boolean }[] = [
    { id: "home", label: t("nav.home"), icon: Home, action: onHome, active: activeSection === "lobby" },
    { id: "casino", label: t("nav.casino"), icon: Dices, action: onCasino, active: activeSection === "originals" },
    { id: "rewards", label: t("nav.rewards"), icon: Gift, action: onRewards, active: activeSection === "rewards" },
    { id: "chat", label: t("nav.chat"), icon: MessageCircle, action: onChat, active: chatOpen },
    { id: "menu", label: t("nav.menu"), icon: Menu, action: onMenu, active: false },
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
