'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAdminStore, PAGE_LABELS, type AdminPage } from '@/stores/admin';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gamepad2,
  Library,
  Dices,
  BarChart3,
  Trophy,
  Medal,
  UserPlus,
  Gift,
  Settings,
  LineChart,
  HeadphonesIcon,
  FileText,
  Globe,
  Sparkles,
  Bell,
  Heart,
  Shield,
  Send,
  Bitcoin,
  Percent,
  Tag,
  MapPin,
  Monitor,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react';

const PAGE_ICONS: Record<AdminPage, React.ElementType> = {
  'dashboard': LayoutDashboard,
  'users': Users,
  'wallets': Wallet,
  'deposits': ArrowDownToLine,
  'withdrawals': ArrowUpFromLine,
  'slot-games': Gamepad2,
  'games-catalog': Library,
  'casino-lobby': Dices,
  'bets': BarChart3,
  'demo-sessions': Monitor,
  'jackpot': Trophy,
  'tournaments': Medal,
  'tournament-entries': Medal,
  'affiliates': UserPlus,
  'promotions': Gift,
  'settings': Settings,
  'analytics': LineChart,
  'support': HeadphonesIcon,
  'audit-logs': FileText,
  'site-config': Globe,
  'bonus-engine': Sparkles,
  'notifications': Bell,
  'loyalty': Heart,
  'responsible-gaming': Shield,
  'telegram-alerts': Send,
  'crypto-payments': Bitcoin,
  'rtp-control': Percent,
  'white-label': Tag,
  'deposit-addresses': MapPin,
  'live-monitor': Monitor,
};

interface SidebarSection {
  label: string;
  items: AdminPage[];
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { label: 'Overview', items: ['dashboard', 'live-monitor'] },
  { label: 'Users & Finance', items: ['users', 'wallets', 'deposits', 'withdrawals', 'deposit-addresses'] },
  { label: 'Games', items: ['slot-games', 'games-catalog', 'casino-lobby', 'bets', 'demo-sessions', 'jackpot', 'rtp-control'] },
  { label: 'Engagement', items: ['tournaments', 'tournament-entries', 'affiliates', 'promotions', 'bonus-engine', 'loyalty'] },
  { label: 'Operations', items: ['notifications', 'telegram-alerts', 'crypto-payments', 'responsible-gaming'] },
  { label: 'System', items: ['settings', 'analytics', 'support', 'audit-logs', 'site-config', 'white-label'] },
];

export function AdminSidebar() {
  const currentPage = useAdminStore((s) => s.currentPage);
  const isSidebarCollapsed = useAdminStore((s) => s.isSidebarCollapsed);
  const toggleSidebarCollapse = useAdminStore((s) => s.toggleSidebarCollapse);
  const setPage = useAdminStore((s) => s.setPage);
  const isSidebarOpen = useAdminStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useAdminStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="admin-mobile-only fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'admin-sidebar fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-border/50 bg-background transition-all duration-300',
          isSidebarCollapsed ? 'w-[60px]' : 'w-[240px]',
          'max-md:-translate-x-full max-md:w-[260px]',
          isSidebarOpen && 'max-md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-3">
          {!isSidebarCollapsed && (
            <span className="text-sm font-bold tracking-tight text-foreground">TOLS Admin</span>
          )}
          <button
            onClick={toggleSidebarCollapse}
            className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', isSidebarCollapsed && 'rotate-180')} />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label}>
              {!isSidebarCollapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((page) => {
                  const Icon = PAGE_ICONS[page];
                  const isActive = currentPage === page;
                  return (
                    <li key={page}>
                      <button
                        onClick={() => {
                          setPage(page);
                          setSidebarOpen(false);
                        }}
                        title={PAGE_LABELS[page]}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          isSidebarCollapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!isSidebarCollapsed && <span className="truncate">{PAGE_LABELS[page]}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function MobileMenuButton() {
  const setSidebarOpen = useAdminStore((s) => s.setSidebarOpen);

  return (
    <button
      onClick={() => setSidebarOpen(true)}
      className="admin-mobile-only inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export default AdminSidebar;
