'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAdminStore, PAGE_LABELS } from '@/stores/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, ShieldCheck, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Loading Spinner                                                    */
/* ------------------------------------------------------------------ */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dynamic imports for ALL 32 admin modules (avoid OOM)               */
/* ------------------------------------------------------------------ */
const DashboardPage = dynamic(
  () => import('@/components/admin/modules/dashboard-page').then((m) => ({ default: m.DashboardPage })),
  { loading: () => <PageLoader /> },
);
const UsersPage = dynamic(
  () => import('@/components/admin/modules/users-page').then((m) => ({ default: m.UsersPage })),
  { loading: () => <PageLoader /> },
);
const DepositsPage = dynamic(
  () => import('@/components/admin/modules/deposits-page').then((m) => ({ default: m.DepositsPage })),
  { loading: () => <PageLoader /> },
);
const WithdrawalsPage = dynamic(
  () => import('@/components/admin/modules/withdrawals-page').then((m) => ({ default: m.WithdrawalsPage })),
  { loading: () => <PageLoader /> },
);
const WalletsPage = dynamic(
  () => import('@/components/admin/modules/wallets-page').then((m) => ({ default: m.WalletsPage })),
  { loading: () => <PageLoader /> },
);
const GamesCatalogPage = dynamic(
  () => import('@/components/admin/modules/games-catalog-page').then((m) => ({ default: m.GamesCatalogPage })),
  { loading: () => <PageLoader /> },
);
const SlotGamesPage = dynamic(
  () => import('@/components/admin/modules/slot-games-page').then((m) => ({ default: m.SlotGamesPage })),
  { loading: () => <PageLoader /> },
);
const CasinoLobbyPage = dynamic(
  () => import('@/components/admin/modules/casino-lobby-page').then((m) => ({ default: m.CasinoLobbyPage })),
  { loading: () => <PageLoader /> },
);
const VirtualGamesPage = dynamic(
  () => import('@/components/admin/modules/virtual-games-page').then((m) => ({ default: m.VirtualGamesPage })),
  { loading: () => <PageLoader /> },
);
const DepositAddressesPage = dynamic(
  () => import('@/components/admin/modules/deposit-addresses-page').then((m) => ({ default: m.DepositAddressesPage })),
  { loading: () => <PageLoader /> },
);
const BetsPage = dynamic(
  () => import('@/components/admin/modules/bets-page').then((m) => ({ default: m.BetsPage })),
  { loading: () => <PageLoader /> },
);
const DemoSessionsPage = dynamic(
  () => import('@/components/admin/modules/demo-sessions-page').then((m) => ({ default: m.DemoSessionsPage })),
  { loading: () => <PageLoader /> },
);
const JackpotPage = dynamic(
  () => import('@/components/admin/modules/jackpot-page').then((m) => ({ default: m.JackpotPage })),
  { loading: () => <PageLoader /> },
);
const TournamentsPage = dynamic(
  () => import('@/components/admin/modules/tournaments-page').then((m) => ({ default: m.TournamentsPage })),
  { loading: () => <PageLoader /> },
);
const TournamentEntriesPage = dynamic(
  () => import('@/components/admin/modules/tournament-entries-page').then((m) => ({ default: m.TournamentEntriesPage })),
  { loading: () => <PageLoader /> },
);
const MarketplacePage = dynamic(
  () => import('@/components/admin/modules/marketplace-page').then((m) => ({ default: m.MarketplacePage })),
  { loading: () => <PageLoader /> },
);
const CollectiblesPage = dynamic(
  () => import('@/components/admin/modules/collectibles-page').then((m) => ({ default: m.CollectiblesPage })),
  { loading: () => <PageLoader /> },
);
const CardPacksPage = dynamic(
  () => import('@/components/admin/modules/card-packs-page').then((m) => ({ default: m.CardPacksPage })),
  { loading: () => <PageLoader /> },
);
const CardPullsPage = dynamic(
  () => import('@/components/admin/modules/card-pulls-page').then((m) => ({ default: m.CardPullsPage })),
  { loading: () => <PageLoader /> },
);
const HouseEarningsPage = dynamic(
  () => import('@/components/admin/modules/house-earnings-page').then((m) => ({ default: m.HouseEarningsPage })),
  { loading: () => <PageLoader /> },
);
const AffiliatesPage = dynamic(
  () => import('@/components/admin/modules/affiliates-page').then((m) => ({ default: m.AffiliatesPage })),
  { loading: () => <PageLoader /> },
);
const ReferralsPage = dynamic(
  () => import('@/components/admin/modules/referrals-page').then((m) => ({ default: m.ReferralsPage })),
  { loading: () => <PageLoader /> },
);
const CommissionsPage = dynamic(
  () => import('@/components/admin/modules/commissions-page').then((m) => ({ default: m.CommissionsPage })),
  { loading: () => <PageLoader /> },
);
const SettingsPage = dynamic(
  () => import('@/components/admin/modules/settings-page').then((m) => ({ default: m.SettingsPage })),
  { loading: () => <PageLoader /> },
);
const ResponsibleGamingPage = dynamic(
  () => import('@/components/admin/modules/responsible-gaming-page').then((m) => ({ default: m.ResponsibleGamingPage })),
  { loading: () => <PageLoader /> },
);
const ChatPage = dynamic(
  () => import('@/components/admin/modules/chat-page').then((m) => ({ default: m.ChatPage })),
  { loading: () => <PageLoader /> },
);
const CrmTeamPage = dynamic(
  () => import('@/components/admin/modules/crm/crm-team-page').then((m) => ({ default: m.CrmTeamPage })),
  { loading: () => <PageLoader /> },
);
const CrmTasksPage = dynamic(
  () => import('@/components/admin/modules/crm/crm-tasks-page').then((m) => ({ default: m.CrmTasksPage })),
  { loading: () => <PageLoader /> },
);
const CrmChatPage = dynamic(
  () => import('@/components/admin/modules/crm/crm-chat-page').then((m) => ({ default: m.CrmChatPage })),
  { loading: () => <PageLoader /> },
);
const CrmEmailsPage = dynamic(
  () => import('@/components/admin/modules/crm/crm-emails-page').then((m) => ({ default: m.CrmEmailsPage })),
  { loading: () => <PageLoader /> },
);
const PlayerAnalyticsPage = dynamic(
  () => import('@/components/admin/modules/ops/player-analytics-page').then((m) => ({ default: m.PlayerAnalyticsPage })),
  { loading: () => <PageLoader /> },
);
const OpControlsPage = dynamic(
  () => import('@/components/admin/modules/ops/op-controls-page').then((m) => ({ default: m.OpControlsPage })),
  { loading: () => <PageLoader /> },
);
const GameControlsPage = dynamic(
  () => import('@/components/admin/modules/ops/game-controls-page').then((m) => ({ default: m.GameControlsPage })),
  { loading: () => <PageLoader /> },
);
const DepositTrackerPage = dynamic(
  () => import('@/components/admin/modules/ops/deposit-tracker-page').then((m) => ({ default: m.DepositTrackerPage })),
  { loading: () => <PageLoader /> },
);
const TelegramAlertsPage = dynamic(
  () => import('@/components/admin/modules/ops/telegram-alerts-page').then((m) => ({ default: m.TelegramAlertsPage })),
  { loading: () => <PageLoader /> },
);
const RtpControlPage = dynamic(
  () => import('@/components/admin/modules/ops/rtp-control-page').then((m) => ({ default: m.RtpControlPage })),
  { loading: () => <PageLoader /> },
);
const LiveMonitorPage = dynamic(
  () => import('@/components/admin/modules/ops/live-monitor-page').then((m) => ({ default: m.LiveMonitorPage })),
  { loading: () => <PageLoader /> },
);
const BridgePage = dynamic(
  () => import('@/components/admin/modules/bridge-page').then((m) => ({ default: m.BridgePage })),
  { loading: () => <PageLoader /> },
);

