"use client";

import React, { useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useUIStore, useSessionStore } from "@/casino/lib/store";
import { useAdminStore } from "@/stores/admin";

/* ── Casino UI imports ── */
import { Header } from "@/casino/components/casino/Header";
import { Sidebar } from "@/casino/components/casino/Sidebar";
import { Footer } from "@/casino/components/casino/Footer";
import { Lobby } from "@/casino/components/casino/sections/Lobby";
import { GamesGrid } from "@/casino/components/casino/sections/GamesGrid";
import { GamePlayer } from "@/casino/components/casino/games/GamePlayer";
import { Tournaments } from "@/casino/components/casino/sections/Tournaments";
import { Winners } from "@/casino/components/casino/sections/Winners";
import { Marketplace } from "@/casino/components/casino/sections/Marketplace";
import { MyCollection } from "@/casino/components/casino/sections/MyCollection";
import { BetHistory } from "@/casino/components/casino/sections/BetHistory";
import { WalletSection } from "@/casino/components/casino/sections/WalletSection";
import { VIPTiers } from "@/casino/components/casino/sections/VIPTiers";
import { Leaderboard } from "@/casino/components/casino/sections/Leaderboard";
import { Promotions } from "@/casino/components/casino/sections/Promotions";
import { DailyChallenges } from "@/casino/components/casino/sections/DailyChallenges";
import { GameStatsDashboard } from "@/casino/components/casino/sections/GameStatsDashboard";
import { SocialFeed } from "@/casino/components/casino/sections/SocialFeed";
import { Affiliate } from "@/casino/components/casino/sections/Affiliate";
import { UserProfile } from "@/casino/components/casino/sections/UserProfile";
import { ResponsibleGaming } from "@/casino/components/casino/sections/ResponsibleGaming";
import { ApiKeyManagement } from "@/casino/components/casino/sections/ApiKeyManagement";
import { DepositModal } from "@/casino/components/casino/DepositModal";
import { AuthModal } from "@/casino/components/casino/AuthModal";
import { SearchPalette } from "@/casino/components/casino/SearchPalette";
import { ChatWidget } from "@/casino/components/casino/ChatWidget";
import { ProvablyFairModal } from "@/casino/components/casino/ProvablyFairModal";
import { WinCelebration } from "@/casino/components/casino/WinCelebration";
import { AchievementToast } from "@/casino/components/casino/AchievementToast";
import { WinnersMarquee } from "@/casino/components/casino/WinnersMarquee";

/* ── Lucide icons for GamesGrid category headers ── */
import {
  Flame,
  Spade,
  Radio,
  Gamepad2,
  Trophy,
  Users,
  TrendingUp,
  Dices,
  Table2,
  Sparkles,
} from "lucide-react";

/* ========================================================================
   CasinoLobbyPage
   Embeds the full TOLS Casino SPA inside the admin shell.
   ======================================================================== */

