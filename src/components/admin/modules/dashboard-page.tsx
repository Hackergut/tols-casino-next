'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, UserCheck, ArrowDownToLine, ArrowUpFromLine, Dice5, Trophy, Timer,
  TrendingUp, Clock, UserPlus, Eye, Gamepad2, Coins, LayoutDashboard,
  ChevronRight, WifiOff, RefreshCw, Activity, Zap, ArrowRight, BarChart3,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Sun, Moon, CalendarDays, Flame,
  DollarSign, Crown, Pause, Play, Medal, Plus, Pencil, Trash2,
  ShieldAlert, Maximize2, Gauge, Wifi, Database, Server, Layers, Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTolsQuery } from '@/lib/tols-hooks';
import { CurrencyBadge, StatusBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import type { User, Deposit, Withdrawal, Bet, GlobalJackpot, Tournament, HouseEarning, SlotGame } from '@/types/tols';
import { useAdminStore, type AdminPage } from '@/stores/admin';
import { NotificationPanel } from '@/components/admin/shared/notification-panel';
import { useQueryClient } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { StatsBarChart } from '@/components/admin/shared/stats-bar-chart';
import { AnimatedCounter } from '@/components/admin/shared/animated-counter';

// ============================================================
// CONSTANTS
// ============================================================

const PIE_COLORS = ['#22c55e', 'var(--color-loss)', '#6b7280'];

const STAT_TRENDS: Record<string, { direction: 'up' | 'down'; value: string }> = {
  'Total Users': { direction: 'up', value: '+12.5%' },
  'Active Users': { direction: 'up', value: '+8.3%' },
  'Total Deposits': { direction: 'up', value: '+5.1%' },
  'Total Withdrawals': { direction: 'down', value: '-2.4%' },
  'Total Bets': { direction: 'up', value: '+18.7%' },
  'House Earnings': { direction: 'up', value: '+15.2%' },
  'Active Jackpots': { direction: 'up', value: '+1' },
  'Active Tournaments': { direction: 'down', value: '-1' },
};

const QUICK_ACTIONS = [
  {
    label: 'Add User', icon: UserPlus, page: 'users' as const,
    description: 'Create and manage user accounts',
    gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400', accentColor: '#10b981',
  },
  {
    label: 'Process Withdrawals', icon: ArrowUpFromLine, page: 'withdrawals' as const,
    description: 'Review and process pending requests',
    gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400', accentColor: 'var(--color-pending)',
  },
  {
    label: 'Manage Games', icon: Gamepad2, page: 'slot-games' as const,
    description: 'Configure slot games and parameters',
    gradient: 'from-rose-500 to-pink-600', iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400', accentColor: '#f43f5e',
  },
  {
    label: 'View Reports', icon: BarChart3, page: 'house-earnings' as const,
    description: 'Financial and activity reports',
    gradient: 'from-cyan-500 to-teal-600', iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-600 dark:text-cyan-400', accentColor: '#06b6d4',
  },
  {
    label: 'Tournament Setup', icon: Trophy, page: 'tournaments' as const,
    description: 'Create and manage tournament events',
    gradient: 'from-orange-500 to-amber-600', iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-600 dark:text-orange-400', accentColor: '#f97316',
  },
  {
    label: 'System Settings', icon: Settings, page: 'settings' as const,
    description: 'Platform configuration and preferences',
    gradient: 'from-violet-500 to-purple-600', iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400', accentColor: '#8b5cf6',
  },
];

const CURRENCY_COLORS: Record<string, string> = {
  BTC: 'var(--color-pending)', ETH: 'var(--color-vip)', SOL: '#14b8a6', USDT: '#22c55e', USDC: '#3b82f6',
};

const STAT_ACCENT_COLORS: Record<string, string> = {
  'Total Users': '#3b82f6', 'Active Users': '#14b8a6', 'Total Deposits': '#22c55e',
  'Total Withdrawals': 'var(--color-pending)', 'Total Bets': '#f97316', 'House Earnings': 'var(--color-vip)',
  'Active Jackpots': 'var(--color-pending)', 'Active Tournaments': '#f43f5e',
};

// ============================================================
// ANIMATION VARIANTS
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const flashVariants = {
  idle: { opacity: 0 },
  flash: { opacity: [0, 0.4, 0], transition: { duration: 0.6, ease: 'easeInOut' as const } },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return formatDate(dateStr);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function abbreviateNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function customTooltipStyle(): React.CSSProperties {
  return {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px', fontSize: 12, padding: '10px 14px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    color: 'hsl(var(--popover-foreground))',
  };
}

// ============================================================
// ENHANCED EMPTY STATE
// ============================================================

function EnhancedEmptyState({
  icon: Icon,
  entity,
  entityPlural,
  hasFilters = false,
  onClearFilters,
}: {
  icon: React.ElementType;
  entity: string;
  entityPlural?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}) {
  const plural = entityPlural || `${entity}s`;
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative h-20 w-20 mb-4">
        {/* Spinning dashed border */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_10s_linear_infinite]" />
        {/* Gradient background circle with icon */}
        <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <Icon className="h-8 w-8 text-primary/40" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">No {entity} data available</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[260px]">
        {hasFilters
          ? 'Try adjusting your filters to see more results'
          : `Data will appear here once ${plural} are created`}
      </p>
      {hasFilters && onClearFilters && (
        <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// ============================================================
// CHART PERIOD TABS
// ============================================================

function ChartPeriodTabs({ period, onChange }: { period: string; onChange: (v: string) => void }) {
  return (
    <Tabs value={period} onValueChange={onChange}>
      <TabsList className="h-7">
        <TabsTrigger value="7" className="text-[11px] px-2 h-5">7d</TabsTrigger>
        <TabsTrigger value="30" className="text-[11px] px-2 h-5">30d</TabsTrigger>
        <TabsTrigger value="all" className="text-[11px] px-2 h-5">All</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// ============================================================
// MINI SPARKLINE
// ============================================================

function MiniSparkline({ color, seed, className = '' }: { color: string; seed: string; className?: string }) {
  const pathData = useMemo(() => {
    const points: number[] = [];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0; }
    for (let i = 0; i < 8; i++) {
      hash = ((hash << 5) - hash + i * 13 + 7) | 0;
      points.push(30 + Math.abs(hash % 55));
    }
    const width = 80; const height = 32; const pad = 2;
    const maxVal = Math.max(...points); const minVal = Math.min(...points);
    const range = maxVal - minVal || 1;
    const linePath = points.map((val, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - minVal) / range) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    const areaPath = linePath + ` L ${(width - pad).toFixed(1)} ${(height - pad).toFixed(1)} L ${pad.toFixed(1)} ${(height - pad).toFixed(1)} Z`;
    return { linePath, areaPath, width, height };
  }, [seed]);

  const gradId = `spark-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={pathData.width} height={pathData.height} viewBox={`0 0 ${pathData.width} ${pathData.height}`} className={`opacity-50 group-hover:opacity-90 transition-opacity duration-300 ${className}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={pathData.areaPath} fill={`url(#${gradId})`} />
      <path d={pathData.linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pathData.linePath.split(' ').slice(-2)[0]} cy={pathData.linePath.split(' ').slice(-1)[0]} r="2.5" fill={color} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </svg>
  );
}

// ============================================================
// CHART CARD WRAPPER
// ============================================================

function ChartCardWrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-xl p-[1px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent ${className}`}>
      <div className="bg-card/60 backdrop-blur-sm rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

// ============================================================
// WELCOME BANNER
// ============================================================

function WelcomeBanner({ activeUsers, totalEarnings, todayBets }: { activeUsers: number; totalEarnings: number; todayBets: number }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  const greeting = getGreeting();
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const hour = time.getHours();
  const isDaytime = hour >= 6 && hour < 18;
  const summaryLine = activeUsers > 0 ? 'Your platform is performing well today' : 'Welcome back \u2014 let\'s get things moving';

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(-45deg, #059669, #0d9488, #0891b2, #06b6d4, #059669)', backgroundSize: '400% 400%' }} animate={{ backgroundPosition: ['0% 50%', '100% 50%', '50% 0%', '0% 50%'] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="absolute inset-0 bg-black/20 dark:bg-black/35" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute right-1/4 top-1/3 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <CardContent className="relative z-10 py-8 px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm shadow-lg shadow-black/10">
                  {isDaytime ? <Sun className="h-5 w-5 text-amber-300" /> : <Moon className="h-5 w-5 text-indigo-200" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{greeting}, Admin</h2>
                  <p className="text-sm text-white/75 leading-relaxed">{summaryLine}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-white/60 text-xs"><CalendarDays className="h-3.5 w-3.5" /><span>{dateStr}</span></div>
                <div className="flex items-center justify-end gap-2.5 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-200/80 uppercase tracking-widest">Live</span>
                  </div>
                  <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{timeStr}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <Flame className="h-4 w-4 text-orange-300" />
                <span className="text-xs font-semibold text-white/90">{activeUsers} active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// LIVE DATA TICKER
// ============================================================

function LiveDataTicker({ entries }: { entries: Array<{ id: string; action: string; entity: string; timestamp: Date | string }> }) {
  const tickerItems = useMemo(() => {
    return entries.slice(-8).reverse().map((entry) => {
      const actionConfig: Record<string, { icon: React.ElementType; iconColor: string; label: string }> = {
        create: { icon: Plus, iconColor: 'text-emerald-500', label: 'created' },
        update: { icon: Pencil, iconColor: 'text-amber-500', label: 'updated' },
        delete: { icon: Trash2, iconColor: 'text-red-500', label: 'deleted' },
        view: { icon: Eye, iconColor: 'text-sky-500', label: 'viewed' },
        navigate: { icon: ArrowRight, iconColor: 'text-violet-500', label: 'navigated' },
      };
      const cfg = actionConfig[entry.action] || actionConfig.navigate;
      const Icon = cfg.icon;
      const ts = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
      const timeStr = formatRelativeTime(ts.toISOString());
      return { id: entry.id, Icon, iconColor: cfg.iconColor, label: cfg.label, entity: entry.entity, timeStr };
    });
  }, [entries]);

  if (tickerItems.length === 0) return null;
  const displayItems = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="relative overflow-hidden rounded-lg bg-muted/40 border border-border/30 py-2.5 px-0">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-muted/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-muted/80 to-transparent z-10 pointer-events-none" />
      <div className="flex items-center overflow-hidden group/ticker">
        <div className="flex items-center shrink-0 px-3 gap-1.5 border-r border-border/30 mr-3">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Live Feed</span>
        </div>
        <div className="flex items-center gap-6 animate-[ticker-scroll_30s_linear_infinite] group-hover/ticker:[animation-play-state:paused]">
          {displayItems.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <item.Icon className={`h-3 w-3 ${item.iconColor}`} />
              <span className="text-xs font-medium text-foreground/80">{item.entity}</span>
              <span className={`text-xs ${item.iconColor}`}>{item.label}</span>
              <span className="text-[10px] text-muted-foreground/60">{item.timeStr}</span>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }`}</style>
    </motion.div>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  icon: Icon, label, value, numericValue, decimals = 0,
  counterPrefix = '', counterSuffix = '', sub, color, loading, onClick, index, isFlashing,
}: {
  icon: React.ElementType; label: string; value: string; numericValue?: number;
  decimals?: number; counterPrefix?: string; counterSuffix?: string;
  sub?: string; color: string; loading?: boolean; onClick?: () => void;
  index: number; isFlashing?: boolean;
}) {
  const clickable = !!onClick;
  const trend = STAT_TRENDS[label];
  const accentColor = STAT_ACCENT_COLORS[label] || '#6b7280';
  const isUp = trend?.direction === 'up';

  return (
    <motion.div variants={cardVariants}>
      <motion.div className="rounded-xl" whileHover={{ boxShadow: `0 0 24px ${accentColor}30, 0 0 48px ${accentColor}12` }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <Card className={`relative overflow-hidden bg-card/40 backdrop-blur-sm border border-border/30 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 group ${clickable ? 'cursor-pointer' : ''}`} onClick={onClick} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
          <motion.div className="absolute inset-0 bg-primary/20 pointer-events-none z-10" variants={flashVariants} initial="idle" animate={isFlashing ? 'flash' : 'idle'} />
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
            <motion.div className="absolute inset-y-0 w-1/3" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}08, transparent)` }} animate={{ x: ['-100%', '400%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 5, ease: 'linear' }} />
          </div>
          <div className={`absolute -left-4 -top-4 h-20 w-20 rounded-full opacity-[0.08] group-hover:opacity-[0.16] transition-opacity duration-300`} style={{ backgroundColor: accentColor, filter: 'blur(20px)' }} />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300" style={{ backgroundColor: accentColor, filter: 'blur(24px)' }} />
          <div className="absolute top-3 right-3"><MiniSparkline color={accentColor} seed={label} /></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">{label}</CardDescription>
            <div className="flex items-center gap-1">
              <div className={`rounded-lg p-2 ${color} shadow-sm`}><Icon className="h-4 w-4 text-white" /></div>
              {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />}
            </div>
          </CardHeader>
          <CardContent className="relative">
            {loading ? (
              <><Skeleton className="h-8 w-28 mb-1" /><Skeleton className="h-4 w-20" /></>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold tracking-tight">
                    {numericValue !== undefined ? (
                      <AnimatedCounter value={numericValue} decimals={decimals} prefix={counterPrefix} suffix={counterSuffix} />
                    ) : value}
                  </div>
                  {trend && (
                    <motion.div className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${isUp ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-red-500 dark:text-red-400 bg-red-500/10'}`} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.05 }}>
                      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      <span>{trend.value}</span>
                    </motion.div>
                  )}
                </div>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
              </>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}66)` }} />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// RECENT ACTIVITY CARD
// ============================================================

function RecentActivityCard({ title, loading, children, viewAllPage, onNavigate }: {
  title: string; loading: boolean; children: React.ReactNode; viewAllPage?: string; onNavigate?: () => void;
}) {
  return (
    <ChartCardWrapper>
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{title}</CardTitle>
            {viewAllPage && onNavigate && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={onNavigate}>
                View All<ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-48" /><Skeleton className="h-3 w-32" /></div>
              </div>
            )) : children}
          </div>
        </CardContent>
      </Card>
    </ChartCardWrapper>
  );
}

// ============================================================
// ACTIVITY ITEM
// ============================================================

function getInitials(text: string): string {
  return text.split(/[\s_-]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function ActivityItem({ children, type = 'default' }: { children: React.ReactNode; type?: 'bet' | 'deposit' | 'user' | 'default' }) {
  const typeConfig: Record<string, { icon: React.ElementType; iconBg: string; iconColor: string; borderColor: string }> = {
    bet: { icon: Dice5, iconBg: 'bg-purple-500/15', iconColor: 'text-purple-600 dark:text-purple-400', borderColor: 'border-l-purple-500' },
    deposit: { icon: ArrowDownToLine, iconBg: 'bg-green-500/15', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-l-green-500' },
    user: { icon: Users, iconBg: 'bg-primary/10', iconColor: 'text-primary', borderColor: 'border-l-primary' },
    default: { icon: Activity, iconBg: 'bg-muted', iconColor: 'text-muted-foreground', borderColor: 'border-l-muted' },
  };
  const config = typeConfig[type] || typeConfig.default;
  return (
    <div className={`flex items-stretch gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors border-l-[3px] ${config.borderColor}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ============================================================
