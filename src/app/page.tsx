"use client";

// GoldenX lobby shell — Phase 2: the 867-line inline shell now composes
// extracted components from src/components/lobby/. Behavior unchanged.
import React, { useState, useCallback, useEffect } from "react";
import { useBalanceStore } from "@/lib/balance-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Gamepad2 } from "lucide-react";
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
import { LeaderboardHub } from "@/components/lobby/LeaderboardHub";
import { GameFeedback } from "@/components/casino/GameFeedback";
import VideoLoader from "@/components/VideoLoader";
import { DepositModal } from "@/casino/components/casino/DepositModal";
import { useUIStore, useSessionStore } from "@/lib/store";
import { casinoPath, ORIGINAL_IDS, parseCasinoRoute } from "@/lib/casino-routes";
import { useLocale } from "@/lib/use-locale";
import type { LobbyGame, LiveBet, CasinoStats } from "@/components/lobby/lobby-types";
import type { OriginalId } from "@/lib/originals-registry";

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
const PoolRushGame = dynamic(
  () => import("@/components/casino/game-poolrush").then((m) => ({ default: m.PoolRushGame })),
  { ssr: false, loading: () => <GameLoading /> }
);
const BlackjackGame = dynamic(
  () => import("@/components/casino/game-blackjack").then((m) => ({ default: m.BlackjackGame })),
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
  const { t } = useLocale();
  const [activeSection, setActiveSection] = useState("lobby");
  const [routeReady, setRouteReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * Balance comes from the shared store, which orders writes by sequence so a
   * 15s poll landing mid-round can no longer overwrite a settled bet result
   * with the pre-bet snapshot it read before the bet existed.
   */
  const balance = useBalanceStore((s) => s.balance);
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

  // Durable client routing. Known public paths are rewritten to this shell by
  // proxy.ts, while the visible URL stays intact for refresh/deep-link/Back.
  useEffect(() => {
    const applyLocation = () => {
      const route = parseCasinoRoute(window.location.pathname);
      setActiveSection(route.section);
      setActiveGame(route.game);
      setMenuOpen(false);
      setRouteReady(true);
    };
    const state = window.history.state as { tols?: boolean; index?: number } | null;
    if (!state?.tols) window.history.replaceState({ ...(state || {}), tols: true, index: 0 }, "", window.location.href);
    queueMicrotask(applyLocation);
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, []);

  const navigate = useCallback((section: string, game: string | null = null, replace = false) => {
    const path = casinoPath(section, game);
    const current = window.history.state as { index?: number } | null;
    const state = { tols: true, index: replace ? (current?.index ?? 0) : (current?.index ?? 0) + 1 };
    if (replace || window.location.pathname === path) window.history.replaceState(state, "", path);
    else window.history.pushState(state, "", path);
    setActiveSection(section);
    setActiveGame(game);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigateBack = useCallback((fallbackSection = "lobby") => {
    const state = window.history.state as { tols?: boolean; index?: number } | null;
    if (state?.tols && (state.index ?? 0) > 0) window.history.back();
    else navigate(fallbackSection, null, true);
  }, [navigate]);

  // Resolve session + balance. Logged-in users get THEIR wallet balance (real,
  // per-user). Guests get a fun balance that is never shown as real money.
  //
  // Also mirrors into useSessionStore: DepositModal reads `user` from that
  // store (not this component's `authed`) to decide whether to show deposit
  // options or a "sign in" prompt. Nothing ever called its setUser() on the
  // real login path (AuthGate) — only a legacy, unused AuthModal did — so a
  // signed-in player always hit "sign in to deposit" when opening the wallet.
  const refreshBalance = useCallback(async () => {
    // Token the read against the store's current sequence. If a bet settles
    // while these requests are in flight, the poll's value is discarded.
    const token = useBalanceStore.getState().begin();
    try {
      const me = await (await fetch("/api/auth/me")).json();
      if (me?.data) {
        setAuthed(true);
        useBalanceStore.getState().applyPoll(Number(me.data.balance ?? 0), token);
        setSessionUser({
          id: me.data.id, username: me.data.username, email: me.data.email,
          avatarColor: me.data.avatarColor, level: me.data.level ?? 1,
        });
        // Currency/VIP/wagered only. The balance deliberately does NOT go
        // through here: setWallet takes no sequence token, so mirroring it
        // would reintroduce the stale-poll overwrite that applyPoll rejects.
        // Consumers read the balance from useBalanceStore.
        setSessionWallet({
          currency: me.data.currency,
          vipLevel: me.data.vipLevel,
          totalWagered: me.data.totalWagered,
        });
        return;
      }
    } catch { /* fall through */ }
    setAuthed(false);
    setChatOpen(false);
    setSessionUser(null);
    try {
      const w = await (await fetch("/api/wallet")).json();
      if (w?.success) useBalanceStore.getState().applyPoll(Number(w.data.balance ?? 0), token);
    } catch { /* ignore */ }
  }, [setSessionUser, setSessionWallet]);

  useEffect(() => {
    // Kick the first read off the effect body: refreshBalance() sets state
    // synchronously on its early paths, which triggers a cascading render.
    // Wrapping it defers the state writes to the async continuation.
    void (async () => {
      await refreshBalance();
    })();
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  // Fetch games. Wait for URL hydration and abort the previous category read;
  // otherwise a slower Lobby response can overwrite a newer Slots/Originals
  // response after rapid navigation.
  useEffect(() => {
    if (!routeReady) return;
    const controller = new AbortController();
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
            const histRes = await fetch("/api/bets/history?limit=20", { signal: controller.signal });
            const histData = await histRes.json();
            if (histData.success && histData.data.bets.length > 0) {
              const gameIds = [...new Set(histData.data.bets.map((b: { gameId: string }) => b.gameId))];
              // Fetch all originals games for display
              const origRes = await fetch("/api/games-lobby?category=originals", { signal: controller.signal });
              const origData = await origRes.json();
              if (origData.success) {
                const filtered = origData.data.filter((g: LobbyGame) => gameIds.includes(g.slug) || gameIds.includes(g.name.toLowerCase()));
                setGames(filtered.length > 0 ? filtered : origData.data);
              }
            } else {
              setGames([]);
            }
          } catch {
            if (!controller.signal.aborted) setGames([]);
          }
          if (!controller.signal.aborted) setLoading(false);
          return;
        }

        const res = await fetch(`/api/games-lobby?category=${cat}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setGames(data.data || []);
        }
      } catch {
        if (!controller.signal.aborted) setGames([]);
      }
      if (!controller.signal.aborted) setLoading(false);
    };
    void fetchGames();
    return () => controller.abort();
  }, [activeSection, routeReady]);

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
    navigate(section);
  }, [navigate]);

  // Profile menu routing — Cassaforte and Notifications open overlays
  // (Shuffle-style), everything else navigates to its section page.
  const handleProfileNavigate = useCallback((section: string) => {
    if (section === "wallet") { if (authed === true) setDepositOpen(true); else { setGateMode("register"); setGateDismissed(false); } return; }
    if (section === "cassaforte") { setVaultOpen(true); return; }
    if (section === "notifications") { setNotifOpen(true); return; }
    handleSectionChange(section);
  }, [handleSectionChange]);

  const handleChatOpen = useCallback(() => {
    if (authed === true) {
      setChatOpen(true);
      return;
    }
    setGateMode("register");
    setGateDismissed(false);
  }, [authed]);

  const handleGameClick = useCallback((game: LobbyGame) => {
    // Guests never had a wallet to bet from — the game opened anyway and the
    // first bet silently failed. Intercept here with the real next step.
    if (authed !== true) { setShowSignupPrompt(true); return; }
    if (game.gameType === "original") {
      navigate("originals", game.slug);
    } else if (game.gameType === "external_virtual") {
      setVirtualGame(game);
    } else {
      setDetailGame(game);
    }
  }, [authed, navigate]);

  const handleOriginalSelect = useCallback((gameId: string) => {
    if (authed !== true) { setShowSignupPrompt(true); return; }
    navigate("originals", gameId);
  }, [authed, navigate]);

  const handleBackFromGame = useCallback(() => {
    navigateBack("originals");
    refreshBalance();
  }, [navigateBack, refreshBalance]);

  const handleSwitchGame = useCallback((gameId: string) => {
    navigate("originals", gameId, true);
    refreshBalance();
    // The incoming game mounts with its own canvas; without this the player
    // lands mid-page on the previous game's bet feed.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate, refreshBalance]);

  // A deep-linked game still obeys the same authenticated-session gate as a
  // clicked card; URLs cannot bypass the user-friendly login flow.
  useEffect(() => {
    if (!routeReady || authed !== false || !activeGame) return;
    const task = window.setTimeout(() => {
      setShowSignupPrompt(true);
      navigate("originals", null, true);
    }, 0);
    return () => window.clearTimeout(task);
  }, [activeGame, authed, navigate, routeReady]);

  // Filter games by search
  const displayedGames = searchQuery
    ? games.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.provider.toLowerCase().includes(searchQuery.toLowerCase()))
    : games;

  // Render active game
  const renderGame = () => {
    if (!activeGame) return null;
    // onPickGame powers the "More from TOLS Originals" rail under every
    // canvas: switching game keeps the player in the game view rather than
    // bouncing them through the lobby. Balance is refreshed on the way, since
    // the outgoing game may have settled bets.
    const props = {
      onBack: handleBackFromGame,
      initialBalance: balance,
      onPickGame: handleSwitchGame,
    };
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
      case "poolrush": return <PoolRushGame {...props} />;
      case "blackjack": return <BlackjackGame {...props} />;
      case "slots": return <SlotsGame {...props} />;
      case "roulette": return <RouletteGame {...props} />;
      default: return <p className="text-muted-foreground">{t("games.notFound")}</p>;
    }
  };

  const sectionTitle =
    activeSection === "slots" ? t("nav.slots") :
    activeSection === "live" ? t("nav.liveCasino") :
    activeSection === "table" ? t("nav.table") :
    activeSection === "recent" ? t("nav.recent") :
    activeSection.charAt(0).toUpperCase() + activeSection.slice(1);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <VideoLoader ready={routeReady && authed !== null && !loading} />
      <CasinoHeader
        balance={balance}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
        onProfileNavigate={handleProfileNavigate}
        onChatToggle={handleChatOpen}
        onNotifToggle={() => setNotifOpen(true)}
        onWalletClick={() => (authed === true ? setDepositOpen(true) : (setGateMode("register"), setGateDismissed(false)))}
        authed={authed === true}
        inGame={Boolean(activeGame)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CasinoSidebar active={activeSection} onSelect={handleSectionChange} open={menuOpen} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main className={`min-w-0 flex-1 overflow-y-auto ${activeGame ? "casino-main--game" : "pb-20 lg:pb-0"}`}>
          <div className={`casino-content mx-auto w-full max-w-[1600px] ${activeGame ? "p-2 sm:p-4 lg:p-6" : "p-3 sm:p-6 lg:p-8"}`}>
            {!activeGame && activeSection !== "lobby" && activeSection !== "rewards" && !isProfileSection(activeSection) && (
              <button type="button" onClick={() => navigateBack("lobby")} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/8 bg-surface/60 px-3 text-xs font-bold text-white/60 transition-colors hover:border-lime/30 hover:text-lime">
                <ArrowLeft className="h-4 w-4" /> {t("common.back")}
              </button>
            )}
            {activeGame ? (
              <CompactGameShell gameKey={activeGame}>{renderGame()}</CompactGameShell>
            ) : activeSection === "rewards" ? (
              <LeaderboardHub onPlay={() => handleSectionChange("originals")} onBack={() => navigateBack("lobby")} />
            ) : isProfileSection(activeSection) ? (
              <ProfileSectionView section={activeSection} onBack={() => navigateBack("lobby")} />
            ) : activeSection === "originals" ? (
              <OriginalsView onGameSelect={handleOriginalSelect} query={searchQuery} />
            ) : activeSection === "lobby" ? (
              <HomeView
                games={displayedGames}
                loading={loading}
                onGameClick={handleGameClick}
                onNavigate={(target) => ORIGINAL_IDS.has(target as OriginalId) ? handleOriginalSelect(target) : handleSectionChange(target)}
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
                    {activeSection === "recent" ? t("games.recentHelp") : t("games.available", { count: displayedGames.length })}
                  </p>
                </div>
                {loading ? (
                  <GamesGridSkeleton />
                ) : displayedGames.length > 0 ? (
                  <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {displayedGames.map((game, i) => (
                      <LobbyGameCard key={game.id || i} game={game} onClick={() => handleGameClick(game)} />
                    ))}
                  </div>
                ) : (
                  <EmptyGames label={t("games.none")} />
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

      {/* Once inside a game, its back button and bottom bet sheet are the
          primary navigation. Hiding the global thumb bar prevents accidental
          exits and returns 64px of scarce phone height to the canvas. */}
      {!activeGame && (
        <MobileBottomNav
          activeSection={activeSection}
          chatOpen={chatOpen}
          onHome={() => handleSectionChange("lobby")}
          onCasino={() => handleSectionChange("originals")}
          onRewards={() => handleSectionChange("rewards")}
          onChat={handleChatOpen}
          onMenu={() => setMenuOpen(true)}
        />
      )}

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

      <ChatPanel open={chatOpen && authed === true} onClose={() => setChatOpen(false)} />
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
