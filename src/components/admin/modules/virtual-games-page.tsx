'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageDecoration } from '@/components/admin/shared/page-decoration';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gamepad2, Activity, Play, Copy, Save, Trash2, Link2, Plug } from 'lucide-react';
import { toast } from 'sonner';

interface EvCallback {
  action: string;
  method: 'POST';
  path: string;
  url: string;
}
interface EvConnection {
  id: string;
  name: string;
  apiBase: string;
  enabled: boolean;
  hasApiKey: boolean;
  hasAppKey: boolean;
  apiKeyHint: string | null;
  appKeyHint: string | null;
  lastStatus: 'untested' | 'connected' | 'error';
  lastLatencyMs: number | null;
  lastError: string | null;
}
interface EvConfig {
  env: { EV_API_BASE: boolean; EV_API_KEY: boolean; EV_APP_KEY: boolean };
}
interface EvConnectionPayload {
  connection: EvConnection | null;
  environment?: { live: boolean; apiBase: string };
  callbacks: { base: string; vendorGeneric: string; actions: EvCallback[] };
  encryptionConfigured: boolean;
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

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied')).catch(() => {});
}

function EurovirtualsConnectionCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: 'EuroVirtuals',
    apiBase: 'https://api.staging.betkraft.co.uk',
    apiKey: '',
    appKey: '',
    enabled: true,
  });

  const connectionQ = useQuery<{ success: boolean; data: EvConnectionPayload }>({
    queryKey: ['eurovirtuals-connection'],
    queryFn: async () => {
      const r = await fetch('/api/admin/virtual-games/connection', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load EuroVirtuals connection');
      return j;
    },
    retry: false,
  });

  const configQ = useQuery<{ success: boolean; data: EvConfig }>({
    queryKey: ['virtual-games-config'],
    queryFn: async () => {
      const r = await fetch('/api/admin/virtual-games/config');
      if (!r.ok) throw new Error('Failed to load config');
      return r.json();
    },
    refetchInterval: 30000,
  });

  const connection = connectionQ.data?.data.connection;
  useEffect(() => {
    if (!connection) return;
    const task = window.setTimeout(() => setForm((current) => ({
      ...current,
      name: connection.name,
      apiBase: connection.apiBase,
      apiKey: '',
      appKey: '',
      enabled: connection.enabled,
    })), 0);
    return () => window.clearTimeout(task);
  }, [connection]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/virtual-games/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save connection');
      return j;
    },
    onSuccess: () => { toast.success('EuroVirtuals connection saved'); qc.invalidateQueries({ queryKey: ['eurovirtuals-connection'] }); qc.invalidateQueries({ queryKey: ['virtual-games-config'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/virtual-games/connection/test', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Connection failed');
      return j;
    },
    onSuccess: () => { toast.success('EuroVirtuals catalogue reachable'); qc.invalidateQueries({ queryKey: ['eurovirtuals-connection'] }); qc.invalidateQueries({ queryKey: ['virtual-games-config'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/virtual-games/connection', { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not delete');
      return j;
    },
    onSuccess: () => { toast.success('Connection deleted'); qc.invalidateQueries({ queryKey: ['eurovirtuals-connection'] }); qc.invalidateQueries({ queryKey: ['virtual-games-config'] }); },
  });

  const cfg = configQ.data?.data;
  const callbacks = connectionQ.data?.data.callbacks;
  const encryptionOk = connectionQ.data?.data.encryptionConfigured !== false;

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50 lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4 text-teal-500" /> EuroVirtuals API connection</CardTitle>
            <CardDescription>Operator credentials + the callback URLs EuroVirtuals must POST to. Secrets stay encrypted server-side.</CardDescription>
          </div>
          {connection ? (
            <Badge className={connection.lastStatus === 'connected' ? 'bg-emerald-600' : connection.lastStatus === 'error' ? 'bg-red-600' : 'bg-amber-600'}>
              {connection.lastStatus}{connection.lastLatencyMs ? ` · ${connection.lastLatencyMs}ms` : ''}
            </Badge>
          ) : connectionQ.data?.data.environment?.live ? (
            <Badge className="bg-emerald-600">live via environment</Badge>
          ) : (
            <Badge variant="outline">not created</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!encryptionOk && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Configure <code>CONNECTION_ENCRYPTION_KEY</code> or <code>ADMIN_SESSION_SECRET</code> before saving credentials.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs"><span>Connection name</span><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="space-y-1 text-xs"><span>API base</span><Input value={form.apiBase} onChange={(e) => setForm({ ...form, apiBase: e.target.value })} placeholder="https://api.staging.betkraft.co.uk" className="font-mono" /></label>
          <label className="space-y-1 text-xs"><span>API key {connection?.apiKeyHint && <em className="text-muted-foreground">({connection.apiKeyHint} saved)</em>}</span><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={connection?.hasApiKey ? 'Leave blank to keep existing' : 'EuroVirtuals API key'} /></label>
          <label className="space-y-1 text-xs"><span>App key {connection?.appKeyHint && <em className="text-muted-foreground">({connection.appKeyHint} saved)</em>}</span><Input type="password" value={form.appKey} onChange={(e) => setForm({ ...form, appKey: e.target.value })} placeholder={connection?.hasAppKey ? 'Leave blank to keep existing' : 'EuroVirtuals app key'} /></label>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> use as the active EuroVirtuals backend</label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !encryptionOk}><Save className="mr-1 h-4 w-4" />{connection ? 'Update connection' : 'Create connection'}</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}><Link2 className="mr-1 h-4 w-4" />{test.isPending ? 'Testing…' : 'Test catalogue'}</Button>
          {connection && <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
        </div>
        {connection?.lastError && <p className="text-xs text-red-500">{connection.lastError}</p>}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seamless-wallet callbacks — give these to EuroVirtuals</p>
          <div className="space-y-1.5">
            {(callbacks?.actions ?? []).map((c) => (
              <div key={c.action} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                <div className="min-w-0">
                  <span className="mr-2 rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-400">{c.method}</span>
                  <span className="font-mono text-xs break-all">{c.url}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(c.url)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            {callbacks?.base && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                <div className="min-w-0">
                  <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/60">BASE</span>
                  <span className="font-mono text-xs break-all">{callbacks.base}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(callbacks.base)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        </div>

        {cfg && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { key: 'EV_API_BASE', present: cfg.env.EV_API_BASE },
              { key: 'EV_API_KEY', present: cfg.env.EV_API_KEY },
              { key: 'EV_APP_KEY', present: cfg.env.EV_APP_KEY },
            ]).map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <span className="font-mono text-xs">{row.key}</span>
                {row.present ? <Badge className="text-[10px]">env set</Badge> : <Badge variant="outline" className="text-[10px]">env empty</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

        <EurovirtualsConnectionCard />
        <TestLaunchCard />
        <RecentTransactionsCard />
      </div>
    </div>
  );
}
