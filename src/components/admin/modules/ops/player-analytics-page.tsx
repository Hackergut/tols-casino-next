'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Flame,
  Snowflake,
  Search,
  RefreshCw,
  RefreshCw as SyncIcon,
  Calculator,
  Eye,
  Mail,
  Calendar,
  Trophy,
  AlertTriangle,
  StickyNote,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

// ─── Types ───────────────────────────────────────────────────────────

type Segment = 'standard' | 'premium' | 'vip' | 'whale';
type RiskLevel = 'low' | 'normal' | 'high' | 'vip' | 'whale';
type StreakType = 'winning' | 'losing';

interface PlayerStats {
  totalPlayers: number;
  activeWinStreaks: number;
  activeLossStreaks: number;
  avgNetProfit: number;
  highestWinStreak: number;
  highestLossStreak: number;
  segmentCounts: Record<string, number>;
}

interface Player {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  segment: Segment;
  riskLevel: RiskLevel;
  totalDeposits: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  netProfit: number;
  lastLogin: string;
  notes?: string;
}

interface Session {
  id: string;
  date: string;
  game: string;
  result: 'win' | 'loss';
  amount: number;
  profit: number;
}

interface PlayersResponse {
  players: Player[];
  stats: PlayerStats;
}

// ─── Constants ───────────────────────────────────────────────────────

