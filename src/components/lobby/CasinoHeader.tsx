"use client";

// Lobby shell header — extracted from page.tsx (Phase 2). Balance uses the
// PostedAmount signature (digit roll + posted tick on change).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Wallet, Menu, X, ChevronDown, MessageCircle,
  Crown, Vault, Coins, Share2, Bell, Receipt, Ticket, Settings,
  ShieldCheck, LifeBuoy, LogOut, type LucideIcon,
} from "lucide-react";
import { PostedAmount } from "@/casino/components/casino/PostedAmount";

export function CasinoHeader({ balance, onMenuToggle, menuOpen, searchQuery, onSearchChange, onProfileNavigate, onChatToggle, onNotifToggle, onWalletClick, authed, inGame = false }: {
  balance: number;
  /** Games use a compact one-row header; search is restored on lobby return. */
  inGame?: boolean;
  onMenuToggle: () => void;
  menuOpen: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onProfileNavigate: (section: string) => void;
  onChatToggle: () => void;
  onNotifToggle: () => void;
  onWalletClick: () => void;
  authed: boolean;
}) {
  const router = useRouter();
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
    { id: "wallet", label: "Wallet", icon: Wallet },
    { id: "vip", label: "VIP", icon: Crown },
    { id: "cassaforte", label: "Cassaforte", icon: Vault },
    { id: "token", label: "Token", icon: Coins },
    { id: "affiliate", label: "Affiliate Program", icon: Share2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "riscatta-codice", label: "Riscatta Codice", icon: Ticket },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const supportItems: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "play-responsibly", label: "Play Responsibly", icon: ShieldCheck },
    { id: "live-support", label: "Live Support", icon: LifeBuoy },
  ];

  const searchField = (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="global-search"
        type="text"
        placeholder="Search games..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-lg border border-border/60 bg-secondary/40 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-lime/40"
      />
    </div>
  );

  return (
    <header className={`casino-header sticky top-0 z-50 border-b border-lime/10 bg-background/95 backdrop-blur-xl${inGame ? " casino-header--game" : ""}`}>
      <div className="casino-header__bar flex h-14 items-center justify-between px-3 sm:px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="btn-press rounded-lg p-1.5 text-foreground/70 lg:hidden" aria-label="Toggle menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 onClick={() => onProfileNavigate("lobby")} className="font-wordmark cursor-pointer text-xl text-lime">
            TOLS
          </h1>
        </div>

        {/* Search — desktop */}
        <div className="mx-6 hidden max-w-md flex-1 items-center md:flex">{searchField}</div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onNotifToggle} aria-label="Notifications" className="casino-header__secondary btn-press rounded-lg p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
          <button onClick={onChatToggle} aria-label="Community chat" className="casino-header__secondary btn-press rounded-lg p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground">
            <MessageCircle className="h-5 w-5" />
          </button>
{authed ? (
          <button onClick={onWalletClick} title="Open wallet" className="flex items-center gap-2 rounded-lg border border-lime/15 bg-lime/10 px-3 py-1.5 cursor-pointer transition-colors hover:bg-lime/20">
            <Wallet className="h-4 w-4 text-lime" />
            <PostedAmount
              value={balance}
              format={(n) => `$${n.toFixed(2)}`}
              className="text-sm font-semibold text-lime"
            />
          </button>
          ) : (
          <button onClick={onWalletClick} title="Sign up to play for real" className="flex items-center gap-2 rounded-lg border border-lime/15 px-3 py-1.5 cursor-pointer transition-colors hover:bg-lime/20">
            <span className="text-[10px] font-black uppercase tracking-wide text-lime">Fun</span>
            <span className="rounded bg-lime px-2 py-0.5 text-[10px] font-black uppercase text-bg">Sign up</span>
          </button>
          )}
          {authed && (
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="btn-press flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5 text-foreground/70 transition-colors hover:bg-secondary sm:px-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-[10px] font-bold text-bg">T</div>
              <span className="hidden text-sm font-medium sm:inline">Player</span>
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
                    <span>Exit / Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Search — mobile lobby only. In-game the compact header gives the
          canvas an extra row of vertical space and removes a dead control. */}
      {!inGame && <div className="casino-header__mobile-search px-3 pb-3 sm:px-4 md:hidden">{searchField}</div>}
    </header>
  );
}
