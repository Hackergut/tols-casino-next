'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAdminStore, PAGE_LABELS, type AdminPage } from '@/stores/admin';
import { Loader2 } from 'lucide-react';

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ComingSoon({ page }: { page: AdminPage }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-lg font-semibold text-foreground">{PAGE_LABELS[page]}</h2>
      <p className="mt-2 text-sm text-muted-foreground">This module is coming soon.</p>
    </div>
  );
}

// Only include dynamic imports for modules that exist in the codebase
const PAGE_COMPONENTS: Partial<Record<AdminPage, React.ComponentType>> = {
  'dashboard': dynamic(() => import('@/components/admin/modules/dashboard-page'), { loading: PageLoader }),
  'users': dynamic(() => import('@/components/admin/modules/users-page'), { loading: PageLoader }),
  'wallets': dynamic(() => import('@/components/admin/modules/wallets-page'), { loading: PageLoader }),
  'deposits': dynamic(() => import('@/components/admin/modules/deposits-page'), { loading: PageLoader }),
  'withdrawals': dynamic(() => import('@/components/admin/modules/withdrawals-page'), { loading: PageLoader }),
  'slot-games': dynamic(() => import('@/components/admin/modules/slot-games-page'), { loading: PageLoader }),
  'games-catalog': dynamic(() => import('@/components/admin/modules/games-catalog-page'), { loading: PageLoader }),
  'casino-lobby': dynamic(() => import('@/components/admin/modules/casino-lobby-page'), { loading: PageLoader }),
  'bets': dynamic(() => import('@/components/admin/modules/bets-page'), { loading: PageLoader }),
  'demo-sessions': dynamic(() => import('@/components/admin/modules/demo-sessions-page'), { loading: PageLoader }),
  'jackpot': dynamic(() => import('@/components/admin/modules/jackpot-page'), { loading: PageLoader }),
  'tournaments': dynamic(() => import('@/components/admin/modules/tournaments-page'), { loading: PageLoader }),
  'tournament-entries': dynamic(() => import('@/components/admin/modules/tournament-entries-page'), { loading: PageLoader }),
  'affiliates': dynamic(() => import('@/components/admin/modules/affiliates-page'), { loading: PageLoader }),
  'settings': dynamic(() => import('@/components/admin/modules/settings-page'), { loading: PageLoader }),
  'responsible-gaming': dynamic(() => import('@/components/admin/modules/responsible-gaming-page'), { loading: PageLoader }),
  'deposit-addresses': dynamic(() => import('@/components/admin/modules/deposit-addresses-page'), { loading: PageLoader }),
  'live-monitor': dynamic(() => import('@/components/admin/modules/ops/live-monitor-page'), { loading: PageLoader }),
  'telegram-alerts': dynamic(() => import('@/components/admin/modules/ops/telegram-alerts-page'), { loading: PageLoader }),
  'rtp-control': dynamic(() => import('@/components/admin/modules/ops/rtp-control-page'), { loading: PageLoader }),
};

export default function AdminPage() {
  const currentPage = useAdminStore((s) => s.currentPage);
  const Component = PAGE_COMPONENTS[currentPage];

  if (!Component) {
    return <ComingSoon page={currentPage} />;
  }

  return <Component />;
}
