'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAdminStore } from '@/stores/admin';
import { Button } from '@/components/ui/button';

const DashboardPage = dynamic(() => import('@/components/admin/modules/dashboard-page').then(m => ({ default: m.DashboardPage })), { ssr: false });
const UsersPage = dynamic(() => import('@/components/admin/modules/users-page').then(m => ({ default: m.UsersPage })), { ssr: false });
const WalletsPage = dynamic(() => import('@/components/admin/modules/wallets-page').then(m => ({ default: m.WalletsPage })), { ssr: false });
const DepositsPage = dynamic(() => import('@/components/admin/modules/deposits-page').then(m => ({ default: m.DepositsPage })), { ssr: false });
const WithdrawalsPage = dynamic(() => import('@/components/admin/modules/withdrawals-page').then(m => ({ default: m.WithdrawalsPage })), { ssr: false });
const BetsPage = dynamic(() => import('@/components/admin/modules/bets-page').then(m => ({ default: m.BetsPage })), { ssr: false });
const SlotGamesPage = dynamic(() => import('@/components/admin/modules/slot-games-page').then(m => ({ default: m.SlotGamesPage })), { ssr: false });
const GamesCatalogPage = dynamic(() => import('@/components/admin/modules/games-catalog-page').then(m => ({ default: m.GamesCatalogPage })), { ssr: false });
const CasinoLobbyPage = dynamic(() => import('@/components/admin/modules/casino-lobby-page').then(m => ({ default: m.CasinoLobbyPage })), { ssr: false });
const JackpotPage = dynamic(() => import('@/components/admin/modules/jackpot-page').then(m => ({ default: m.JackpotPage })), { ssr: false });
const TournamentsPage = dynamic(() => import('@/components/admin/modules/tournaments-page').then(m => ({ default: m.TournamentsPage })), { ssr: false });
const AffiliatesPage = dynamic(() => import('@/components/admin/modules/affiliates-page').then(m => ({ default: m.AffiliatesPage })), { ssr: false });
const SettingsPage = dynamic(() => import('@/components/admin/modules/settings-page').then(m => ({ default: m.SettingsPage })), { ssr: false });
const RtpControlPage = dynamic(() => import('@/components/admin/modules/ops/rtp-control-page').then(m => ({ default: m.RtpControlPage })), { ssr: false });
const TelegramAlertsPage = dynamic(() => import('@/components/admin/modules/ops/telegram-alerts-page').then(m => ({ default: m.TelegramAlertsPage })), { ssr: false });
const DepositAddressesPage = dynamic(() => import('@/components/admin/modules/deposit-addresses-page').then(m => ({ default: m.DepositAddressesPage })), { ssr: false });
const DemoSessionsPage = dynamic(() => import('@/components/admin/modules/demo-sessions-page').then(m => ({ default: m.DemoSessionsPage })), { ssr: false });
const ResponsibleGamingPage = dynamic(() => import('@/components/admin/modules/responsible-gaming-page').then(m => ({ default: m.ResponsibleGamingPage })), { ssr: false });
const LiveMonitorPage = dynamic(() => import('@/components/admin/modules/ops/live-monitor-page').then(m => ({ default: m.LiveMonitorPage })), { ssr: false });

export default function AdminPage() {
  const currentPage = useAdminStore((s) => s.currentPage);
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/ops/auth').then(r => r.json()).then(j => {
      if (j?.authed) setAuthed(true);
    }).catch(() => {});
  }, []);

  const login = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/ops/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const j = await r.json();
      if (j?.success) setAuthed(true);
      else setError(j?.error || 'Invalid password');
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }, [pw]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <h1 className="text-center text-xl font-bold" style={{ color: 'var(--color-lime)' }}>Admin Access</h1>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter admin password" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime-400/50 focus:outline-none" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-lime-400 text-black hover:bg-lime-300">{loading ? 'Authenticating…' : 'Enter'}</Button>
        </form>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'live-monitor': return <LiveMonitorPage />;
      case 'users': return <UsersPage />;
      case 'wallets': return <WalletsPage />;
      case 'deposits': return <DepositsPage />;
      case 'withdrawals': return <WithdrawalsPage />;
      case 'bets': return <BetsPage />;
      case 'slot-games': return <SlotGamesPage />;
      case 'games-catalog': return <GamesCatalogPage />;
      case 'casino-lobby': return <CasinoLobbyPage />;
      case 'jackpot': return <JackpotPage />;
      case 'tournaments': return <TournamentsPage />;
      case 'affiliates': return <AffiliatesPage />;
      case 'settings': return <SettingsPage />;
      case 'rtp-control': return <RtpControlPage />;
      case 'telegram-alerts': return <TelegramAlertsPage />;
      case 'deposit-addresses': return <DepositAddressesPage />;
      case 'demo-sessions': return <DemoSessionsPage />;
      case 'responsible-gaming': return <ResponsibleGamingPage />;
      case 'dashboard':
      default: return <DashboardPage />;
    }
  };

  return <div className="admin-content admin-page-enter">{renderPage()}</div>;'