const SEGMENT_CONFIG: Record<Segment, { label: string; className: string }> = {
  standard: { label: 'Standard', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600' },
  premium: { label: 'Premium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
  vip: { label: 'VIP', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700' },
  whale: { label: 'Whale', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700' },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700' },
  normal: { label: 'Normal', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-300 dark:border-sky-700' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700' },
  vip: { label: 'VIP', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700' },
  whale: { label: 'Whale', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700' },
};

const SEGMENTS: Segment[] = ['standard', 'premium', 'vip', 'whale'];
const RISK_LEVELS: RiskLevel[] = ['low', 'normal', 'high', 'vip', 'whale'];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Never';
  }
}

function getInitials(username: string): string {
  return username
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function buildQueryParams(filters: {
  segment?: Segment | 'all';
  riskLevel?: RiskLevel | 'all';
  search?: string;
  streakType?: StreakType | 'all';
  streakMin?: number;
}): string {
  const params = new URLSearchParams();
  params.set('stats', 'true');
  if (filters.segment && filters.segment !== 'all') {
    params.set('segment', filters.segment);
  }
  if (filters.riskLevel && filters.riskLevel !== 'all') {
    params.set('riskLevel', filters.riskLevel);
  }
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters.streakType && filters.streakType !== 'all') {
    params.set('streakType', filters.streakType);
  }
  if (filters.streakMin && filters.streakMin > 0) {
    params.set('streakMin', String(filters.streakMin));
  }
  return params.toString();
}

// ─── Sub-Components ──────────────────────────────────────────────────

function SegmentBadge({ segment }: { segment: Segment }) {
  const config = SEGMENT_CONFIG[segment] ?? SEGMENT_CONFIG.standard;
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level] ?? RISK_CONFIG.normal;
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function StreakBar({ streak }: { streak: number }) {
  const isWinning = streak > 0;
  const isLosing = streak < 0;
  const magnitude = Math.min(Math.abs(streak), 10);
  const percent = (magnitude / 10) * 100;

  if (streak === 0) {
    return (
      <div className="flex items-center gap-1.5 min-w-[120px]">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-full bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <span className="text-xs text-muted-foreground w-6 text-right">0</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-[120px]">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
        {isWinning && (
          <div
            className="absolute inset-y-0 left-1/2 rounded-r-full transition-all duration-500 ease-out"
            style={{
              width: `${percent / 2}%`,
              background: 'linear-gradient(to right, hsl(142, 76%, 36%), hsl(142, 71%, 45%))',
            }}
          />
        )}
        {isLosing && (
          <div
            className="absolute inset-y-0 right-1/2 rounded-l-full transition-all duration-500 ease-out"
            style={{
              width: `${percent / 2}%`,
              background: 'linear-gradient(to left, hsl(0, 84%, 60%), hsl(0, 72%, 51%))',
            }}
          />
        )}
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      </div>
      <span
        className={`text-xs font-medium w-6 text-right ${
          isWinning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {streak > 0 ? `+${streak}` : streak}
      </span>
    </div>
  );
}

function NetProfitCell({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span
      className={`font-medium text-sm ${
        isPositive
          ? 'text-green-600 dark:text-green-400'
          : isNegative
            ? 'text-red-600 dark:text-red-400'
            : 'text-muted-foreground'
      }`}
    >
      {isPositive ? '+' : ''}{formatCurrency(value)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  iconColor: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-xl font-bold tracking-tight">{value}</p>
            )}
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconColor}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StreakTimeline({ sessions }: { sessions: Session[] }) {
  const reversed = [...sessions].reverse().slice(-20);
  if (reversed.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
        No session data
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[3px] h-16">
        {reversed.map((s, i) => {
          const isWin = s.result === 'win';
          const height = Math.max(16, Math.min(64, Math.abs(s.profit) / 5 + 16));
          return (
            <div
              key={s.id ?? i}
              className="flex-1 min-w-0 relative group"
            >
              <div
                className={`w-full rounded-sm transition-all duration-300 ${
                  isWin
                    ? 'bg-green-500/80 hover:bg-green-500'
                    : 'bg-red-500/80 hover:bg-red-500'
                }`}
                style={{ height: `${height}px` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-popover border rounded px-2 py-1 shadow-md text-[11px] whitespace-nowrap">
                <div className="font-medium">{s.game}</div>
                <div className={isWin ? 'text-green-600' : 'text-red-600'}>
                  {isWin ? '+' : ''}{formatCurrency(s.profit)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Oldest</span>
        <span>Newest</span>
      </div>
    </div>
  );
}

// ─── Player Detail Dialog ────────────────────────────────────────────

function PlayerDetailDialog({
  player,
  open,
  onOpenChange,
}: {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedSegment, setSelectedSegment] = useState<Segment | ''>('');
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | ''>('');
  const [notes, setNotes] = useState('');
  React.useEffect(() => {
    if (player && open) {
      setSelectedSegment(player.segment);
      setSelectedRisk(player.riskLevel);
      setNotes(player.notes ?? '');
    }
  }, [player, open]);

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{
    sessions: Session[];
  }>({
    queryKey: ['ops-sessions', player?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/ops/sessions?playerId=${player!.id}&limit=20`
      );
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    enabled: !!player?.id && open,
  });

  const sessions = sessionsData?.sessions ?? [];

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Player>) => {
      const res = await fetch('/api/ops/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: player!.id, ...data }),
      });
      if (!res.ok) throw new Error('Failed to update player');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Player updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ops-players'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/ops/sessions?action=recalc&id=${player!.id}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to recalculate streaks');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Streaks recalculated successfully');
      queryClient.invalidateQueries({ queryKey: ['ops-players'] });
      queryClient.invalidateQueries({ queryKey: ['ops-sessions', player?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSaveNotes = () => {
 updateMutation.mutate({ notes });
  };

  const handleChangeSegment = () => {
    if (selectedSegment && selectedSegment !== player?.segment) {
      updateMutation.mutate({ segment: selectedSegment });
    }
  };

  const handleChangeRisk = () => {
    if (selectedRisk && selectedRisk !== player?.riskLevel) {
      updateMutation.mutate({ riskLevel: selectedRisk });
    }
  };

  if (!player) return null;

  const segConfig = SEGMENT_CONFIG[player.segment];
  const riskConfig = RISK_CONFIG[player.riskLevel];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={player.avatar} alt={player.username} />
                <AvatarFallback className="text-sm font-semibold">
                  {getInitials(player.username)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>{player.username}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${segConfig.className}`}>
                    {segConfig.label}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskConfig.className}`}>
                    {riskConfig.label}
                  </Badge>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Player detail view for {player.username}
            </DialogDescription>
          </DialogHeader>

          {/* Profile Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </span>
              <p className="font-medium truncate">{player.email}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Total Deposits
              </span>
              <p className="font-medium">{formatCurrency(player.totalDeposits)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Wins / Losses
              </span>
              <p className="font-medium">
                <span className="text-green-600 dark:text-green-400">{player.totalWins}</span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">{player.totalLosses}</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3" /> Current Streak
              </span>
              <StreakBar streak={player.currentStreak} />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Net Profit
              </span>
              <NetProfitCell value={player.netProfit} />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Last Login
              </span>
              <p className="font-medium">{formatDate(player.lastLogin)}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Streak Timeline */}
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Streak Timeline
            </h3>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => recalcMutation.mutate()}
              disabled={recalcMutation.isPending}
            >
              {recalcMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Calculator className="h-3 w-3" />
              )}
              Recalc Streaks
            </Button>
          </div>
          {sessionsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <StreakTimeline sessions={sessions} />
          )}
        </div>

        <Separator />

        {/* Recent Sessions */}
        <div className="px-6 py-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Recent Sessions
          </h3>
          <ScrollArea className="max-h-64">
            {sessionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                No sessions found
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.slice(0, 20).map((s, i) => {
                  const isWin = s.result === 'win';
                  return (
                    <div
                      key={s.id ?? i}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center ${
                            isWin
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                          }`}
                        >
                          {isWin ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{s.game}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(s.date)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          isWin
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isWin ? '+' : ''}{formatCurrency(s.profit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="p-6 pt-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Change Segment */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Segment</Label>
              <div className="flex gap-1.5">
                <Select
                  value={selectedSegment}
                  onValueChange={(v) => setSelectedSegment(v as Segment)}
                >
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEGMENT_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={handleChangeSegment}
                  disabled={updateMutation.isPending || selectedSegment === player.segment}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Change Risk Level */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Risk Level</Label>
              <div className="flex gap-1.5">
                <Select
                  value={selectedRisk}
                  onValueChange={(v) => setSelectedRisk(v as RiskLevel)}
                >
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue placeholder="Select risk" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {RISK_CONFIG[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={handleChangeRisk}
                  disabled={updateMutation.isPending || selectedRisk === player.riskLevel}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Add notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNotes();
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                >
                  <StickyNote className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sync Player Dialog ──────────────────────────────────────────────

function SyncPlayerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      });
      if (!res.ok) throw new Error('Failed to sync player');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Player synced successfully');
      queryClient.invalidateQueries({ queryKey: ['ops-players'] });
      setUsername('');
      setEmail('');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SyncIcon className="h-5 w-5" />
            Sync Player
          </DialogTitle>
          <DialogDescription>
            Create or update a player profile by providing their username and email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              placeholder="Enter email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !username.trim()}
          >
            {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sync Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function PlayerAnalyticsPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'all'>('all');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [streakTypeFilter, setStreakTypeFilter] = useState<StreakType | 'all'>('all');
  const [streakMin, setStreakMin] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialog state
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  // Build query string
  const queryString = useMemo(
    () =>
      buildQueryParams({
        segment: segmentFilter,
        riskLevel: riskFilter,
        search,
        streakType: streakTypeFilter,
        streakMin: streakMin ? parseInt(streakMin, 10) : undefined,
      }),
    [segmentFilter, riskFilter, search, streakTypeFilter, streakMin]
  );

  // Fetch players
  const {
    data: playersData,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery<PlayersResponse>({
    queryKey: ['ops-players', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/ops/players?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch players');
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const players = playersData?.players ?? [];
  const stats = playersData?.stats;

  // Search debounce handler
  const handleSearch = useCallback(() => {
    setSearch(searchInput);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  // Recalc all streaks mutation (for individual player from table)
  const recalcAllMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await fetch(`/api/ops/sessions?action=recalc&id=${playerId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to recalculate streaks');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Streaks recalculated');
      queryClient.invalidateQueries({ queryKey: ['ops-players'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const segmentCounts = stats?.segmentCounts ?? {};

  return (
    <div className="relative">
      <PageDecoration variant="amber" />
      <div className="relative z-10 space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Player Analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitor player segments, streaks, risk levels, and session performance
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={Users}
            label="Total Players"
            value={stats ? String(stats.totalPlayers) : '—'}
            iconColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            isLoading={isLoading}
          />
          <StatCard
            icon={TrendingUp}
            label="Win Streaks"
            value={stats ? String(stats.activeWinStreaks) : '—'}
            subValue="Active"
            iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            isLoading={isLoading}
          />
          <StatCard
            icon={TrendingDown}
            label="Loss Streaks"
            value={stats ? String(stats.activeLossStreaks) : '—'}
            subValue="Active"
            iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
            isLoading={isLoading}
          />
          <StatCard
            icon={DollarSign}
            label="Avg Net Profit"
            value={stats ? formatCurrency(stats.avgNetProfit) : '—'}
            iconColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            isLoading={isLoading}
          />
          <StatCard
            icon={Flame}
            label="Highest Win Streak"
            value={stats ? String(stats.highestWinStreak) : '—'}
            iconColor="bg-orange-500/10 text-orange-600 dark:text-orange-400"
            isLoading={isLoading}
          />
          <StatCard
            icon={Snowflake}
            label="Highest Loss Streak"
            value={stats ? String(stats.highestLossStreak) : '—'}
            iconColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            isLoading={isLoading}
          />
        </div>

        {/* Filters Row */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Segment Tabs */}
            <Tabs
              value={segmentFilter}
              onValueChange={(v) => setSegmentFilter(v as Segment | 'all')}
            >
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-6">
                  All
                  {stats && (
                    <span className="ml-1.5 text-[10px] opacity-60">
                      {stats.totalPlayers}
                    </span>
                  )}
                </TabsTrigger>
                {SEGMENTS.map((s) => (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="text-xs px-3 h-6"
                  >
                    {SEGMENT_CONFIG[s].label}
                    {(segmentCounts[s] ?? 0) > 0 && (
                      <span className="ml-1.5 text-[10px] opacity-60">
                        {segmentCounts[s]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Secondary Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search username or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {/* Risk Level Filter */}
              <Select
                value={riskFilter}
                onValueChange={(v) => setRiskFilter(v as RiskLevel | 'all')}
              >
                <SelectTrigger size="sm" className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RISK_CONFIG[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Streak Type Filter */}
              <Select
                value={streakTypeFilter}
                onValueChange={(v) => setStreakTypeFilter(v as StreakType | 'all')}
              >
                <SelectTrigger size="sm" className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Streak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streaks</SelectItem>
                  <SelectItem value="winning">Winning Only</SelectItem>
                  <SelectItem value="losing">Losing Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Min Streak Input */}
              <Input
                type="number"
                placeholder="Min streak"
                value={streakMin}
                onChange={(e) => setStreakMin(e.target.value)}
                className="h-8 w-[100px] text-sm"
                min={1}
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleSearch}
                >
                  <Search className="h-3 w-3" />
                  Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    setSegmentFilter('all');
                    setRiskFilter('all');
                    setStreakTypeFilter('all');
                    setStreakMin('');
                    setSearch('');
                    setSearchInput('');
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setSyncOpen(true)}
                >
                  <SyncIcon className="h-3 w-3" />
                  Sync Player
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Player Table */}
        <Card>
          <CardContent className="p-0">
            {isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                <p className="text-sm font-medium text-destructive">
                  Failed to load players
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(error as Error)?.message ?? 'Unknown error'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 text-xs"
                  onClick={() =>
                    queryClient.invalidateQueries({ queryKey: ['ops-players'] })
                  }
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] min-w-[160px]">
                        Player
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Email
                      </TableHead>
                      <TableHead className="w-[90px]">Segment</TableHead>
                      <TableHead className="w-[90px]">Risk</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">
                        Deposits
                      </TableHead>
                      <TableHead className="text-right hidden lg:table-cell">
                        W / L
                      </TableHead>
                      <TableHead className="w-[160px]">Streak</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="hidden sm:table-cell w-[100px]">
                        Last Login
                      </TableHead>
                      <TableHead className="w-[80px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && !players.length ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : players.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="h-40 text-center"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                              No players found
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              Try adjusting your filters
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      players.map((player) => (
                        <TableRow
                          key={player.id}
                          className="group cursor-pointer transition-colors"
                          onClick={() => setDetailPlayer(player)}
                        >
                          {/* Avatar + Username */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={player.avatar}
                                  alt={player.username}
                                />
                                <AvatarFallback className="text-xs font-semibold">
                                  {getInitials(player.username)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm truncate max-w-[140px]">
                                {player.username}
                              </span>
                            </div>
                          </TableCell>

                          {/* Email */}
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground truncate block max-w-[180px]">
                              {player.email}
                            </span>
                          </TableCell>

                          {/* Segment */}
                          <TableCell>
                            <SegmentBadge segment={player.segment} />
                          </TableCell>

                          {/* Risk Level */}
                          <TableCell>
                            <RiskBadge level={player.riskLevel} />
                          </TableCell>

                          {/* Total Deposits */}
                          <TableCell className="text-right hidden lg:table-cell">
                            <span className="text-sm">
                              {formatCurrency(player.totalDeposits)}
                            </span>
                          </TableCell>

                          {/* Wins / Losses */}
                          <TableCell className="text-right hidden lg:table-cell">
                            <span className="text-sm">
                              <span className="text-green-600 dark:text-green-400">
                                {player.totalWins}
                              </span>
                              {' / '}
                              <span className="text-red-600 dark:text-red-400">
                                {player.totalLosses}
                              </span>
                            </span>
                          </TableCell>

                          {/* Current Streak */}
                          <TableCell>
                            <StreakBar streak={player.currentStreak} />
                          </TableCell>

                          {/* Net Profit */}
                          <TableCell className="text-right">
                            <NetProfitCell value={player.netProfit} />
                          </TableCell>

                          {/* Last Login */}
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeDate(player.lastLogin)}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div
                              className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDetailPlayer(player)}
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  recalcAllMutation.mutate(player.id)
                                }
                                disabled={recalcAllMutation.isPending}
                                title="Recalculate streaks"
                              >
                                {recalcAllMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Calculator className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {/* Table Footer / Loading indicator */}
            {!isError && players.length > 0 && (
              <div className="border-t px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{players.length} player{players.length !== 1 ? 's' : ''}</span>
                {isFetching && (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Refreshing...
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <PlayerDetailDialog
        player={detailPlayer}
        open={!!detailPlayer}
        onOpenChange={(open) => !open && setDetailPlayer(null)}
      />
      <SyncPlayerDialog open={syncOpen} onOpenChange={setSyncOpen} />
    </div>
  );
}
