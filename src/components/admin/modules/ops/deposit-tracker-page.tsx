'use client';

import React, { useState, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Bitcoin,
  Building,
  Star,
  Filter,
  Plus,
  RefreshCw,
  Users,
  Trash2,
  Search,
  Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

type DepositStatus = 'pending' | 'completed' | 'failed' | 'refunded';
type DepositMethod = 'crypto' | 'card' | 'bank_transfer';

type Currency = 'USD' | 'EUR' | 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'SOL';

interface Deposit {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  currency: Currency;
  method: DepositMethod;
  status: DepositStatus;
  isFirst: boolean;
  depositNumber: number;
  daysSinceReg: number;
  triggeredBy: string;
  txHash?: string;
  notes?: string;
  createdAt: string;
}

interface DepositAnalytics {
  totalDeposits: number;
  totalAmount: number;
  averageDeposit: number;
  firstDepositConversionRate: number;
  recurringDepositRate: number;
  topDepositor: { name: string; amount: number } | null;
  dailyTrends: { date: string; amount: number; count: number }[];
  topDepositors: { name: string; playerId: string; totalAmount: number; depositCount: number }[];
  methodBreakdown: { method: DepositMethod; count: number; totalAmount: number }[];
}

interface DepositListResponse {
  data: Deposit[];
  total: number;
}

interface CreateDepositPayload {
  playerId: string;
  amount: number;
  currency: Currency;
  method: DepositMethod;
  status: DepositStatus;
  txHash?: string;
  notes?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const STATUS_CONFIG: Record<
  DepositStatus,
  { label: string; className: string }
> = {
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25',
  },
};

const METHOD_CONFIG: Record<
  DepositMethod,
  { label: string; icon: React.ElementType; className: string }
> = {
  crypto: {
    label: 'Crypto',
    icon: Bitcoin,
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
  },
  card: {
    label: 'Card',
    icon: CreditCard,
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    icon: Building,
    className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/25',
  },
};

const CURRENCIES: Currency[] = ['USD', 'EUR', 'BTC', 'ETH', 'USDT', 'USDC', 'SOL'];

const METHODS: DepositMethod[] = ['crypto', 'card', 'bank_transfer'];
const STATUSES: DepositStatus[] = ['pending', 'completed', 'failed', 'refunded'];

const PAGE_SIZE = 20;

// ============================================================
// HELPERS
// ============================================================

function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  if (['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].includes(currency)) {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: DepositStatus) {
  const config = STATUS_CONFIG[status];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

function getMethodBadge(method: DepositMethod) {
  const config = METHOD_CONFIG[method];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function DepositTrackerPage() {
  const queryClient = useQueryClient();

  // --- Filter State ---
  const [playerIdFilter, setPlayerIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [isFirstOnly, setIsFirstOnly] = useState(false);
  const [page, setPage] = useState(0);

  // --- Dialog State ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateDepositPayload>({
    playerId: '',
    amount: 0,
    currency: 'USD',
    method: 'crypto',
    status: 'pending',
    txHash: '',
    notes: '',
  });

  // --- Queries ---
  const depositsQuery = useQuery<DepositListResponse>({
    queryKey: ['ops-deposits', playerIdFilter, statusFilter, methodFilter, isFirstOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (playerIdFilter) params.set('playerId', playerIdFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (methodFilter !== 'all') params.set('method', methodFilter);
      if (isFirstOnly) params.set('isFirst', 'true');
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await fetch(`/api/ops/deposits?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch deposits' }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const analyticsQuery = useQuery<DepositAnalytics>({
    queryKey: ['ops-deposit-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/ops/deposits?action=analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load analytics' }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  // --- Mutations ---
  const createMutation = useMutation<unknown, Error, CreateDepositPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/ops/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create deposit' }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Deposit recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['ops-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['ops-deposit-analytics'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/ops/deposits?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete deposit' }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Deposit deleted');
      queryClient.invalidateQueries({ queryKey: ['ops-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['ops-deposit-analytics'] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const refreshAnalytics = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ops-deposit-analytics'] });
    toast.success('Analytics refreshed');
  }, [queryClient]);

  // --- Form handlers ---
  const resetForm = useCallback(() => {
    setFormData({
      playerId: '',
      amount: 0,
      currency: 'USD',
      method: 'crypto',
      status: 'pending',
      txHash: '',
      notes: '',
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!formData.playerId.trim()) {
      toast.error('Player ID is required');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    createMutation.mutate(formData);
  }, [formData, createMutation]);

  // --- Computed values ---
  const deposits = depositsQuery.data?.data ?? [];
  const totalDeposits = depositsQuery.data?.total ?? 0;
  const analytics = analyticsQuery.data;
  const isLoading = depositsQuery.isLoading || analyticsQuery.isLoading;
  const isEmpty = !isLoading && deposits.length === 0 && !playerIdFilter && statusFilter === 'all' && methodFilter === 'all' && !isFirstOnly;

  const dailyTrendsRaw = analytics?.dailyTrends;
  const dailyTrends = dailyTrendsRaw && dailyTrendsRaw.length > 0
    ? (() => {
        const maxAmount = Math.max(...dailyTrendsRaw.map((d) => d.amount), 1);
        return dailyTrendsRaw.map((d) => ({ ...d, pct: (d.amount / maxAmount) * 100 }));
      })()
    : [];

  const methodBreakdownRaw = analytics?.methodBreakdown;
  const methodBreakdown = methodBreakdownRaw && methodBreakdownRaw.length > 0
    ? (() => {
        const maxCount = Math.max(...methodBreakdownRaw.map((m) => m.count), 1);
        return methodBreakdownRaw.map((m) => ({ ...m, pct: (m.count / maxCount) * 100 }));
      })()
    : [];

  const topDepositors = analytics?.topDepositors ?? [];
  const maxDepositorAmount = topDepositors.length === 0
    ? 1
    : Math.max(...topDepositors.map((d) => d.totalAmount), 1);

  const totalPages = Math.ceil(totalDeposits / PAGE_SIZE);

  const activeFilterCount = [playerIdFilter, statusFilter !== 'all', methodFilter !== 'all', isFirstOnly].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setPlayerIdFilter('');
    setStatusFilter('all');
    setMethodFilter('all');
    setIsFirstOnly(false);
    setPage(0);
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deposit Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Monitor and manage player deposits, analytics, and conversion metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAnalytics}
            disabled={analyticsQuery.isFetching}
          >
            <RefreshCw className={`size-4 ${analyticsQuery.isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Analytics</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                Record Deposit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Deposit</DialogTitle>
                <DialogDescription>
                  Manually create a deposit event for a player.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="playerId">Player ID *</Label>
                  <Input
                    id="playerId"
                    placeholder="e.g. player_abc123"
                    value={formData.playerId}
                    onChange={(e) => setFormData((p) => ({ ...p, playerId: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(v) => setFormData((p) => ({ ...p, currency: v as Currency }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="method">Method</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(v) => setFormData((p) => ({ ...p, method: v as DepositMethod }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => {
                          const cfg = METHOD_CONFIG[m];
                          return (
                            <SelectItem key={m} value={m}>
                              <span className="flex items-center gap-1.5">
                                <cfg.icon className="size-3.5" />
                                {cfg.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData((p) => ({ ...p, status: v as DepositStatus }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="txHash">Tx Hash</Label>
                  <Input
                    id="txHash"
                    placeholder="Transaction hash (optional)"
                    value={formData.txHash}
                    onChange={(e) => setFormData((p) => ({ ...p, txHash: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional notes about this deposit"
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Deposit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ---- Analytics Cards ---- */}
      {isLoading && !analytics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Deposits</CardDescription>
              <DollarSign className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(analytics?.totalDeposits ?? 0).toLocaleString()}</div>
              <p className="text-muted-foreground mt-1 text-xs">All-time deposit count</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Amount</CardDescription>
              <TrendingUp className="text-emerald-600 size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(analytics?.totalAmount ?? 0)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">Cumulative deposit volume</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Average Deposit</CardDescription>
              <CreditCard className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(analytics?.averageDeposit ?? 0)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">Per-transaction average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Top Depositor</CardDescription>
              <Star className="text-amber-500 size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {analytics?.topDepositor?.name ?? 'N/A'}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {analytics?.topDepositor
                  ? formatCurrency(analytics.topDepositor.amount)
                  : 'No deposits yet'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Conversion Rates ---- */}
      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">First Deposit Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Conversion</span>
                <span className="font-semibold">
                  {(analytics.firstDepositConversionRate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={analytics.firstDepositConversionRate * 100} className="h-2.5" />
              <p className="text-muted-foreground text-xs">
                Percentage of registered players who made at least one deposit.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Recurring Deposit Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recurring</span>
                <span className="font-semibold">
                  {(analytics.recurringDepositRate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={analytics.recurringDepositRate * 100} className="h-2.5" />
              <p className="text-muted-foreground text-xs">
                Percentage of first-time depositors who returned for additional deposits.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Tabs: Overview / Table ---- */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="table">All Deposits</TabsTrigger>
          <TabsTrigger value="depositor">Top Depositors</TabsTrigger>
        </TabsList>

        {/* ============ OVERVIEW TAB ============ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Daily Trends Bar Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Deposit Trends (Last 7 Days)</CardTitle>
                  <TrendingUp className="text-muted-foreground size-4" />
                </div>
              </CardHeader>
              <CardContent>
                {analyticsQuery.isLoading ? (
                  <div className="flex items-end gap-3 h-48">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <Skeleton className="w-full h-32" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    ))}
                  </div>
                ) : dailyTrends.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                    No trend data available.
                  </div>
                ) : (
                  <div className="flex items-end gap-2 sm:gap-3 h-48">
                    {dailyTrends.map((day) => (
                      <div
                        key={day.date}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <span className="text-xs font-medium text-foreground">
                          {formatCurrency(day.amount)}
                        </span>
                        <div
                          className="w-full rounded-t-md bg-primary/20 min-h-[4px] transition-all duration-300 relative overflow-hidden"
                          style={{ height: `${Math.max(day.pct, 4)}%` }}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 bg-primary rounded-t-md transition-all duration-300"
                            style={{ height: '100%' }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs truncate max-w-full">
                          {getDayLabel(day.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Method Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Deposits by Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-10" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))
                ) : methodBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No method data.</p>
                ) : (
                  methodBreakdown.map((m) => {
                    const cfg = METHOD_CONFIG[m.method];
                    const Icon = cfg.icon;
                    return (
                      <div key={m.method} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Icon className="size-3.5" />
                            {cfg.label}
                          </span>
                          <span className="font-medium">{m.count}</span>
                        </div>
                        <div className="bg-primary/20 h-2 w-full rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${m.pct}%` }}
                          />
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {formatCurrency(m.totalAmount)} total
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ ALL DEPOSITS TAB ============ */}
        <TabsContent value="table" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="flex-1 min-w-0">
                  <Label className="mb-1.5 text-xs text-muted-foreground">Player ID</Label>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      placeholder="Search by player ID..."
                      value={playerIdFilter}
                      onChange={(e) => { setPlayerIdFilter(e.target.value); setPage(0); }}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-36">
                  <Label className="mb-1.5 text-xs text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-40">
                  <Label className="mb-1.5 text-xs text-muted-foreground">Method</Label>
                  <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      {METHODS.map((m) => {
                        const cfg = METHOD_CONFIG[m];
                        return (
                          <SelectItem key={m} value={m}>
                            <span className="flex items-center gap-1.5">
                              <cfg.icon className="size-3.5" />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <Switch
                    id="first-deposit-toggle"
                    checked={isFirstOnly}
                    onCheckedChange={(v) => { setIsFirstOnly(v); setPage(0); }}
                  />
                  <Label htmlFor="first-deposit-toggle" className="text-sm cursor-pointer select-none">
                    First deposit only
                  </Label>
                </div>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <Filter className="size-3.5" />
                    Clear ({activeFilterCount})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Empty State */}
          {isEmpty ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="bg-muted flex items-center justify-center rounded-full size-16 mb-4">
                  <Inbox className="text-muted-foreground size-8" />
                </div>
                <h3 className="font-semibold">No Deposits Recorded</h3>
                <p className="text-muted-foreground mt-1 text-sm text-center max-w-sm">
                  There are no deposit records yet. Click &quot;Record Deposit&quot; to manually create the first entry.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="size-4" />
                  Record Deposit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">First</TableHead>
                        <TableHead className="text-center">#</TableHead>
                        <TableHead className="text-center">Days Since Reg</TableHead>
                        <TableHead>Triggered By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositsQuery.isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 11 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-16" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : deposits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="h-32 text-center">
                            <p className="text-muted-foreground text-sm">No deposits match the current filters.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        deposits.map((deposit) => (
                          <TableRow key={deposit.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm">{deposit.playerId}</span>
                                {deposit.playerName && (
                                  <span className="text-muted-foreground text-xs">{deposit.playerName}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono font-semibold">
                              {formatCurrency(deposit.amount, deposit.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs font-mono">
                                {deposit.currency}
                              </Badge>
                            </TableCell>
                            <TableCell>{getMethodBadge(deposit.method)}</TableCell>
                            <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                            <TableCell className="text-center">
                              {deposit.isFirst ? (
                                <Star className="text-amber-500 fill-amber-500 inline-block size-4" />
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-sm">
                              {deposit.depositNumber}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-sm">
                              {deposit.daysSinceReg}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {deposit.triggeredBy || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {formatDate(deposit.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMutation.mutate(deposit.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="size-3.5" />
                                <span className="sr-only">Delete deposit</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-muted-foreground text-sm">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalDeposits)} of {totalDeposits}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (page < 3) {
                          pageNum = i;
                        } else if (page > totalPages - 4) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum + 1}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TOP DEPOSITORS TAB ============ */}
        <TabsContent value="depositor" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Top 10 Depositors</CardTitle>
                  <CardDescription>
                    Ranked by total deposit amount across all time.
                  </CardDescription>
                </div>
                <Users className="text-muted-foreground size-4" />
              </div>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : topDepositors.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="text-muted-foreground mx-auto mb-2 size-10" />
                  <p className="text-muted-foreground text-sm">No depositor data available.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {topDepositors.map((depositor, index) => (
                      <div
                        key={depositor.playerId}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : index === 1
                                ? 'bg-gray-400/15 text-gray-500 dark:text-gray-400'
                                : index === 2
                                  ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm font-medium">{depositor.name}</span>
                            <span className="ml-2 shrink-0 font-semibold text-sm">
                              {formatCurrency(depositor.totalAmount)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="bg-primary/20 h-1.5 flex-1 rounded-full overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${(depositor.totalAmount / maxDepositorAmount) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {depositor.depositCount} deposit{depositor.depositCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}