/* ------------------------------------------------------------------ */
/*  Page Router                                                        */
/* ------------------------------------------------------------------ */
function PageRouter() {
  const { currentPage } = useAdminStore();

  switch (currentPage) {
    case 'dashboard':
      return <DashboardPage />;
    case 'users':
      return <UsersPage />;
    case 'deposits':
      return <DepositsPage />;
    case 'withdrawals':
      return <WithdrawalsPage />;
    case 'wallets':
      return <WalletsPage />;
    case 'games-catalog':
      return <GamesCatalogPage />;
    case 'slot-games':
      return <SlotGamesPage />;
    case 'casino-lobby':
      return <CasinoLobbyPage />;
    case 'virtual-games':
      return <VirtualGamesPage />;
    case 'deposit-addresses':
      return <DepositAddressesPage />;
    case 'bets':
      return <BetsPage />;
    case 'demo-sessions':
      return <DemoSessionsPage />;
    case 'jackpot':
      return <JackpotPage />;
    case 'tournaments':
      return <TournamentsPage />;
    case 'tournament-entries':
      return <TournamentEntriesPage />;
    case 'marketplace':
      return <MarketplacePage />;
    case 'collectibles':
      return <CollectiblesPage />;
    case 'card-packs':
      return <CardPacksPage />;
    case 'card-pulls':
      return <CardPullsPage />;
    case 'house-earnings':
      return <HouseEarningsPage />;
    case 'affiliates':
      return <AffiliatesPage />;
    case 'referrals':
      return <ReferralsPage />;
    case 'commissions':
      return <CommissionsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'responsible-gaming':
      return <ResponsibleGamingPage />;
    case 'chat':
      return <ChatPage />;
    case 'crm-team':
      return <CrmTeamPage />;
    case 'crm-tasks':
      return <CrmTasksPage />;
    case 'crm-chat':
      return <CrmChatPage />;
    case 'crm-emails':
      return <CrmEmailsPage />;
    case 'player-analytics':
      return <PlayerAnalyticsPage />;
    case 'op-controls':
      return <OpControlsPage />;
    case 'game-controls':
      return <GameControlsPage />;
    case 'deposit-tracker':
      return <DepositTrackerPage />;
    case 'telegram-alerts':
      return <TelegramAlertsPage />;
    case 'rtp-control':
      return <RtpControlPage />;
    case 'live-monitor':
      return <LiveMonitorPage />;
    case 'bridge':
      return <BridgePage />;
    default:
      return <DashboardPage />;
  }
}