export function CasinoLobbyPage() {
  const reduced = useReducedMotion();
  const { activeSection, selectedGame, setSelectedGame, setActiveSection, depositOpen, searchOpen, chatOpen, provablyFairOpen, lastBet, lastWin } =
    useUIStore();
  const { user, balance } = useSessionStore();
  const { setCurrentPage } = useAdminStore();

  /* ── Handlers ── */
  const handleSelectGame = useCallback(
    (slug: string) => {
      setSelectedGame(slug);
    },
    [setSelectedGame],
  );

  const handleNavigate = useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);
    },
    [setActiveSection],
  );

  const handleBackToAdmin = useCallback(() => {
    // Reset casino UI state before leaving
    setSelectedGame(null);
    setActiveSection("lobby");
    setCurrentPage("dashboard");
  }, [setSelectedGame, setActiveSection, setCurrentPage]);

  /* ── Determine which section content to render ── */
  const sectionContent = useMemo(() => {
    // Game Player view takes priority
    if (selectedGame) {
      return <GamePlayer slug={selectedGame} />;
    }

    switch (activeSection) {
      case "lobby":
        return <Lobby onSelectGame={handleSelectGame} onNavigate={handleNavigate} />;

      case "originals":
        return (
          <GamesGrid
            title="TOLS Originals"
            subtitle="Provably fair house games with the best RTP"
            category="originals"
            icon={Flame}
            onSelectGame={handleSelectGame}
          />
        );

      case "slots":
        return (
          <GamesGrid
            title="Slot Games"
            subtitle="Premium slots from top providers worldwide"
            category="slots"
            icon={Spade}
            onSelectGame={handleSelectGame}
          />
        );

      case "live":
        return (
          <GamesGrid
            title="Live Casino"
            subtitle="Real dealers, real tables, real-time action"
            category="live"
            icon={Radio}
            onSelectGame={handleSelectGame}
          />
        );

      case "table":
        return (
          <GamesGrid
            title="Table Games"
            subtitle="Classic card and table games"
            category="table"
            icon={Table2}
            onSelectGame={handleSelectGame}
          />
        );

      case "tournaments":
        return <Tournaments />;
      case "winners":
        return <Winners />;
      case "marketplace":
        return <Marketplace />;
      case "packs":
        return <Marketplace initialTab="packs" />;
      case "collection":
        return <MyCollection />;
      case "history":
        return <BetHistory />;
      case "wallet":
        return <WalletSection />;
      case "vip":
        return <VIPTiers />;
      case "leaderboard":
        return <Leaderboard />;
      case "promotions":
        return <Promotions />;
      case "challenges":
        return <DailyChallenges />;
      case "stats":
        return <GameStatsDashboard />;
      case "social":
        return <SocialFeed />;
      case "affiliate":
        return <Affiliate />;
      case "profile":
        return <UserProfile />;
      case "responsible":
        return <ResponsibleGaming />;
      case "apikeys":
        return <ApiKeyManagement />;
      case "instant":
        return (
          <GamesGrid
            title="Instant Win"
            subtitle="Scratch cards, instant results"
            category="instant"
            icon={Sparkles}
            onSelectGame={handleSelectGame}
          />
        );

      default:
        return <Lobby onSelectGame={handleSelectGame} onNavigate={handleNavigate} />;
    }
  }, [activeSection, selectedGame, handleSelectGame, handleNavigate]);

  /* ── Render ── */
  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* ── Back to Admin Bar ── */}
      <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 15%, transparent)", background: "color-mix(in oklab, var(--color-lime) 3%, transparent)" }}>
        <button
          onClick={handleBackToAdmin}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-80"
          style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Admin
        </button>
        <span className="text-xs" style={{ color: "color-mix(in oklab, var(--color-lime) 60%, transparent)" }}>
          TOLS Casino Frontend Preview
        </span>
        {user && (
          <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {user.username} &middot; Balance: ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* ── Casino Header ── */}
      <Header />

      {/* ── Winners Marquee (top) ── */}
      <WinnersMarquee />

      {/* ── Main Area: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar onSelectGame={handleSelectGame} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {/* Section title banner (for non-lobby, non-player views) */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selectedGame ?? activeSection}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
                }
              >
                {!selectedGame && activeSection !== "lobby" && (
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: "var(--color-lime)" }}>
                      {getSectionTitle(activeSection)}
                    </h1>
                    <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {getSectionSubtitle(activeSection)}
                    </p>
                  </div>
                )}
                {sectionContent}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Global Overlays & Modals ── */}
      {depositOpen && (
        <DepositOverlay onClose={() => useUIStore.getState().setDepositOpen(false)} />
      )}

      {searchOpen && <SearchPalette />}

      <AuthModal />

      {chatOpen && <ChatWidget />}

      <ProvablyFairModal
        open={provablyFairOpen}
        onOpenChange={(open) => useUIStore.getState().setProvablyFairOpen(open)}
        lastBet={lastBet}
      />

      {/* Win celebration */}
      <WinCelebration trigger={lastWin} />

      {/* Achievement toast */}
      <AchievementToast />
    </div>
  );
}

/* ========================================================================
   Helper: Section metadata
   ======================================================================== */

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  originals: { title: "TOLS Originals", subtitle: "Provably fair house games with the best RTP in crypto." },
  slots: { title: "Slot Games", subtitle: "Premium video slots from world-class providers." },
  live: { title: "Live Casino", subtitle: "Real-time action with professional dealers." },
  table: { title: "Table Games", subtitle: "Classic table games — Blackjack, Roulette, Baccarat & more." },
  instant: { title: "Instant Win", subtitle: "Scratch cards and instant-result games." },
  tournaments: { title: "Tournaments", subtitle: "Compete for real prize pools against other players." },
  winners: { title: "Biggest Wins", subtitle: "Recent biggest payouts and lucky players." },
  marketplace: { title: "Marketplace", subtitle: "Buy, sell and trade collectible cards." },
  packs: { title: "Card Packs", subtitle: "Open card packs to collect rare and legendary cards." },
  collection: { title: "My Collection", subtitle: "Your collectible card inventory." },
  history: { title: "Bet History", subtitle: "Complete record of all your bets and results." },
  wallet: { title: "My Wallet", subtitle: "Manage your deposits, withdrawals and transaction history." },
  vip: { title: "VIP Club", subtitle: "Exclusive rewards and rakeback for loyal players." },
  leaderboard: { title: "Leaderboard", subtitle: "Top players ranked by wagers and wins." },
  promotions: { title: "Promotions", subtitle: "Active bonuses, rakeback and special offers." },
  challenges: { title: "Daily Challenges", subtitle: "Complete daily challenges to earn bonus rewards." },
  stats: { title: "Game Statistics", subtitle: "Your personal gaming statistics and analytics." },
  social: { title: "Social Feed", subtitle: "Community updates, big wins and activity feed." },
  affiliate: { title: "Affiliate Program", subtitle: "Earn commission by referring new players." },
  profile: { title: "My Profile", subtitle: "Manage your account settings and preferences." },
  responsible: { title: "Responsible Gaming", subtitle: "Tools and limits to help you play responsibly." },
  apikeys: { title: "API Keys", subtitle: "Manage API keys for bot and programmatic access." },
};

function getSectionTitle(section: string): string {
  return SECTION_META[section]?.title ?? "Casino";
}

function getSectionSubtitle(section: string): string {
  return SECTION_META[section]?.subtitle ?? "";
}

/* ========================================================================
   Deposit overlay — renders DepositModal in a portal-style overlay
   ======================================================================== */

function DepositOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border p-6"
        style={{ background: "var(--color-bg)", borderColor: "color-mix(in oklab, var(--color-lime) 15%, transparent)" }}
      >
        <DepositModal />
      </div>
    </div>
  );
}