// ENHANCED TOOLTIPS
// ============================================================

function EnhancedLineTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const formattedDate = label ? new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <div style={customTooltipStyle()}>
      <p className="font-semibold text-xs mb-1.5 opacity-70">{formattedDate}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center justify-between gap-6 text-xs py-0.5">
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} /><span className="opacity-80">{entry.name}</span></div>
          <span className="font-semibold tabular-nums">{abbreviateNumber(entry.value)}</span>
        </div>
      ))}
      <div className="border-t border-border/50 mt-1.5 pt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowRight className="h-2.5 w-2.5" /><span>Click to view details</span></div>
    </div>
  );
}

function EnhancedPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; value: number; color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]; const total = (entry?.payload as { _total?: number })?._total ?? 1;
  const percent = ((entry.value / total) * 100).toFixed(1);
  return (
    <div style={customTooltipStyle()}>
      <div className="flex items-center gap-2 mb-1"><div className="h-3 w-3 rounded" style={{ backgroundColor: entry.payload.color }} /><span className="font-semibold text-sm">{entry.name}</span></div>
      <div className="text-xs space-y-0.5">
        <div className="flex justify-between gap-6"><span className="opacity-70">Count</span><span className="font-semibold tabular-nums">{entry.value.toLocaleString()}</span></div>
        <div className="flex justify-between gap-6"><span className="opacity-70">Share</span><span className="font-semibold tabular-nums">{percent}%</span></div>
      </div>
      <div className="border-t border-border/50 mt-1.5 pt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowRight className="h-2.5 w-2.5" /><span>Click to view details</span></div>
    </div>
  );
}

function EnhancedBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload: { name: string; value: number; color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]; const raw = entry.payload;
  return (
    <div style={customTooltipStyle()}>
      <div className="flex items-center gap-2 mb-1"><div className="h-3 w-3 rounded" style={{ backgroundColor: raw.color }} /><span className="font-semibold text-sm">{raw.name}</span></div>
      <div className="text-xs"><div className="flex justify-between gap-6"><span className="opacity-70">Value</span><span className="font-semibold tabular-nums">{abbreviateNumber(raw.value)}</span></div></div>
      <div className="border-t border-border/50 mt-1.5 pt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowRight className="h-2.5 w-2.5" /><span>Click to view details</span></div>
    </div>
  );
}

// ============================================================
// TOP ENTITIES TABLE
// ============================================================

interface TopEntityRow { id: string; name: string; metric: string; metricValue: number; page: AdminPage; }

function TopEntitiesTable({ title, icon: Icon, data, metricLabel, loading }: {
  title: string; icon: React.ElementType; data: TopEntityRow[]; metricLabel: string; loading: boolean;
}) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const rankColors: Record<number, string> = { 1: 'bg-amber-500 text-white', 2: 'bg-slate-400 text-white', 3: 'bg-orange-700 text-white' };

  return (
    <ChartCardWrapper>
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5"><Icon className="h-3.5 w-3.5 text-primary" /></div>
            <div><CardTitle className="text-base">{title}</CardTitle><CardDescription className="text-xs">Top 5 by {metricLabel}</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : data.length === 0 ? (
            <EnhancedEmptyState icon={Icon} entity={title.toLowerCase().replace('top ', '').replace(' by ', ' ')} />
          ) : (
            <div className="space-y-1">
              {data.map((row, idx) => (
                <motion.div key={row.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.25 }} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group" onClick={() => setCurrentPage(row.page)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPage(row.page); } }}>
                  <div className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${rankColors[idx + 1] || 'bg-muted text-muted-foreground'}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{row.name}</p>
                    <p className="text-[10px] text-muted-foreground">{row.metric}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="text-sm font-semibold tabular-nums">{abbreviateNumber(row.metricValue)}</p></div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ChartCardWrapper>
  );
}

// ============================================================
// AUTO-REFRESH PROGRESS BAR
// ============================================================

function AutoRefreshBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
      <motion.div className="h-full bg-emerald-500" initial={{ width: '0%' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: 'linear' }} />
    </div>
  );
}

// ============================================================
// ENHANCED CHART CARD
// ============================================================