/* ------------------------------------------------------------------ */
/*  Password Gate                                                       */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Password Gate (responsive — optimized for mobile & desktop)       */
/* ------------------------------------------------------------------ */
function PasswordGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (checking) return;
      setChecking(true);
      setError('');
      try {
        const res = await fetch('/api/ops/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, ...(needsTotp ? { totp } : {}) }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          localStorage.setItem('tols_admin_auth', 'true');
          window.location.reload();
          return;
        }
        if (json?.twoFactorRequired) {
          setNeedsTotp(true);
          setChecking(false);
          setError('Enter the 6-digit code from your authenticator.');
          return;
        }
        setError(res.status === 429 ? 'Too many attempts. Wait a minute.' : 'Invalid credentials.');
      } catch {
        setError('Could not reach the server.');
      }
      setShake(true);
      setChecking(false);
      setTimeout(() => setShake(false), 500);
    },
    [email, password, totp, needsTotp, checking],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 safe-area-top"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, color-mix(in oklab, var(--color-lime) 6%, transparent), var(--color-bg) 70%)',
      }}
    >
      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-20 top-1/4 h-72 w-72 rounded-full blur-[100px]"
          style={{ background: 'color-mix(in oklab, var(--color-lime) 12%, transparent)' }}
        />
        <div
          className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full blur-[100px]"
          style={{ background: 'color-mix(in oklab, var(--color-vip) 14%, transparent)' }}
        />
      </div>

      <div
        className={`relative w-full max-w-sm rounded-2xl border p-6 sm:p-8 backdrop-blur-xl ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={{
          background: 'color-mix(in oklab, var(--color-surface) 80%, transparent)',
          borderColor: 'color-mix(in oklab, var(--color-lime) 20%, transparent)',
          boxShadow:
            '0 24px 60px -12px rgba(0,0,0,0.6), 0 0 40px color-mix(in oklab, var(--color-lime) 8%, transparent)',
        }}
      >
        <div className="mb-6 sm:mb-7 text-center">
          <div
            className="mx-auto mb-4 inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-lime), #e5ff5c)',
              boxShadow: '0 8px 24px color-mix(in oklab, var(--color-lime) 30%, transparent)',
            }}
          >
            <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: 'var(--color-bg)' }} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Control Panel</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Restricted access — sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="relative">
            <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="Operator email"
              autoFocus
              autoComplete="username"
              className="h-11 sm:h-12 pl-10 text-base"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Admin password"
              autoComplete="current-password"
              className="h-11 sm:h-12 pl-10 pr-10 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {needsTotp && (
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                inputMode="numeric"
                value={totp}
                onChange={(e) => { setTotp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="6-digit code"
                autoFocus
                autoComplete="one-time-code"
                className="h-11 sm:h-12 pl-10 tracking-[0.4em] text-center text-base"
              />
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm"
              style={{
                background: 'color-mix(in oklab, var(--color-loss) 12%, transparent)',
                color: 'var(--color-loss)',
              }}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={checking || !email || !password || (needsTotp && totp.length !== 6)}
            className="btn-press h-11 sm:h-12 w-full text-base font-bold"
            style={{ background: 'var(--color-lime)', color: 'var(--color-bg)' }}
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter Control Panel'}
          </Button>
        </form>

        <p className="mt-5 sm:mt-6 text-center text-[11px] text-muted-foreground/70 safe-area-bottom">
          Internal team access only · TOLS Casino
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Header with logout (responsive)                               */
/* ------------------------------------------------------------------ */
function PageHeader() {
  const { currentPage } = useAdminStore();
  const label = PAGE_LABELS[currentPage] || 'Dashboard';

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('tols_admin_auth');
    } catch {
      /* noop */
    }
    fetch('/api/ops/auth', { method: 'DELETE' }).finally(() => {
      window.location.reload();
    });
  }, []);

  return (
    <div className="mb-4 sm:mb-6 flex items-center justify-between border-b border-border/40 pb-3 sm:pb-4 gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="admin-page-title font-bold tracking-tight truncate">{label}</h1>
        <div className="mt-1 h-0.5 w-10 rounded-full" style={{ background: 'var(--color-lime)' }} />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="gap-1.5 text-muted-foreground hover:text-destructive shrink-0 h-8 sm:h-9"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Default Export                                                     */
/* ------------------------------------------------------------------ */
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('tols_admin_auth') === 'true') {
        setAuthenticated(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  if (!authenticated) {
    return <PasswordGate />;
  }

  return (
    <>
      <PageHeader />
      <PageRouter />
    </>
  );
}
