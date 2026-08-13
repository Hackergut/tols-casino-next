'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gamepad2,
  Dice1,
  Play,
  Trophy,
  UserCheck,
  Store,
  Gem,
  Package,
  HandCoins,
  Handshake,
  UserPlus,
  Receipt,
  Settings,
  Shield,
  MessageSquare,
  Sun,
  Moon,
  ChevronLeft,
  ChevronDown,
  Coins,
  Menu,
  CheckSquare,
  MessageCircle,
  Mail,
  BarChart3,
  Sliders,
  TrendingUp,
  Bell,
  Layers,
  Percent,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminStore, type AdminPage } from '@/stores/admin';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const NAV_DESCRIPTIONS: Record<AdminPage, string> = {
  dashboard: 'Platform overview and key metrics',
  users: 'Manage user accounts and profiles',
  wallets: 'View and manage user wallets',
  deposits: 'View deposit transactions',
  withdrawals: 'Process withdrawal requests',
  'house-earnings': 'Platform revenue analytics',
  'slot-games': 'Manage slot game library',
  'games-catalog': 'Full game catalog with 375+ slots & original games',
  'casino-lobby': 'Full casino frontend — lobby, games, betting, wallet',
  bets: 'View betting history and details',
  'demo-sessions': 'Track demo play sessions',
  jackpot: 'Global jackpot configuration',
  tournaments: 'Manage tournament events',
  'tournament-entries': 'View tournament participation',
  marketplace: 'Marketplace listings and orders',
  collectibles: 'Manage NFT collectibles',
  'card-packs': 'Configure card pack offerings',
  'card-pulls': 'Track card pull history',
  affiliates: 'Manage affiliate partnerships',
  referrals: 'Track referral program activity',
  commissions: 'Commission payouts and history',
  settings: 'Platform configuration',
  'responsible-gaming': 'Responsible gaming policies',
  chat: 'View chat messages and moderation',
  'crm-team': 'Internal team management and roles',
  'crm-tasks': 'Task board with assignments and mentions',
  'crm-chat': 'Internal team chat and messaging',
  'crm-emails': 'Email inbox, compose and templates',
  'player-analytics': 'Player streaks, win/loss analytics',
  'op-controls': 'Control player outcomes and RTP',
  'game-controls': 'Force wins/losses, streaks, RTP per user & game',
  'deposit-tracker': 'Deposit tracking by registration',
  'telegram-alerts': 'Telegram notification alerts',
  'rtp-control': 'RTP control panel',
  'virtual-games': 'EuroVirtuals integration: config, transactions, test launch',
};

