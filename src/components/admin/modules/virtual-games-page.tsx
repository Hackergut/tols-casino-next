'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageDecoration } from '@/components/admin/shared/page-decoration';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gamepad2, Activity, CheckCircle2, XCircle, Play, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface EvConfig {
  service: string;
  status: 'ok' | 'not_configured';
  configured: boolean;
  env: { EV_API_BASE: boolean; EV_API_KEY: boolean; EV_APP_KEY: boolean };
  callbacks: string[];
}

interface VendorTxnRow {
  id: string;
  vendor: string;
  externalTxId: string;
  roundId: string | null;
  userId: string;
  type: 'bet' | 'win' | 'rollback';
  amount: number;
  currency: string;
  status: string;
  balanceAfter: number;
  createdAt: string;
}

const typeBadge: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  bet: 'destructive',
  win: 'default',
  rollback: 'secondary',
};

function ConfigHealthCard() {
  const { data, isLoading } = useQuery<{ success: boolean; data: EvConfig }>({
    queryKey: ['virtual-games-config'],
    queryFn: async () => {
      const r = await fetch('/api/admin/virtual-games/config');
      if (!r.ok) throw new Error('Failed to load config');
      return r.json();
    },
    refetchInterval: 30000,
  });

  const cfg = data?.data;
  const envRows = cfg
    ? [
        { key: 'EV_API_BASE', present: cfg.env.EV_API_BASE },
        { key: 'EV_API_KEY', present: cfg.env.EV_API_KEY },
        { key: 'EV_APP_KEY', present: cfg.env.EV_APP_KEY },
      ]
    : [];

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Config Health</CardTitle>
        </div>
        <CardDescription>EuroVirtuals provider environment & callbacks. Values are never exposed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !cfg ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Tile label="Service" value={cfg.service} icon={<Activity className="h-4 w-4" />} />
              <Tile
                label="Status"
                value={cfg.status}
                icon={cfg.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              />
              <Tile
                label="Configured"
                value={cfg.configured ? 'Yes' : 'No'}
                icon={cfg.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Environment</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {envRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <span className="font-mono text-xs">{row.key}</span>
                    {row.present ? (
                      <Badge variant="default" className="text-[10px]">set</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">missing</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Callbacks</p>
              <div className="flex flex-wrap gap-1.5">
                {cfg.callbacks.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

function TestLaunchCard() {
  const [gameUuid, setGameUuid] = useState('vhelp-test');
  const [currency, setCurrency] = useState('USD');
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/eurovirtuals/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_uuid: gameUuid, currency, demo: demo ? 1 : 0, device: 'web' }),
      });
      const j = await r.json();
      if (j?.success && j?.data?.url) {
        setResult({ url: j.data.url });
        toast.success('Launch URL minted');
      } else {
        const msg = j?.error || 'Launch failed';
        setResult({ error: msg });
        toast.error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Test Launch</CardTitle>
        </div>
        <CardDescription>Mint a launch URL for an arbitrary game UUID. Useful for onboarding tests.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
          <Input
            value={gameUuid}
            onChange={(e) => setGameUuid(e.target.value)}
            placeholder="e.g. vhelp-test"
            className="font-mono text-sm"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="USDT">USDT</option>
          </select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Demo
          </label>
        </div>
        <Button onClick={run} disabled={loading || !gameUuid.trim()} className="w-full sm:w-auto">
          {loading ? 'Launching…' : 'Launch test'}
        </Button>
        {result?.url && (
          <pre className="rounded-md border border-border/60 bg-background/60 p-3 text-[11px] font-mono break-all whitespace-pre-wrap">
            {result.url}
          </pre>
        )}
        {result?.error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {result.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTransactionsCard() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: VendorTxnRow[] }>({
    queryKey: ['virtual-games-recent'],
    queryFn: async () => {
      const r = await fetch('/api/admin/virtual-games/recent');
      if (!r.ok) throw new Error('Failed to load transactions');
      return r.json();
    },
    refetchInterval: 15000,
  });

  const rows = data?.data ?? [];

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <CardDescription>Last 50 EuroVirtuals seamless-wallet entries (auto-refresh every 15s).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No virtual-game transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>External TX</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.userId.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant={typeBadge[r.type] || 'outline'} className="text-[10px] capitalize">
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {r.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">{r.currency}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {r.balanceAfter.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.roundId ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{r.externalTxId.slice(0, 12)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VirtualGamesPage() {
  return (
    <div className="relative">
      <PageDecoration variant="teal" />
      <div className="relative z-10 space-y-6">
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Gamepad2 className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Virtual Games</h1>
              <p className="text-sm text-muted-foreground">
                EuroVirtuals integration · config · transactions · test launch
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConfigHealthCard />
          <TestLaunchCard />
        </div>

        <RecentTransactionsCard />
      </div>
    </div>
  );
}
