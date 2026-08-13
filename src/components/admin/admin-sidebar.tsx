'use client';

import React from 'react';
import {
  LayoutDashboard, Users, Wallet, ArrowDownToLine, ArrowUpFromLine,
  Gamepad2, Trophy, Percent, Shield, Settings, Bell,
  ChevronLeft, ChevronRight, Menu, X, Activity, Zap, Eye,
  CreditCard, Layers, Star, Users2, Gift, Globe,
  AlertTriangle, Database, Tag
} from 'lucide-react';
import { useAdminStore, type AdminPage } from '@/stores/admin';
import { cn } from '@/lib/utils';

const NAV_SECTIONS = [
  { label: 'Overview', items: [
    { page: 'dashboard' as AdminPage, label: 'Dashboard', icon: LayoutDashboard },
    { page: 'live-monitor' as AdminPage, label: 'Live Monitor', icon: Activity },
  ]},
  { label: 'Players', items: [
    { page: 'users' as AdminPage, label: 'Users', icon: Users },
    { page: 'wallets' as AdminPage, label: 'Wallets', icon: Wallet },
    { page: 'responsible-gaming' as AdminPage, label: 'Responsible Gaming', icon: Shield },
  ]},
  { label: 'Finance', items: [
    { page: 'deposits' as AdminPage, label: 'Deposits', icon: ArrowDownToLine },
    { page: 'withdrawals' as AdminPage, label: 'Withdrawals',icon: ArrowUpFromLine },
    { page: 'deposit-addresses' as AdminPage, label: 'Deposit Addresses', icon: CreditCard },
  ]},
  { label: 'Games', items: [
    { page: 'bets' as AdminPage, label: 'Bets', icon: Gamepad2 },
    { page: 'casino-lobby' as AdminPage, label: 'Casino Lobby', icon: Layers },
    { page: 'slot-games' as AdminPage, label: 'Slot Games', icon: Star },
    { page: 'games-catalog' as AdminPage, label: 'Games Catalog', icon: Database },
    { page: 'demo-sessions' as AdminPage, label: 'Demo Sessions', icon: Eye },
    { page: 'jackpot' as AdminPage, label: 'Jackpot', icon: Trophy },
    { page: 'tournaments' as AdminPage, label: 'Tournaments', icon: Trophy },
  ]},
  { label: 'Ops', items: [
    { page: 'rtp-control' as AdminPage, label: 'RTP Control', icon: Percent },
    { page: 'telegram-alerts' as AdminPage, label: 'Telegram Alerts', icon: Bell },
    { page: 'notifications' as AdminPage, label: 'Notifications', icon: Bell },
    { page: 'audit-logs' as AdminPage, label: 'Audit Logs', icon: AlertTriangle },
  ]},
  { label: 'Marketing', items: [
    { page: 'affiliates' as AdminPage, label: 'Affiliates', icon: Users2 },
    { page: 'promotions' as AdminPage, label: 'Promotions', icon: Gift },
    { page: 'loyalty' as AdminPage, label: 'Loyalty', icon: Star },
    { page: 'bonus-engine' as AdminPage, label: 'Bonus Engine', icon: Zap },
  ]},
  { label: 'Config', items: [
    { page: 'settings' as AdminPage, label: 'Settings', icon: Settings },
    { page: 'site-config' as AdminPage, label: 'Site Config', icon: Globe },
    { page: 'white-label' as AdminPage, label: 'White Label', icon: Tag },
  ]},
];

export function MobileMenuButton() {
  const isOpen = useAdminStore((s) => s.isSidebarOpen);
  const setOpen = useAdminStore((s) => s.setSidebarOpen);
  return (
    <button onClick={() => setOpen(!isOpen)}
      className="admin-mobile-only flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent/50 hover:text-foreground transition-colors"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      style={{ width: 44, height: 44 }}>
      {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}

export function AdminSidebar() {
  const currentPage = useAdminStore((s) => s.currentPage);
  const setPage = useAdminStore((s) => s.setPage);
  const isCollapsed = useAdminStore((s) => s.isSidebarCollapsed);
  const toggleCollapse = useAdminStore((s) => s.toggleSidebarCollapse);
  const isOpen = useAdminStore((s) => s.isSidebarOpen);
  const setOpen = useAdminStore((s) => s.setSidebarOpen);
  return (
    <>
      {isOpen && <div className="admin-mobile-only fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}
      <aside className={cn(
        'admin-sidebar fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border/50 bg-background/95 backdrop-blur-md transition-all duration-300',
        isCollapsed ? 'admin-sidebar-collapsed' : 'admin-sidebar-expanded',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <div className={cn('flex items-center border-b border-border/50 px-4', isCollapsed ? 'h-14 justify-center' : 'h-14 gap-3')}>
          {!isCollapsed && <span className="font-display text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--color-lime)' }}>TOLS</span>}
          {!isCollapsed && <span className="text-xs text-muted-foreground">Admin</span>}
          {isCollapsed && <span className="font-display text-base font-bold uppercase" style={{ color: 'var(--color-lime)' }}>T</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!isCollapsed && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{section.label}</p>}
              <div className="space-y-0.5">
                {section.items.map(({ page, label, icon: Icon }) => {
                  const active = currentPage === page;
                  return (
                    <button key={page} onClick={() => { setPage(page); setOpen(false); }}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                        active ? 'bg-lime-400/10 text-lime-400' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        isCollapsed && 'justify-center px-2')}
                      style={active ? { boxShadow: 'inset 0 0 0 1px rgba(204,255,0,0.2)' } : { }}
                      title={isCollapsed ? label : undefined}>
                      <Icon className={cn('shrink-0 h-4 w-4', active ? 'text-lime-400' : 'text-current')} />
                      {!isCollapsed && <span className="truncate">{label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="admin-desktop-only border-t border-border/50 p-2">
          <button onClick={toggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            style={{ height: 36 }}>
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
