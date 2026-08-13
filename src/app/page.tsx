"use client";

// GoldenX lobby shell — Phase 2: the 867-line inline shell now composes
// extracted components from src/components/lobby/. Behavior unchanged.
import React, { useState, useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Gamepad2 } from "lucide-react";
import dynamic from "next/dynamic";

import { CasinoHeader } from "@/components/lobby/CasinoHeader";
import { CasinoSidebar } from "@/components/lobby/CasinoSidebar";
import { CasinoFooter } from "@/components/lobby/CasinoFooter";
import { GameLoading, LobbyGameCard } from "@/components/lobby/GameCards";
import { GameDetailModal } from "@/components/lobby/GameDetailModal";
import { VirtualGameModal } from "@/components/lobby/VirtualGameModal";
import { SignupPromptModal } from "@/components/lobby/SignupPromptModal";
import { LobbyView, GamesGridSkeleton, EmptyGames } from "@/components/lobby/LobbyView";
import { HomeView } from "@/components/lobby/HomeView";
import { AuthGate } from "@/components/lobby/AuthGate";
import { OriginalsView } from "@/components/lobby/OriginalsView";
import { MobileBottomNav } from "@/components/lobby/MobileBottomNav";
import { ProfileSectionView, isProfileSection } from "@/components/lobby/ProfileSections";
import { ChatPanel, NotificationsPanel, VaultSheet } from "@/components/lobby/CommunityPanels";
import { CompactGameShell } from "@/components/lobby/CompactGameShell";
import { GameFeedback } from "@/components/casino/GameFeedback";
import VideoLoader from "@/components/VideoLoader";
import { DepositModal } from "@/casino/components/casino/DepositModal";
import { useUIStore, useSessionStore } from "@/lib/store";
import type { LobbyGame, LiveBet, CasinoStats } from "@/components/lobby/lobby-types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