interface NavGroup {
  label: string;
  items: { page: AdminPage; label: string; icon: React.ReactNode; badge?: boolean }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    label: 'User Management',
    items: [
      { page: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
      { page: 'wallets', label: 'Wallets', icon: <Wallet className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Financial',
    items: [
      { page: 'deposits', label: 'Deposits', icon: <ArrowDownToLine className="h-4 w-4" /> },
      { page: 'withdrawals', label: 'Withdrawals', icon: <ArrowUpFromLine className="h-4 w-4" />, badge: true },
      { page: 'house-earnings', label: 'House Earnings', icon: <HandCoins className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Gaming',
    items: [
      { page: 'casino-lobby', label: 'Casino', icon: <Gamepad2 className="h-4 w-4" />, badge: true },
      { page: 'games-catalog', label: 'Games Catalog', icon: <Layers className="h-4 w-4" /> },
      { page: 'slot-games', label: 'Slot Games', icon: <Dice1 className="h-4 w-4" /> },
      { page: 'virtual-games', label: 'Virtual Games', icon: <Gamepad2 className="h-4 w-4" />, badge: true },
      { page: 'bets', label: 'Bets', icon: <Dice1 className="h-4 w-4" />, badge: true },
      { page: 'demo-sessions', label: 'Demo Sessions', icon: <Play className="h-4 w-4" /> },
      { page: 'jackpot', label: 'Global Jackpot', icon: <Trophy className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Tournaments',
    items: [
      { page: 'tournaments', label: 'Tournaments', icon: <Trophy className="h-4 w-4" /> },
      { page: 'tournament-entries', label: 'Entries', icon: <UserCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Marketplace & NFTs',
    items: [
      { page: 'marketplace', label: 'Marketplace', icon: <Store className="h-4 w-4" /> },
      { page: 'collectibles', label: 'Collectibles', icon: <Gem className="h-4 w-4" /> },
      { page: 'card-packs', label: 'Card Packs', icon: <Package className="h-4 w-4" /> },
      { page: 'card-pulls', label: 'Card Pulls', icon: <Handshake className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Affiliate & Referral',
    items: [
      { page: 'affiliates', label: 'Affiliates', icon: <Handshake className="h-4 w-4" /> },
      { page: 'referrals', label: 'Referrals', icon: <UserPlus className="h-4 w-4" /> },
      { page: 'commissions', label: 'Commissions', icon: <Receipt className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Platform',
    items: [
      { page: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
      { page: 'responsible-gaming', label: 'Responsible Gaming', icon: <Shield className="h-4 w-4" /> },
      { page: 'chat', label: 'Chat Messages', icon: <MessageSquare className="h-4 w-4" /> },
    ],
  },
  {
    label: 'CRM & Team',
    items: [
      { page: 'crm-team', label: 'Team CRM', icon: <Users className="h-4 w-4" /> },
      { page: 'crm-tasks', label: 'Tasks', icon: <CheckSquare className="h-4 w-4" />, badge: true },
      { page: 'crm-chat', label: 'Team Chat', icon: <MessageCircle className="h-4 w-4" /> },
      { page: 'crm-emails', label: 'Emails', icon: <Mail className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { page: 'player-analytics', label: 'Player Analytics', icon: <BarChart3 className="h-4 w-4" />, badge: true },
      { page: 'op-controls', label: 'Ops Control', icon: <Sliders className="h-4 w-4" /> },
      { page: 'game-controls', label: 'RTP & Outcomes', icon: <Sliders className="h-4 w-4" />, badge: true },
      { page: 'rtp-control', label: 'RTP Control', icon: <Percent className="h-4 w-4" /> },
      { page: 'deposit-tracker', label: 'Deposit Tracker', icon: <TrendingUp className="h-4 w-4" /> },
      { page: 'telegram-alerts', label: 'Telegram Alerts', icon: <Bell className="h-4 w-4" />, badge: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Noise SVG data-URL                                                 */
/* ------------------------------------------------------------------ */
const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

/* ------------------------------------------------------------------ */
/*  Filter nav groups by search query                                  */
/* ------------------------------------------------------------------ */
function useFilteredNavGroups(query: string): NavGroup[] {
  return useMemo(() => {
    if (!query.trim()) return navGroups;
    const q = query.toLowerCase().trim();
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.page.toLowerCase().includes(q) ||
            group.label.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);
}

/* ------------------------------------------------------------------ */
/*  Nav Search Input                                                   */
/* ------------------------------------------------------------------ */
function NavSearchInput({
  value,
  onChange,
  collapsed,
}: {
  value: string;
  onChange: (v: string) => void;
  collapsed?: boolean;
}) {
  if (collapsed) {
    // When sidebar is collapsed, show a search icon that expands on click
    return (
      <div className="px-2 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                // Trigger sidebar expand via store — handled by parent
                onChange('');
              }}
              className="w-full flex justify-center px-2 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Search navigation"
            >
              <Search className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Search</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="admin-nav-search px-2 py-2">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search pages..."
        className="admin-nav-button"
        aria-label="Search navigation"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Header                                                       */
/* ------------------------------------------------------------------ */
function NavGroupHeader({
  label,
  isExpanded,
  onToggle,
}: {
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="admin-nav-button group/ghdr relative flex w-full items-center gap-2 px-3 pb-1.5 pt-3 cursor-pointer"
      aria-expanded={isExpanded}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 flex-1 text-left">
        {label}
      </span>
      <motion.div
        animate={{ rotate: isExpanded ? 0 : -90 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-muted-foreground/50"
      >
        <ChevronDown className="h-3 w-3" />
      </motion.div>
      <span className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Single Nav Item                                                     */
/* ------------------------------------------------------------------ */
function NavItem({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavGroup['items'][number];
  isActive: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'admin-nav-button w-full flex items-center gap-3 rounded-lg text-sm font-medium relative group/navitem',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 min-h-12',
        'transition-all duration-200',
        !isActive && 'text-muted-foreground hover:text-foreground',
        isActive && 'text-primary admin-nav-item-active',
      )}
    >
      {/* Hover: gradient background that slides in from left */}
      <span className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
        <span
          className={cn(
            'absolute inset-0 -translate-x-full group-hover/navitem:translate-x-0 transition-transform duration-300 ease-out',
            isActive
              ? 'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent translate-x-0'
              : 'bg-gradient-to-r from-accent/60 via-accent/30 to-transparent',
          )}
        />
      </span>

      {/* Active: pill-shaped slide-in highlight */}
      {isActive && (
        <motion.div
          layoutId="active-nav-pill"
          className="absolute inset-0 rounded-lg bg-primary/[0.08]"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      {/* icon */}
      <span className="relative z-10 transition-transform duration-200 group-hover/navitem:scale-110 shrink-0">
        {item.icon}
      </span>

      {/* label */}
      {!collapsed && (
        <span className="relative z-10 truncate flex-1 text-left">{item.label}</span>
      )}

      {/* badge */}
      {item.badge && (
        <span
          className={cn(
            'relative z-10 w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse shrink-0',
            collapsed && 'absolute top-1.5 right-1.5',
          )}
        />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Sidebar Navigation                                          */
/* ------------------------------------------------------------------ */
function MobileSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentPage, setCurrentPage } = useAdminStore();
  const [search, setSearch] = useState('');
  const filteredGroups = useFilteredNavGroups(search);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <NavSearchInput value={search} onChange={setSearch} />

      {/* Navigation list */}
      <ScrollArea className="admin-nav-scroll flex-1 py-1 px-2">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Search className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No pages found for "{search}"</p>
          </div>
        ) : (
          <nav className="space-y-0.5">
            {filteredGroups.map((group, gi) => (
              <React.Fragment key={group.label}>
                {gi > 0 && <div className="my-2 h-px bg-border/30 mx-1" />}
                <div className="relative px-3 pt-3 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
                    {group.label}
                  </span>
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
                </div>
                {group.items.map((item) => {
                  const isActive = currentPage === item.page;
                  return (
                    <NavItem
                      key={item.page}
                      item={item}
                      isActive={isActive}
                      onClick={() => {
                        setCurrentPage(item.page);
                        onNavigate?.();
                      }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </nav>
        )}
      </ScrollArea>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Theme Toggle                                                       */
/* ------------------------------------------------------------------ */
function ThemeToggleButton({
  collapsed,
  onClick,
}: {
  collapsed?: boolean;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <button
      onClick={onClick}
      className={cn(
        'admin-nav-button w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
        'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        collapsed ? 'justify-center px-2' : 'justify-start',
        'group/theme-btn relative',
      )}
    >
      <span
        className="absolute inset-0 rounded-lg opacity-0 group-hover/theme-btn:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 18px 2px oklch(from var(--primary) l c h / 0.18)' }}
      />
      <motion.span
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative z-10 shrink-0"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </motion.span>
      {!collapsed && <span className="relative z-10 ml-2">Toggle Theme</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapse Toggle                                                    */
/* ------------------------------------------------------------------ */
function CollapseButton({
  sidebarOpen,
  onClick,
}: {
  sidebarOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'admin-nav-button w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
        'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        sidebarOpen ? 'justify-start' : 'justify-center px-2',
        'group/collapse-btn relative',
      )}
    >
      <span
        className="absolute inset-0 rounded-lg opacity-0 group-hover/collapse-btn:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 14px 2px oklch(from var(--primary) l c h / 0.12)' }}
      />
      <motion.span
        animate={{ rotate: sidebarOpen ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative z-10 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </motion.span>
      {sidebarOpen && <span className="relative z-10 ml-2">Collapse</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Sidebar Navigation                                         */
/* ------------------------------------------------------------------ */
function DesktopSidebarNav({
  currentPage,
  setCurrentPage,
  sidebarOpen,
}: {
  currentPage: AdminPage;
  setCurrentPage: (page: AdminPage) => void;
  sidebarOpen: boolean;
}) {
  const [search, setSearch] = useState('');
  const filteredGroups = useFilteredNavGroups(search);

  // Auto-expand all groups when searching
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.label] = true;
    });
    return initial;
  });

  const isSearching = search.trim().length > 0;

  const toggleGroup = (label: string) => {
    if (isSearching) return; // Don't toggle while searching
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search bar */}
      <NavSearchInput value={search} onChange={setSearch} collapsed={!sidebarOpen} />

      {/* Navigation list */}
      <ScrollArea className="admin-nav-scroll flex-1 py-1 px-2">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Search className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No pages found</p>
          </div>
        ) : (
          <nav className="space-y-0.5">
            {filteredGroups.map((group, gi) => {
              const isGroupExpanded = isSearching || (expandedGroups[group.label] ?? true);

              return (
                <React.Fragment key={group.label}>
                  {gi > 0 && <div className="my-2 h-px bg-border/30 mx-1" />}
                  {sidebarOpen && (
                    <NavGroupHeader
                      label={group.label}
                      isExpanded={isGroupExpanded}
                      onToggle={() => toggleGroup(group.label)}
                    />
                  )}
                  {!sidebarOpen && gi > 0 && <div className="py-1" />}
                  <AnimatePresence initial={false}>
                    {(!sidebarOpen || isGroupExpanded) && (
                      <motion.div
                        key={`${group.label}-items`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        {group.items.map((item) => {
                          const isActive = currentPage === item.page;
                          return (
                            <Tooltip key={item.page}>
                              <TooltipTrigger asChild>
                                <NavItem
                                  item={item}
                                  isActive={isActive}
                                  collapsed={!sidebarOpen}
                                  onClick={() => setCurrentPage(item.page)}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px]">
                                  {NAV_DESCRIPTIONS[item.page]}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </nav>
        )}
      </ScrollArea>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile hamburger button                                            */
/* ------------------------------------------------------------------ */
export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="admin-sidebar-mobile">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <SheetContent
          side="left"
          className="w-80 max-w-[85vw] p-0 bg-gradient-to-b from-card via-card to-card/95"
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          {/* Brand header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/20 shrink-0">
              <Coins className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base tracking-tight leading-tight truncate">
                TOLS Admin
              </span>
              <span className="text-[10px] text-muted-foreground/70 leading-tight truncate">
                Management Console
              </span>
            </div>
          </div>
          {/* Navigation with search */}
          <MobileSidebarNav onNavigate={() => setOpen(false)} />
          {/* Footer controls */}
          <div className="border-t border-border/50 p-2 space-y-1 shrink-0 safe-area-bottom">
            <div className="min-h-12 flex items-center">
              <ThemeToggleButton
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop sidebar                                                    */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
export function AdminSidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, toggleSidebar } = useAdminStore();
  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'admin-sidebar-desktop fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex-col border-r border-border/50 relative',
          sidebarOpen ? 'w-64' : 'w-16',
          'shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)]',
        )}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-card" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-background/80" />
        <div className="absolute inset-0 sidebar-noise" />

        {/* Content sits above background */}
        <div className="relative z-10 flex flex-col h-full min-h-0">
          {/* Subtle gradient line at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

          {/* Logo / Brand */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/20 shrink-0">
              <Coins className="h-4 w-4 text-primary-foreground" />
            </div>
            <div
              className={cn(
                'flex flex-col group/brand overflow-hidden transition-all duration-300',
                sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0',
              )}
            >
              <span className="font-bold text-base tracking-tight leading-tight whitespace-nowrap">
                TOLS Admin
              </span>
              <span className="text-[10px] text-muted-foreground/70 leading-tight whitespace-nowrap">
                Management Console
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-hidden min-h-0">
            <DesktopSidebarNav
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              sidebarOpen={sidebarOpen}
            />
          </div>

          {/* Footer Controls */}
          <div className="border-t border-border/50 p-2 space-y-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggleButton
                  collapsed={!sidebarOpen}
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle Theme</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <CollapseButton sidebarOpen={sidebarOpen} onClick={toggleSidebar} />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{sidebarOpen ? 'Collapse' : 'Expand'} Sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
