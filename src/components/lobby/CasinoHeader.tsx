"use client";

// Lobby shell header — extracted from page.tsx (Phase 2). Balance uses the
// PostedAmount signature (digit roll + posted tick on change).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Menu, X, ChevronDown, MessageCircle,
  Crown, Vault, Coins, Share2, Bell, Receipt, Ticket, Settings,
  ShieldCheck, LifeBuoy, LogOut, type LucideIcon,
} from "lucide-react";
import { PostedAmount } from "@/casino/components/casino/PostedAmount";
import { SearchBar } from "./SearchBar";
import type { LobbyGame } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

export function CasinoHeader({ balance, bonusBalance = 0, wageringRemaining = 0, onMenuToggle, menuOpen, onProfileNavigate, onChatToggle, onNotifToggle, onWalletClick, authed, inGame = false, games = [], onGameClick }: {
  balance: number;
  bonusBalance?: number;
  wageringRemaining?: number;
  inGame?: boolean;
  onMenuToggle: () => void;
  menuOpen: boolean;
  onProfileNavigate: (section: string) => void;
  onChatToggle: () => void;
  onNotifToggle: () => void;
  onWalletClick: () => void;
  authed: boolean;
  games?: LobbyGame[];
  onGameClick?: (game: LobbyGame) => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setUserOpen(false);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    router.push("/");
    router.refresh();
  };

  // Profile menu entries. `id` is a stable slug ready to route/wire to a view.
  const menuItems: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "wallet", label: t("nav.wallet"), icon: Wallet },
    { id: "vip", label: "VIP", icon: Crown },
    { id: "vault", label: t("profile.vault"), icon: Vault },
    { id: "token", label: t("profile.token"), icon: Coins },
    { id: "affiliate", label: t("profile.affiliate"), icon: Share2 },
    { id: "notifications", label: t("header.notifications"), icon: Bell },
    { id: "transactions", label: t("profile.transactions"), icon: Receipt },
    { id: "redeem", label: t("profile.redeem"), icon: Ticket },
    { id: "settings", label: t("nav.settings"), icon: Settings },
  ];
  const supportItems: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "play-responsibly", label: t("profile.responsible"), icon: ShieldCheck },
    { id: "live-support", label: t("profile.support"), icon: LifeBuoy },
  ];



  return (
    <header className={`casino-header sticky top-0 z-50 border-b border-lime/10 bg-background/95 backdrop-blur-xl${inGame ? " casino-header--game" : ""}`}>
      <div className="casino-header__bar flex h-14 items-center justify-between px-3 sm:px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="btn-press rounded-lg p-1.5 text-foreground/70 lg:hidden" aria-label={t("header.toggleMenu")}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 onClick={() => onProfileNavigate("lobby")} className="font-wordmark cursor-pointer text-xl text-lime">
            TOLS
          </h1>
        </div>

        {/* Center: global search (desktop) */}
        <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
          {!inGame && onGameClick && (
            <SearchBar games={games} onGameClick={onGameClick} className="w-full max-w-sm" />
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onNotifToggle} aria-label={t("header.notifications")} className="casino-header__secondary btn-press rounded-lg p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
          <button onClick={onChatToggle} aria-label={t("header.community")} className="casino-header__secondary btn-press hidden rounded-lg p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex">
            <MessageCircle className="h-5 w-5" />
          </button>
{authed ? (
          <div className="flex items-center gap-1.5">
            {bonusBalance > 0 && (
              <button
                onClick={onWalletClick}
                title={`Bonus ${bonusBalance.toFixed(2)} — ${wageringRemaining.toFixed(2)} wagering remaining`}
                className="hidden items-center gap-1.5 rounded-lg border border-vip/30 bg-vip/10 px-2.5 py-1.5 cursor-pointer transition-colors hover:bg-vip/20 sm:flex"
              >
                <Coins className="h-4 w-4 text-vip" />
                <span className="text-xs font-semibold text-vip">${bonusBalance.toFixed(2)}</span>
              </button>
            )}
            <button onClick={onWalletClick} title={t("header.openWallet")} className="flex items-center gap-2 rounded-lg border border-lime/15 bg-lime/10 px-3 py-1.5 cursor-pointer transition-colors hover:bg-lime/20">
              <Wallet className="h-4 w-4 text-lime" />
              <PostedAmount
                value={balance}
                format={(n) => `$${n.toFixed(2)}`}
                className="text-sm font-semibold text-lime"
              />
            </button>
          </div>
          ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => onProfileNavigate("login")} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] font-bold text-white/75 transition-colors hover:border-lime/40 hover:text-white sm:px-3 sm:text-xs">
              {t("auth.login")}
            </button>
            <button onClick={() => onProfileNavigate("register")} className="rounded-lg bg-lime px-2.5 py-1.5 text-[11px] font-black text-bg transition-colors hover:bg-lime/90 sm:px-3 sm:text-xs">
              {t("auth.register")}
            </button>
          </div>
          )}
          {authed && (
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="btn-press flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5 text-foreground/70 transition-colors hover:bg-secondary sm:px-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-[10px] font-bold text-bg">T</div>
              <span className="hidden text-sm font-medium sm:inline">{t("header.player")}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-56 overflow-y-auto rounded-xl border border-border/60 bg-surface shadow-xl">
                <div className="border-b border-border/40 p-3">
                  <p className="text-sm font-medium text-foreground">TOLSPlayer</p>
                  <p className="text-xs text-vip">VIP Level 3</p>
                </div>

                <div className="p-2">
                  {menuItems.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setUserOpen(false); onProfileNavigate(id); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-lime/70" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/40 p-2">
                  {supportItems.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setUserOpen(false); onProfileNavigate(id); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-lime/70" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/40 p-2">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-loss transition-colors hover:bg-loss/10"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>{t("header.logout")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

    </header>
  );
}