/* ── Dynamic Game Imports ── */
const CrashGame = dynamic(
  () => import("@/components/casino/game-crash").then((m) => ({ default: m.CrashGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const DiceGame = dynamic(
  () => import("@/components/casino/game-dice").then((m) => ({ default: m.DiceGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const MinesGame = dynamic(
  () => import("@/components/casino/game-mines").then((m) => ({ default: m.MinesGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const WheelGame = dynamic(
  () => import("@/components/casino/game-wheel").then((m) => ({ default: m.WheelGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const KenoGame = dynamic(
  () => import("@/components/casino/game-keno").then((m) => ({ default: m.KenoGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const LimboGame = dynamic(
  () => import("@/components/casino/game-limbo").then((m) => ({ default: m.LimboGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const PlinkoGame = dynamic(
  () => import("@/components/casino/game-plinko").then((m) => ({ default: m.PlinkoGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const CoinflipGame = dynamic(
  () => import("@/components/casino/game-coinflip").then((m) => ({ default: m.CoinflipGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const ShootGame = dynamic(
  () => import("@/components/casino/game-shoot").then((m) => ({ default: m.ShootGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const SlotsGame = dynamic(
  () => import("@/components/casino/game-slots").then((m) => ({ default: m.SlotsGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const RouletteGame = dynamic(
  () => import("@/components/casino/game-roulette").then((m) => ({ default: m.RouletteGame })),
  { ssr: false, loading: () => <GameLoading /> }
);

/* ── Main Casino SPA ── */
function CasinoPage() {
  const [activeSection, setActiveSection] = useState("lobby");
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState(1000);
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CasinoStats | null>(null);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailGame, setDetailGame] = useState<LobbyGame | null>(null);
  const [virtualGame, setVirtualGame] = useState<LobbyGame | null>(null);
  // null = still checking, so the gate never flashes for a signed-in player.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [gateDismissed, setGateDismissed] = useState(true);
  const [gateMode, setGateMode] = useState<"login" | "register">("login");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const { setDepositOpen } = useUIStore();
  const setSessionUser = useSessionStore((s) => s.setUser);
  const setSessionWallet = useSessionStore((s) => s.setWallet);

  // Resolve session + balance. Logged-in users get THEIR wallet balance (real,
  // per-user). Guests get a fun balance that is never shown as real money.
  //
  // Also mirrors into useSessionStore: DepositModal reads `user` from that
  // store (not this component's `authed`) to decide whether to show deposit
  // options or a "sign in" prompt. Nothing ever called its setUser() on the
  // real login path (AuthGate) — only a legacy, unused AuthModal did — so a
  // signed-in player always hit "sign in to deposit" when opening the wallet.
  const refreshBalance = useCallback(async () => {
    try {
      const me = await (await fetch("/api/auth/me")).json();
      if (me?.data) {
        setAuthed(true);
        setBalance(Number(me.data.balance ?? 0));
        setSessionUser({
          id: me.data.id, username: me.data.username, email: me.data.email,
          avatarColor: me.data.avatarColor, level: me.data.level ?? 1,
        });
        setSessionWallet({
          balance: Number(me.data.balance ?? 0),
          currency: me.data.currency,
          vipLevel: me.data.vipLevel,
          totalWagered: me.data.totalWagered,
        });
        return;
      }
    } catch { /* fall through */ }
    setAuthed(false);
    setSessionUser(null);
    try {
      const w = await (await fetch("/api/wallet")).json();
      if (w?.success) setBalance(Number(w.data.balance ?? 0));
    } catch { /* ignore */ }
  }, [setSessionUser, setSessionWallet]);

  useEffect(() => {
    refreshBalance();
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  // Fetch games
  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        let cat = "all";
        if (activeSection === "slots") cat = "slots";
        else if (activeSection === "live") cat = "live";
        else if (activeSection === "originals") cat = "originals";
        else if (activeSection === "table") cat = "table";
        else if (activeSection === "recent") cat = "all";

        if (activeSection === "recent") {
          // Fetch recent bets to find recently played games
          try {
            const histRes = await fetch("/api/bets/history?limit=20");
            const histData = await histRes.json();
            if (histData.success && histData.data.bets.length > 0) {
              const gameIds = [...new Set(histData.data.bets.map((b: { gameId: string }) => b.gameId))];
              // Fetch all originals games for display
              const origRes = await fetch("/api/games-lobby?category=originals");
              const origData = await origRes.json();
              if (origData.success) {
                const filtered = origData.data.filter((g: LobbyGame) => gameIds.includes(g.slug) || gameIds.includes(g.name.toLowerCase()));
                setGames(filtered.length > 0 ? filtered : origData.data);
              }
            } else {
              setGames([]);
            }
          } catch {
            setGames([]);
          }
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/games-lobby?category=${cat}`);
        if (res.ok) {
          const data = await res.json();
          setGames(data.data || []);
        }
      } catch {
        setGames([]);
      }
      setLoading(false);
    };
    fetchGames();
  }, [activeSection]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/casino-stats");
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live bets
  useEffect(() => {
    const fetchBets = async () => {
      try {
        const res = await fetch("/api/bets?limit=20");
        const data = await res.json();
        if (data.success) setLiveBets(data.data);
      } catch { /* ignore */ }
    };
    fetchBets();
    const interval = setInterval(fetchBets, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSectionChange = useCallback((section: string) => {
    if (section === "login" || section === "register") {
      setGateMode(section);
      setGateDismissed(false);
      return;
    }
    setActiveSection(section);
    setActiveGame(null);
    setMenuOpen(false);
  }, []);

  // Profile menu routing — Cassaforte and Notifications open overlays
  // (Shuffle-style), everything else navigates to its section page.
  const handleProfileNavigate = useCallback((section: string) => {
    if (section === "wallet") { if (authed === true) setDepositOpen(true); else { setGateMode("register"); setGateDismissed(false); } return; }
    if (section === "cassaforte") { setVaultOpen(true); return; }
    if (section === "notifications") { setNotifOpen(true); return; }
    handleSectionChange(section);
  }, [handleSectionChange]);

  const handleGameClick = useCallback((game: LobbyGame) => {
    // Guests never had a wallet to bet from — the game opened anyway and the
    // first bet silently failed. Intercept here with the real next step.
    if (authed !== true) { setShowSignupPrompt(true); return; }
    if (game.gameType === "original") {
      setActiveGame(game.slug);
      setActiveSection("originals");
    } else if (game.gameType === "external_virtual") {
      setVirtualGame(game);
    } else {
      setDetailGame(game);
    }
  }, [authed]);

  const handleOriginalSelect = useCallback((gameId: string) => {
    if (authed !== true) { setShowSignupPrompt(true); return; }
    setActiveGame(gameId);
  }, [authed]);

  const handleBackFromGame = useCallback(() => {
    setActiveGame(null);
    refreshBalance();
  }, [refreshBalance]);

  // Filter games by search
  const displayedGames = searchQuery
    ? games.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.provider.toLowerCase().includes(searchQuery.toLowerCase()))
    : games;

  // Render active game
  const renderGame = () => {
    if (!activeGame) return null;
    const props = { onBack: handleBackFromGame, initialBalance: balance };
    switch (activeGame) {
      case "crash": return <CrashGame {...props} />;
      case "dice": return <DiceGame {...props} />;
      case "mines": return <MinesGame {...props} />;
      case "wheel": return <WheelGame {...props} />;
      case "keno": return <KenoGame {...props} />;
      case "limbo": return <LimboGame {...props} />;
      case "plinko": return <PlinkoGame {...props} />;
      case "coinflip": return <CoinflipGame {...props} />;
      case "shoot": return <ShootGame {...props} />;
      case "slots": return <SlotsGame {...props} />;
      case "roulette": return <RouletteGame {...props} />;
      default: return <p className="text-muted-foreground">Game not found</p>;
    }
  };

  const sectionTitle =
    activeSection === "slots" ? "Slots" :
    activeSection === "live" ? "Live Casino" :
    activeSection === "table" ? "Table Games" :
    activeSection === "recent" ? "Recently Played" :
    activeSection.charAt(0).toUpperCase() + activeSection.slice(1);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <VideoLoader ready={authed !== null && !loading} />
      <CasinoHeader
        balance={balance}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onProfileNavigate={handleProfileNavigate}
        onChatToggle={() => setChatOpen(true)}
        onNotifToggle={() => setNotifOpen(true)}
        onWalletClick={() => (authed === true ? setDepositOpen(true) : (setGateMode("register"), setGateDismissed(false)))}
        authed={authed === true}
      />
      <div className="flex flex-1 overflow-hidden">
        <CasinoSidebar active={activeSection} onSelect={handleSectionChange} open={menuOpen} />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {activeGame ? (
              <CompactGameShell gameKey={activeGame}>{renderGame()}</CompactGameShell>
            ) : isProfileSection(activeSection) ? (
              <ProfileSectionView section={activeSection} onBack={() => handleSectionChange("lobby")} />
            ) : activeSection === "originals" ? (
              <OriginalsView onGameSelect={handleOriginalSelect} />
            ) : activeSection === "lobby" ? (
              <HomeView
                games={games}
                loading={loading}
                onGameClick={handleGameClick}
                onNavigate={handleSectionChange}
                authenticated={authed === true}
              />
            ) : activeSection === "lobby-classic" ? (
              <LobbyView
                games={displayedGames}
                loading={loading}
                stats={stats}
                liveBets={liveBets}
                onGameClick={handleGameClick}
                onPlayCrash={() => handleOriginalSelect("crash")}
              />
            ) : (
              <div className="space-y-6">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold uppercase tracking-wide text-lime">{sectionTitle}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeSection === "recent" ? "Games you have played recently" : `${displayedGames.length} games available`}
                  </p>
                </div>
                {loading ? (
                  <GamesGridSkeleton />
                ) : displayedGames.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {displayedGames.map((game, i) => (
                      <LobbyGameCard key={game.id || i} game={game} onClick={() => handleGameClick(game)} />
                    ))}
                  </div>
                ) : (
                  <EmptyGames label="No games available" />
                )}
              </div>
            )}
          </div>
          {/* The footer is page chrome — in-game it only eats board space. */}
          {!activeGame && <CasinoFooter onNavigate={handleSectionChange} />}
        </main>
      </div>

      {detailGame && <GameDetailModal game={detailGame} onClose={() => setDetailGame(null)} />}
      {virtualGame && <VirtualGameModal game={virtualGame} onClose={() => setVirtualGame(null)} />}

      <MobileBottomNav
        activeSection={activeSection}
        chatOpen={chatOpen}
        onMenu={() => setMenuOpen(true)}
        onSearch={() => {
          const el = document.getElementById("global-search");
          window.scrollTo({ top: 0, behavior: "smooth" });
          (el as HTMLInputElement | null)?.focus();
        }}
        onChat={() => setChatOpen(true)}
        onRewards={() => handleSectionChange("rewards")}
        onCasino={() => handleSectionChange("originals")}
      />

      {authed === false && !gateDismissed && (
        <AuthGate
          initialMode={gateMode}
          onAuthenticated={() => { setAuthed(true); setGateDismissed(true); window.location.reload(); }}
          onDismiss={() => setGateDismissed(true)}
        />
      )}

      {showSignupPrompt && (
        <SignupPromptModal
          onRegister={() => { setShowSignupPrompt(false); setGateMode("register"); setGateDismissed(false); }}
          onLogin={() => { setShowSignupPrompt(false); setGateMode("login"); setGateDismissed(false); }}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}

      {/* Audio, haptics and win celebration for every game (see GameFeedback). */}
      <GameFeedback />

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <VaultSheet open={vaultOpen} onClose={() => setVaultOpen(false)} balance={balance} />
      <DepositModal />
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <CasinoPage />
        <Toaster position="bottom-right" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