function EnhancedChartCard({
  title, description, children, onMaximize, dotColor = '#22c55e', isPulsing = false, className = '', headerExtra,
}: {
  title: string; description?: string; children: React.ReactNode; onMaximize?: () => void;
  dotColor?: string; isPulsing?: boolean; className?: string; headerExtra?: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-xl p-[1px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent ${className}`}>
      <div className="bg-card/60 backdrop-blur-sm rounded-xl overflow-hidden">
        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {isPulsing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: dotColor }} />}
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: dotColor, opacity: isPulsing ? 1 : 0.4 }} />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{title}</CardTitle>
                  {description && <CardDescription className="truncate">{description}</CardDescription>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {headerExtra}
                {onMaximize && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50" onClick={onMaximize} title="Maximize chart">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// CHART MAXIMIZE DIALOG
// ============================================================

function ChartMaximizeDialog({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] lg:max-w-[70vw] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-y-auto pr-1 custom-scrollbar">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SYSTEM HEALTH PANEL (ENHANCED)
// ============================================================

function SystemHealthPanel({
  isConnected, isChecking, avgResponseMs, lastSyncAgo, activeConnections,
  lastCheckedTime, totalRequests, onRefreshAll, isRefreshing,
}: {
  isConnected: boolean; isChecking: boolean; avgResponseMs: number; lastSyncAgo: number;
  activeConnections: number; lastCheckedTime: Date | null; totalRequests: number;
  onRefreshAll: () => void; isRefreshing: boolean;
}) {
  const statusColor = isChecking ? 'var(--color-pending)' : isConnected ? '#22c55e' : 'var(--color-loss)';
  const statusLabel = isChecking ? 'Checking' : isConnected ? 'Connected' : 'Disconnected';

  const responseColor = avgResponseMs < 200 ? 'text-emerald-500' : avgResponseMs < 500 ? 'text-amber-500' : 'text-red-500';
  const responseProgress = Math.min(100, (avgResponseMs / 1000) * 100);
  const responseProgressColor = avgResponseMs < 200 ? 'bg-emerald-500' : avgResponseMs < 500 ? 'bg-amber-500' : 'bg-red-500';

  const freshnessColor = lastSyncAgo < 10 ? 'text-emerald-500' : lastSyncAgo < 30 ? 'text-amber-500' : 'text-red-500';
  const freshnessProgress = Math.max(0, Math.min(100, 100 - (lastSyncAgo / 60) * 100));
  const freshnessProgressColor = lastSyncAgo < 10 ? 'bg-emerald-500' : lastSyncAgo < 30 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Server className="h-4 w-4 text-muted-foreground" />System Status</h2>
      <Card className="border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Large animated status circle */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative h-12 w-12">
                {/* Spinning dashed border ring */}
                <div className="absolute -inset-1.5 rounded-full border-2 border-dashed animate-[spin_8s_linear_infinite]" style={{ borderColor: `${statusColor}30` }} />
                {/* Pulse ring for connected */}
                {isConnected && !isChecking && (
                  <div className="absolute -inset-1 rounded-full animate-ping opacity-30" style={{ backgroundColor: statusColor }} />
                )}
                {/* Inner circle */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: `${statusColor}15` }}>
                  {isChecking ? (
                    <RefreshCw className="h-5 w-5 animate-spin" style={{ color: statusColor }} />
                  ) : isConnected ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: statusColor }} />
                  ) : (
                    <WifiOff className="h-5 w-5" style={{ color: statusColor }} />
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold" style={{ borderColor: `${statusColor}40`, color: statusColor }}>
                {statusLabel}
              </Badge>
            </div>

            {/* Metrics grid */}
            <div className="flex-1 min-w-0 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Avg Response */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Avg Response</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${responseColor}`}>{avgResponseMs}<span className="text-xs font-normal ml-0.5">ms</span></p>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div className={`h-full rounded-full ${responseProgressColor}`} initial={{ width: 0 }} animate={{ width: `${responseProgress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                </div>
              </div>

              {/* Requests Today */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Requests Today</p>
                </div>
                <p className="text-xl font-bold tabular-nums">{totalRequests.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/60">API calls this session</p>
              </div>

              {/* Data Freshness */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Data Freshness</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${freshnessColor}`}>{lastSyncAgo < 60 ? `${lastSyncAgo}s` : `${Math.floor(lastSyncAgo / 60)}m`}</p>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div className={`h-full rounded-full ${freshnessProgressColor}`} initial={{ width: 0 }} animate={{ width: `${freshnessProgress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                </div>
              </div>

              {/* Last Checked + Refresh */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Last Checked</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{lastCheckedTime ? lastCheckedTime.toLocaleTimeString() : 'Pending...'}</p>
                <Button variant="outline" size="sm" className="h-7 text-xs w-full mt-1" onClick={onRefreshAll} disabled={isRefreshing}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh All
                </Button>
              </div>
            </div>
          </div>

          {/* Active connections footer bar */}
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs text-muted-foreground">Active connections: <span className="font-semibold text-foreground">{activeConnections}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </div>
              Auto-refresh every 30s
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// ANIMATED SEPARATOR
// ============================================================

function AnimatedSeparator() {
  return (
    <div className="relative h-px w-full overflow-hidden">
      <div className="absolute inset-0 bg-border" />
      <motion.div className="absolute inset-y-0 h-full w-1/3 bg-gradient-to-r from-transparent via-primary/40 to-transparent" animate={{ x: ['-100%', '400%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />
    </div>
  );
}

// ============================================================
// PLATFORM ENTITIES GRID
// ============================================================

function PlatformEntitiesGrid({ entities, lastUpdatedStr }: {
  entities: Array<{
    name: string; icon: React.ElementType; page: AdminPage; description: string;
    color: string; count: number; status: string;
  }>;
  lastUpdatedStr: string;
}) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);

  const statusDotColor = (status: string) => {
    if (status === 'fetching') return 'bg-amber-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-emerald-500';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <AnimatedSeparator />
      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Platform Entities
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </div>
            <span>Last Updated: {lastUpdatedStr}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {entities.map((entity, idx) => (
            <motion.div
              key={entity.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              whileHover={{ y: -2, boxShadow: `0 8px 24px ${entity.color}15` }}
              className="cursor-pointer"
              onClick={() => setCurrentPage(entity.page)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPage(entity.page); } }}
            >
              <Card className="bg-card/60 backdrop-blur-sm border border-border/30 h-full transition-colors hover:border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${entity.color}15` }}>
                      <entity.icon className="h-4 w-4" style={{ color: entity.color }} />
                    </div>
                    <div className={`h-2 w-2 rounded-full ${statusDotColor(entity.status)}`} title={entity.status} />
                  </div>
                  <h3 className="text-sm font-semibold mb-0.5 truncate">{entity.name}</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight mb-2 line-clamp-2">{entity.description}</p>
                  <p className="text-lg font-bold tabular-nums">{entity.count.toLocaleString()}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// MAIN DASHBOARD PAGE
// ============================================================

export function DashboardPage() {
  const [chartPeriod, setChartPeriod] = useState<'7' | '30' | 'all'>('30');
  const [isConnected, setIsConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const [totalRequests, setTotalRequests] = useState(0);

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [lastRefreshAgo, setLastRefreshAgo] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDataUpdatedAtRef = useRef<number>(0);
  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
  const [apiResponseTimes, setApiResponseTimes] = useState<number[]>([]);
  const apiStartTimeRef = useRef<number>(0);

  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const actionLog = useAdminStore((s) => s.actionLog);
  const recentActionLog = useMemo(() => actionLog.slice(-5).reverse(), [actionLog]);
  const queryClient = useQueryClient();

  // Connectivity check — tests TOLS API root via proxy
  React.useEffect(() => {
    const check = async () => {
      setIsChecking(true);
      try {
        apiStartTimeRef.current = performance.now();
        const res = await fetch('/api/tols?path=/&api_key=test&_test=true');
        const elapsed = Math.round(performance.now() - apiStartTimeRef.current);
        const data = await res.json();
        setIsConnected(!!data?.success);
        setApiResponseTimes((prev) => [...prev.slice(-9), elapsed]);
        setTotalRequests((prev) => prev + 7);
      } catch {
        setIsConnected(false);
      } finally {
        setLastCheckedTime(new Date());
        setIsChecking(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const avgResponseMs = useMemo(() => {
    if (apiResponseTimes.length === 0) return 150;
    return Math.round(apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length);
  }, [apiResponseTimes]);

  const activeConnections = useMemo(() => {
    const cache = queryClient.getQueryCache();
    return cache.getAll().filter((q) => q.state.fetchStatus === 'fetching').length;
  }, [queryClient]);

  // Queries
  apiStartTimeRef.current = performance.now();
  const usersQuery = useTolsQuery<User>('User', { limit: 100 });
  const depositsQuery = useTolsQuery<Deposit>('Deposit', { limit: 100 });
  const withdrawalsQuery = useTolsQuery<Withdrawal>('Withdrawal', { limit: 100 });
  const betsQuery = useTolsQuery<Bet>('Bet', { limit: 100 });
  const jackpotsQuery = useTolsQuery<GlobalJackpot>('GlobalJackpot', { limit: 50 });
  const tournamentsQuery = useTolsQuery<Tournament>('Tournament', { limit: 50 });
  const earningsQuery = useTolsQuery<HouseEarning>('HouseEarning', { limit: 100 });
  const slotGamesQuery = useTolsQuery<SlotGame>('SlotGame', { limit: 100 });

  const loading = usersQuery.isLoading || depositsQuery.isLoading || withdrawalsQuery.isLoading || betsQuery.isLoading;

  const users = usersQuery.data?.data || [];
  const deposits = depositsQuery.data?.data || [];
  const withdrawals = withdrawalsQuery.data?.data || [];
  const bets = betsQuery.data?.data || [];
  const jackpots = jackpotsQuery.data?.data || [];
  const tournaments = tournamentsQuery.data?.data || [];
  const earnings = earningsQuery.data?.data || [];
  const slotGames = slotGamesQuery.data?.data || [];

  // Derived stats
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'active').length, [users]);
  const pendingDeposits = useMemo(() => deposits.filter((d) => d.status === 'pending').length, [deposits]);
  const pendingWithdrawals = useMemo(() => withdrawals.filter((w) => w.status === 'pending').length, [withdrawals]);
  const recentWins = useMemo(() => bets.filter((b) => b.result === 'win').length, [bets]);
  const activeJackpots = useMemo(() => jackpots.filter((j) => j.status === 'active'), [jackpots]);
  const activeTournaments = useMemo(() => tournaments.filter((t) => t.status === 'active' || t.status === 'upcoming'), [tournaments]);
  const totalEarnings = useMemo(() => earnings.reduce((sum, e) => sum + (e.amount || 0), 0), [earnings]);

  const lastRefresh = useMemo(() => {
    const timestamps = [usersQuery.dataUpdatedAt, depositsQuery.dataUpdatedAt, withdrawalsQuery.dataUpdatedAt, betsQuery.dataUpdatedAt].filter(Boolean) as number[];
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [usersQuery.dataUpdatedAt, depositsQuery.dataUpdatedAt, withdrawalsQuery.dataUpdatedAt, betsQuery.dataUpdatedAt]);

  // Flash effect on data update
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const maxTs = Math.max(
      usersQuery.dataUpdatedAt || 0, depositsQuery.dataUpdatedAt || 0, withdrawalsQuery.dataUpdatedAt || 0,
      betsQuery.dataUpdatedAt || 0, earningsQuery.dataUpdatedAt || 0, jackpotsQuery.dataUpdatedAt || 0, tournamentsQuery.dataUpdatedAt || 0,
    );
    if (maxTs > 0 && prevDataUpdatedAtRef.current > 0 && maxTs !== prevDataUpdatedAtRef.current) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      const startFlash = () => {
        setIsFlashing(true);
        flashTimerRef.current = setTimeout(() => { setIsFlashing(false); flashTimerRef.current = null; }, 700);
      };
      const deferId = setTimeout(startFlash, 0);
      return () => { clearTimeout(deferId); if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
    }
    prevDataUpdatedAtRef.current = maxTs;
  }, [usersQuery.dataUpdatedAt, depositsQuery.dataUpdatedAt, withdrawalsQuery.dataUpdatedAt, betsQuery.dataUpdatedAt, earningsQuery.dataUpdatedAt, jackpotsQuery.dataUpdatedAt, tournamentsQuery.dataUpdatedAt]);

  // Auto-refresh logic
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshProgress(0);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }
    let elapsed = 0;
    progressIntervalRef.current = setInterval(() => {
      elapsed += 300; setRefreshProgress((elapsed / 30000) * 100);
      if (elapsed >= 30000) elapsed = 0;
    }, 300);
    autoRefreshTimerRef.current = setInterval(() => { handleRefreshAll(); }, 30000);
    return () => { if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current); if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [autoRefreshEnabled, handleRefreshAll]);

  useEffect(() => {
    const interval = setInterval(() => { if (lastRefresh) { setLastRefreshAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000)); } }, 1000);
    return () => clearInterval(interval);
  }, [lastRefresh]);

  const formatAgo = (seconds: number) => {
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  };

  // Date cutoff for chart period filtering
  const dateCutoff = useMemo(() => {
    if (chartPeriod === 'all') return null;
    const days = parseInt(chartPeriod);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff.toISOString().slice(0, 10);
  }, [chartPeriod]);

  // Filtered data arrays for charts
  const chartDeposits = useMemo(() => {
    if (!dateCutoff) return deposits;
    return deposits.filter((d) => (d.created_date || '') >= dateCutoff);
  }, [deposits, dateCutoff]);

  const chartWithdrawals = useMemo(() => {
    if (!dateCutoff) return withdrawals;
    return withdrawals.filter((w) => (w.created_date || '') >= dateCutoff);
  }, [withdrawals, dateCutoff]);

  const chartBets = useMemo(() => {
    if (!dateCutoff) return bets;
    return bets.filter((b) => (b.created_date || '') >= dateCutoff);
  }, [bets, dateCutoff]);

  const chartEarnings = useMemo(() => {
    if (!dateCutoff) return earnings;
    return earnings.filter((e) => (e.created_date || '') >= dateCutoff);
  }, [earnings, dateCutoff]);

  // Pie chart data
  const betResultData = useMemo(() => {
    const win = chartBets.filter((b) => b.result === 'win').length;
    const loss = chartBets.filter((b) => b.result === 'loss').length;
    const pending = chartBets.filter((b) => b.result === 'pending').length;
    const total = win + loss + pending;
    return [
      { name: 'Win', value: win, color: PIE_COLORS[0], _total: total },
      { name: 'Loss', value: loss, color: PIE_COLORS[1], _total: total },
      { name: 'Pending', value: pending, color: PIE_COLORS[2], _total: total },
    ];
  }, [chartBets]);

  const revenueByCurrencyData = useMemo(() => {
    const currencyMap: Record<string, number> = {};
    chartEarnings.forEach((e) => { const cur = e.currency || 'Unknown'; currencyMap[cur] = (currencyMap[cur] || 0) + (e.amount || 0); });
    return Object.entries(currencyMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, color: CURRENCY_COLORS[name] || '#6b7280' })).sort((a, b) => b.value - a.value);
  }, [chartEarnings]);

  const depositCurrencyData = useMemo(() => {
    const currencyMap: Record<string, number> = {};
    chartDeposits.forEach((d) => { const cur = d.currency || 'Unknown'; currencyMap[cur] = (currencyMap[cur] || 0) + 1; });
    return ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].map((name) => ({ name, value: currencyMap[name] || 0, color: CURRENCY_COLORS[name] || '#6b7280' })).filter((d) => d.value > 0);
  }, [chartDeposits]);

  const withdrawalCurrencyData = useMemo(() => {
    const currencyMap: Record<string, number> = {};
    chartWithdrawals.forEach((w) => { const cur = w.currency || 'Unknown'; currencyMap[cur] = (currencyMap[cur] || 0) + 1; });
    return ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].map((name) => ({ name, value: currencyMap[name] || 0, color: CURRENCY_COLORS[name] || '#6b7280' })).filter((d) => d.value > 0);
  }, [chartWithdrawals]);

  // Line chart data
  const dailyActivityData = useMemo(() => {
    const dateMap: Record<string, { date: string; deposits: number; withdrawals: number; bets: number }> = {};
    const process = (items: { created_date: string }[], key: 'deposits' | 'withdrawals' | 'bets') => {
      items.forEach((item) => { const d = item.created_date?.slice(0, 10) || 'unknown'; if (!dateMap[d]) dateMap[d] = { date: d, deposits: 0, withdrawals: 0, bets: 0 }; dateMap[d][key]++; });
    };
    process(chartDeposits, 'deposits');
    process(chartWithdrawals, 'withdrawals');
    process(chartBets, 'bets');
    const sorted = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    if (chartPeriod === 'all') return sorted;
    return sorted.slice(-parseInt(chartPeriod));
  }, [chartDeposits, chartWithdrawals, chartBets, chartPeriod]);

  // Top Entities Data
  const topUsersByDeposit = useMemo<TopEntityRow[]>(() => {
    const userDepositMap: Record<string, { total: number; currency: string }> = {};
    deposits.forEach((d) => { if (!userDepositMap[d.user_id]) userDepositMap[d.user_id] = { total: 0, currency: d.currency || 'USD' }; userDepositMap[d.user_id].total += d.amount || 0; });
    return Object.entries(userDepositMap).sort(([, a], [, b]) => b.total - a.total).slice(0, 5).map(([userId, data]) => {
      const user = users.find((u) => u.id === userId);
      return { id: userId, name: user?.username || userId.slice(0, 8) + '...', metric: `${data.currency} deposits`, metricValue: Math.round(data.total * 100) / 100, page: 'users' as const };
    });
  }, [deposits, users]);

  const topGamesByBets = useMemo<TopEntityRow[]>(() => {
    const gameBetMap: Record<string, number> = {};
    bets.forEach((b) => { const game = b.game_type || 'Unknown'; gameBetMap[game] = (gameBetMap[game] || 0) + 1; });
    return Object.entries(gameBetMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([game, count]) => ({ id: `game-${game}`, name: game, metric: 'Total bets', metricValue: count, page: 'bets' as const }));
  }, [bets]);

  const topTournamentsByPrize = useMemo<TopEntityRow[]>(() => {
    return [...tournaments].sort((a, b) => (b.prize_pool || 0) - (a.prize_pool || 0)).slice(0, 5).map((t) => ({ id: t.id, name: t.name, metric: `${t.currency || 'USD'} \u00b7 ${t.status}`, metricValue: t.prize_pool || 0, page: 'tournaments' as const }));
  }, [tournaments]);

  const topUsersDisplay = useMemo(() => {
    if (topUsersByDeposit.length > 0) return topUsersByDeposit;
    return users.slice(0, 5).map((u) => ({ id: u.id, name: u.username, metric: `${u.role} \u00b7 ${u.status}`, metricValue: 0, page: 'users' as const }));
  }, [topUsersByDeposit, users]);

  const recentBets = useMemo(() => bets.slice(0, 5), [bets]);
  const recentDeposits = useMemo(() => deposits.slice(0, 5), [deposits]);
  const recentUsers = useMemo(() => users.slice(0, 5), [users]);

  const todayNewUsers = useMemo(() => users.filter((u) => { if (!u.created_date) return false; return u.created_date.slice(0, 10) === new Date().toISOString().slice(0, 10); }).length, [users]);

  // Entity grid data
  const entityGridData = useMemo(() => [
    { name: 'Users', icon: Users, page: 'users' as const, description: 'User accounts and roles', color: '#14b8a6', count: users.length, status: usersQuery.fetchStatus },
    { name: 'Deposits', icon: ArrowDownToLine, page: 'deposits' as const, description: 'Deposit transactions', color: '#22c55e', count: deposits.length, status: depositsQuery.fetchStatus },
    { name: 'Withdrawals', icon: ArrowUpFromLine, page: 'withdrawals' as const, description: 'Withdrawal requests', color: 'var(--color-pending)', count: withdrawals.length, status: withdrawalsQuery.fetchStatus },
    { name: 'Bets', icon: Dice5, page: 'bets' as const, description: 'Betting activity', color: 'var(--color-vip)', count: bets.length, status: betsQuery.fetchStatus },
    { name: 'Jackpots', icon: Trophy, page: 'jackpot' as const, description: 'Global jackpot pools', color: 'var(--color-pending)', count: jackpots.length, status: jackpotsQuery.fetchStatus },
    { name: 'Tournaments', icon: Timer, page: 'tournaments' as const, description: 'Tournament events', color: '#f97316', count: tournaments.length, status: tournamentsQuery.fetchStatus },
    { name: 'Earnings', icon: TrendingUp, page: 'house-earnings' as const, description: 'House revenue', color: 'var(--color-loss)', count: earnings.length, status: earningsQuery.fetchStatus },
    { name: 'Slot Games', icon: Gamepad2, page: 'slot-games' as const, description: 'Game library', color: '#f43f5e', count: slotGames.length, status: slotGamesQuery.fetchStatus },
  ], [users.length, deposits.length, withdrawals.length, bets.length, jackpots.length, tournaments.length, earnings.length, slotGames.length, usersQuery.fetchStatus, depositsQuery.fetchStatus, withdrawalsQuery.fetchStatus, betsQuery.fetchStatus, jackpotsQuery.fetchStatus, tournamentsQuery.fetchStatus, earningsQuery.fetchStatus, slotGamesQuery.fetchStatus]);

  // Stat card data
  type StatCardData = { icon: React.ElementType; label: string; value: string; numericValue?: number; decimals?: number; counterPrefix?: string; counterSuffix?: string; sub?: string; color: string; page: AdminPage };

  const statCards: StatCardData[] = [
    { icon: Users, label: 'Total Users', value: users.length.toLocaleString(), numericValue: users.length, sub: `${activeUsers} active`, color: 'bg-emerald-500', page: 'users' as const },
    { icon: UserCheck, label: 'Active Users', value: activeUsers.toLocaleString(), numericValue: activeUsers, sub: `${((activeUsers / Math.max(users.length, 1)) * 100).toFixed(1)}% of total`, color: 'bg-teal-500', page: 'users' as const },
    { icon: ArrowDownToLine, label: 'Total Deposits', value: deposits.length.toLocaleString(), numericValue: deposits.length, sub: `${pendingDeposits} pending`, color: 'bg-green-500', page: 'deposits' as const },
    { icon: ArrowUpFromLine, label: 'Total Withdrawals', value: withdrawals.length.toLocaleString(), numericValue: withdrawals.length, sub: `${pendingWithdrawals} pending`, color: 'bg-amber-500', page: 'withdrawals' as const },
    { icon: Dice5, label: 'Total Bets', value: bets.length.toLocaleString(), numericValue: bets.length, sub: `${recentWins} wins recorded`, color: 'bg-purple-500', page: 'bets' as const },
    { icon: TrendingUp, label: 'House Earnings', value: formatAmount(totalEarnings), numericValue: totalEarnings, decimals: 2, counterPrefix: '$', sub: 'All-time revenue', color: 'bg-rose-500', page: 'house-earnings' as const },
    { icon: Trophy, label: 'Active Jackpots', value: activeJackpots.length.toLocaleString(), numericValue: activeJackpots.length, sub: activeJackpots.length > 0 ? `Top: ${formatAmount(activeJackpots[0].current_amount, activeJackpots[0].currency)}` : 'No active jackpots', color: 'bg-yellow-500', page: 'jackpot' as const },
    { icon: Timer, label: 'Active Tournaments', value: activeTournaments.length.toLocaleString(), numericValue: activeTournaments.length, sub: activeTournaments.length > 0 ? activeTournaments[0].name : 'No active tournaments', color: 'bg-orange-500', page: 'tournaments' as const },
  ];

  // Chart click handlers
  const handleLineChartClick = useCallback((data: { activePayload?: Array<{ payload: { date: string } }> }) => {
    if (data?.activePayload?.[0]?.payload?.date) setCurrentPage('deposits');
  }, [setCurrentPage]);

  const handlePieChartClick = useCallback((data: { activePayload?: Array<{ payload: { name: string } }> }) => {
    if (data?.activePayload?.[0]) setCurrentPage('bets');
  }, [setCurrentPage]);

  const handleBarChartClick = useCallback(() => {
    // Attached to a wrapping div (StatsBarChart doesn't forward recharts state),
    // so navigate unconditionally — cursor:pointer already advertises the action.
    setCurrentPage('deposits');
  }, [setCurrentPage]);

  const navigateTo = (page: AdminPage) => () => setCurrentPage(page);

  // Chart render helpers
  const periodTabs = <ChartPeriodTabs period={chartPeriod} onChange={(v) => setChartPeriod(v as '7' | '30' | 'all')} />;

  const renderDailyActivityChart = (height: number, gradientPrefix = 'main') => (
    loading ? (
      <Skeleton className="h-72 w-full" />
    ) : dailyActivityData.length === 0 ? (
      <EnhancedEmptyState icon={BarChart3} entity="activity" entityPlural="activity data" />
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={dailyActivityData} onClick={handleLineChartClick} style={{ cursor: 'pointer' }}>
          <defs>
            <linearGradient id={`${gradientPrefix}-grad-deposits`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${gradientPrefix}-grad-withdrawals`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-pending)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--color-pending)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${gradientPrefix}-grad-bets`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-vip)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--color-vip)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v: string) => { const d = new Date(v + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v: number) => abbreviateNumber(v)} />
          <Tooltip content={<EnhancedLineTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Legend />
          <Area type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} fill={`url(#${gradientPrefix}-grad-deposits)`} dot={false} name="Deposits" activeDot={{ r: 5, strokeWidth: 0, fill: '#22c55e' }} animationDuration={800} isAnimationActive />
          <Area type="monotone" dataKey="withdrawals" stroke="var(--color-pending)" strokeWidth={2} fill={`url(#${gradientPrefix}-grad-withdrawals)`} dot={false} name="Withdrawals" activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-pending)' }} animationDuration={800} animationBegin={150} isAnimationActive />
          <Area type="monotone" dataKey="bets" stroke="var(--color-vip)" strokeWidth={2} fill={`url(#${gradientPrefix}-grad-bets)`} dot={false} name="Bets" activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-vip)' }} animationDuration={800} animationBegin={300} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    )
  );

  const renderBetResultsChart = (height: number) => (
    loading ? (
      <Skeleton className="h-72 w-full" />
    ) : chartBets.length === 0 ? (
      <EnhancedEmptyState icon={Dice5} entity="bet" entityPlural="bets" />
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart onClick={handlePieChartClick} style={{ cursor: 'pointer' }}>
          <Pie data={betResultData} cx="50%" cy="50%" innerRadius={height * 0.21} outerRadius={height * 0.32} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} animationDuration={800} isAnimationActive>
            {betResultData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} strokeWidth={0} />)}
          </Pie>
          <Tooltip content={<EnhancedPieTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  );

  const renderRevenueByCurrencyChart = () => (
    earningsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : revenueByCurrencyData.length === 0 ? (
      <EnhancedEmptyState icon={TrendingUp} entity="earnings" entityPlural="earnings data" />
    ) : (
      <div onClick={handleBarChartClick} style={{ cursor: 'pointer' }}><StatsBarChart data={revenueByCurrencyData} height={180} /></div>
    )
  );

  const renderDepositVolumeChart = () => (
    loading ? <Skeleton className="h-48 w-full" /> : depositCurrencyData.length === 0 ? (
      <EnhancedEmptyState icon={ArrowDownToLine} entity="deposit" entityPlural="deposit data" />
    ) : (
      <div onClick={handleBarChartClick} style={{ cursor: 'pointer' }}><StatsBarChart data={depositCurrencyData} height={180} /></div>
    )
  );

  const renderWithdrawalVolumeChart = () => (
    loading ? <Skeleton className="h-48 w-full" /> : withdrawalCurrencyData.length === 0 ? (
      <EnhancedEmptyState icon={ArrowUpFromLine} entity="withdrawal" entityPlural="withdrawal data" />
    ) : (
      <div onClick={handleBarChartClick} style={{ cursor: 'pointer' }}><StatsBarChart data={withdrawalCurrencyData} height={180} /></div>
    )
  );

  return (
    <div className="space-y-6 relative">
      <AnimatePresence>{autoRefreshEnabled && <AutoRefreshBar progress={refreshProgress} />}</AnimatePresence>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><LayoutDashboard className="h-5 w-5 text-emerald-500" /></div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              {autoRefreshEnabled && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></div>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">Overview of your TOLS platform activity</p>
              <span className="text-muted-foreground/40">\u00b7</span>
              <p className="text-xs text-muted-foreground">Updated {lastRefresh ? formatAgo(lastRefreshAgo) : 'Pending...'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationPanel pendingWithdrawals={pendingWithdrawals} pendingDeposits={pendingDeposits} activeTournaments={activeTournaments.length} recentUsers={todayNewUsers} />
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)} title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}>
            {autoRefreshEnabled ? <><Pause className="h-3.5 w-3.5" /><span className="hidden sm:inline text-xs">Auto</span></> : <><Play className="h-3.5 w-3.5" /><span className="hidden sm:inline text-xs">Auto</span></>}
          </Button>
        </div>
      </div>

      {/* Welcome Banner */}
      <WelcomeBanner activeUsers={activeUsers} totalEarnings={totalEarnings} todayBets={bets.length} />

      {/* Live Data Ticker */}
      <LiveDataTicker entries={actionLog} />

      {/* Stat Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} numericValue={card.numericValue} decimals={card.decimals} counterPrefix={card.counterPrefix} counterSuffix={card.counterSuffix} sub={card.sub} color={card.color} loading={idx < 4 ? loading : (idx === 4 ? loading : (idx === 5 ? earningsQuery.isLoading : (idx === 6 ? jackpotsQuery.isLoading : tournamentsQuery.isLoading)))} onClick={navigateTo(card.page)} index={idx} isFlashing={isFlashing} />
        ))}
      </motion.div>

      {/* System Health + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SystemHealthPanel
            isConnected={isConnected} isChecking={isChecking} avgResponseMs={avgResponseMs}
            lastSyncAgo={lastRefreshAgo} activeConnections={activeConnections}
            lastCheckedTime={lastCheckedTime} totalRequests={totalRequests}
            onRefreshAll={handleRefreshAll} isRefreshing={isRefreshing}
          />
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-muted-foreground" />Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action, idx) => (
              <motion.div
                key={action.page}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.35, ease: 'easeOut' }}
              >
                <div
                  className="rounded-xl cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Card
                    className="relative overflow-hidden border border-border/30 bg-card/60 backdrop-blur-sm py-0 group hover:shadow-lg transition-shadow duration-300"
                    style={{ '--card-accent': action.accentColor } as React.CSSProperties}
                    onClick={() => setCurrentPage(action.page)}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300`} />
                    <CardContent className="relative z-10 py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex items-center justify-center h-9 w-9 rounded-xl ${action.iconBg} shadow-sm shrink-0`}>
                          <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold tracking-wide text-foreground mb-0.5">{action.label}</h3>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{action.description}</p>
                        </div>
                      </div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${action.accentColor}, ${action.accentColor}66)` }} />
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row - Daily Activity + Bet Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <EnhancedChartCard title="Daily Activity" description="Deposits, withdrawals, and bets over time" className="lg:col-span-8" dotColor="#22c55e" isPulsing={isFlashing} onMaximize={() => setMaximizedChart('daily-activity')} headerExtra={periodTabs}>
          {renderDailyActivityChart(280)}
        </EnhancedChartCard>
        <EnhancedChartCard title="Bet Results" description="Distribution of outcomes" className="lg:col-span-4" dotColor="var(--color-vip)" isPulsing={isFlashing} onMaximize={() => setMaximizedChart('bet-results')} headerExtra={periodTabs}>
          {renderBetResultsChart(280)}
        </EnhancedChartCard>
      </div>

      {/* Revenue & Currency Distribution Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <EnhancedChartCard title="Revenue by Currency" description="House earnings breakdown" dotColor="var(--color-pending)" isPulsing={isFlashing} onMaximize={() => setMaximizedChart('revenue-currency')} headerExtra={periodTabs}>
          {renderRevenueByCurrencyChart()}
        </EnhancedChartCard>
        <EnhancedChartCard title="Deposit Volume" description="By cryptocurrency" dotColor="#22c55e" isPulsing={isFlashing} onMaximize={() => setMaximizedChart('deposit-volume')} headerExtra={periodTabs}>
          {renderDepositVolumeChart()}
        </EnhancedChartCard>
        <EnhancedChartCard title="Withdrawal Volume" description="By cryptocurrency" dotColor="var(--color-pending)" isPulsing={isFlashing} onMaximize={() => setMaximizedChart('withdrawal-volume')} headerExtra={periodTabs}>
          {renderWithdrawalVolumeChart()}
        </EnhancedChartCard>
      </div>

      {/* Chart Maximize Dialogs */}
      <ChartMaximizeDialog open={maximizedChart === 'daily-activity'} onOpenChange={(open) => { if (!open) setMaximizedChart(null); }} title="Daily Activity" description="Deposits, withdrawals, and bets over time">
        <div className="pt-2">{renderDailyActivityChart(500, 'max-da')}</div>
      </ChartMaximizeDialog>
      <ChartMaximizeDialog open={maximizedChart === 'bet-results'} onOpenChange={(open) => { if (!open) setMaximizedChart(null); }} title="Bet Results" description="Distribution of outcomes">
        <div className="pt-2">{renderBetResultsChart(500)}</div>
      </ChartMaximizeDialog>
      <ChartMaximizeDialog open={maximizedChart === 'revenue-currency'} onOpenChange={(open) => { if (!open) setMaximizedChart(null); }} title="Revenue by Currency" description="House earnings breakdown">
        <div className="pt-2">{renderRevenueByCurrencyChart()}</div>
      </ChartMaximizeDialog>
      <ChartMaximizeDialog open={maximizedChart === 'deposit-volume'} onOpenChange={(open) => { if (!open) setMaximizedChart(null); }} title="Deposit Volume" description="By cryptocurrency">
        <div className="pt-2">{renderDepositVolumeChart()}</div>
      </ChartMaximizeDialog>
      <ChartMaximizeDialog open={maximizedChart === 'withdrawal-volume'} onOpenChange={(open) => { if (!open) setMaximizedChart(null); }} title="Withdrawal Volume" description="By cryptocurrency">
        <div className="pt-2">{renderWithdrawalVolumeChart()}</div>
      </ChartMaximizeDialog>

      {/* Top Entities Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Crown className="h-4 w-4 text-muted-foreground" />Top Entities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <TopEntitiesTable title="Top Users by Deposits" icon={DollarSign} data={topUsersDisplay} metricLabel={topUsersByDeposit.length > 0 ? 'deposit amount' : 'latest users'} loading={loading} />
          <TopEntitiesTable title="Top Games by Bets" icon={Gamepad2} data={topGamesByBets} metricLabel="bet count" loading={loading} />
          <TopEntitiesTable title="Top Tournaments by Prize" icon={Medal} data={topTournamentsByPrize} metricLabel="prize pool" loading={tournamentsQuery.isLoading} />
        </div>
      </div>

      {/* Recent Activity Row */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Recent Activity</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentActivityCard title="Recent Bets" loading={loading} viewAllPage="bets" onNavigate={navigateTo('bets')}>
            {recentBets.length === 0 ? (
              <EnhancedEmptyState icon={Dice5} entity="bet" entityPlural="bets" />
            ) : recentBets.map((bet) => (
              <ActivityItem key={bet.id} type="bet">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${bet.result === 'win' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : bet.result === 'loss' ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'}`}>
                  <Dice5 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bet.game_type}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(bet.created_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={bet.result} />
                  <p className="text-xs text-muted-foreground mt-0.5">{formatAmount(bet.bet_amount, bet.currency)}</p>
                </div>
              </ActivityItem>
            ))}
          </RecentActivityCard>

          <RecentActivityCard title="Recent Deposits" loading={loading} viewAllPage="deposits" onNavigate={navigateTo('deposits')}>
            {recentDeposits.length === 0 ? (
              <EnhancedEmptyState icon={ArrowDownToLine} entity="deposit" entityPlural="deposits" />
            ) : recentDeposits.map((dep) => (
              <ActivityItem key={dep.id} type="deposit">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-green-500/15 text-green-600 dark:text-green-400 shrink-0">
                  <ArrowDownToLine className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate font-mono">{dep.user_id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(dep.created_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <CurrencyBadge currency={dep.currency} />
                  <p className="text-xs text-muted-foreground mt-0.5">{formatAmount(dep.amount, dep.currency)}</p>
                </div>
              </ActivityItem>
            ))}
          </RecentActivityCard>

          <RecentActivityCard title="Recent Users" loading={loading} viewAllPage="users" onNavigate={navigateTo('users')}>
            {recentUsers.length === 0 ? (
              <EnhancedEmptyState icon={Users} entity="user" entityPlural="users" />
            ) : recentUsers.map((user) => (
              <ActivityItem key={user.id} type="user">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(user.created_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={user.status} />
                  <Badge variant="outline" className="text-xs mt-0.5 capitalize">{user.role}</Badge>
                </div>
              </ActivityItem>
            ))}
          </RecentActivityCard>
        </div>

        {/* Admin Activity Log */}
        <div className="mt-6">
          <ChartCardWrapper>
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" /></div>
                    Admin Activity Log
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Last {recentActionLog.length} actions</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {recentActionLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <ShieldAlert className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No admin actions recorded yet</p>
                    <p className="text-xs opacity-60">Actions will appear here as you navigate the platform</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                      {recentActionLog.map((entry) => {
                        const actionConfig: Record<string, { icon: React.ElementType; iconBg: string; iconColor: string; borderColor: string }> = {
                          create: { icon: Plus, iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400', borderColor: 'border-l-emerald-500' },
                          update: { icon: Pencil, iconBg: 'bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-l-amber-500' },
                          delete: { icon: Trash2, iconBg: 'bg-red-500/15', iconColor: 'text-red-600 dark:text-red-400', borderColor: 'border-l-red-500' },
                          view: { icon: Eye, iconBg: 'bg-sky-500/15', iconColor: 'text-sky-600 dark:text-sky-400', borderColor: 'border-l-sky-500' },
                          navigate: { icon: ArrowRight, iconBg: 'bg-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-400', borderColor: 'border-l-violet-500' },
                        };
                        const cfg = actionConfig[entry.action] || actionConfig.navigate;
                        const ActionIcon = cfg.icon;
                        return (
                          <motion.div key={entry.id} initial={{ opacity: 0, x: -12, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} exit={{ opacity: 0, x: 12, height: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors border-l-[3px] ${cfg.borderColor}`}>
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}><ActionIcon className={`h-3.5 w-3.5 ${cfg.iconColor}`} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{entry.entity}</p>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${entry.status === 'success' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-red-600 dark:text-red-400 border-red-500/30'}`}>{entry.action}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">{formatRelativeTime(entry.timestamp instanceof Date ? entry.timestamp.toISOString() : String(entry.timestamp))}</span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </ChartCardWrapper>
        </div>
      </div>

    </div>
  );
}
