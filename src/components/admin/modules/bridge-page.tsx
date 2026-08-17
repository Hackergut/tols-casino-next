'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Link2, CheckCircle2, XCircle, Clock, Shield, Server, Globe, ArrowLeftRight, Copy, Send, Database, KeyRound, Save, Trash2, Unplug } from 'lucide-react';

interface BridgeHealth {
  ok: boolean;
  service: string;
  timestamp: string;
  casino: { origin: string };
  tower: { origin: string; apiBase: string; reachable: boolean | null; status?: number; latencyMs?: number; error?: string };
  bridge: { configured: boolean; hasTowerKeys: boolean; hasDb: boolean; envPresent: Record<string, boolean> };
  db: { ok: boolean; latencyMs?: number; error?: string };
}

interface GovernanceConnection {
  id: string;
  name: string;
  towerOrigin: string;
  towerApiBase: string;
  casinoOrigin: string;
  healthPath: string;
  webhookPath: string;
  enabled: boolean;
  hasBridgeSecret: boolean;
  hasApiKey: boolean;
  hasAppKey: boolean;
  apiKeyHint: string | null;
  appKeyHint: string | null;
  lastTestedAt: string | null;
  lastStatus: 'untested' | 'connected' | 'error';
  lastLatencyMs: number | null;
  lastHttpStatus: number | null;
  lastError: string | null;
}

interface BridgeConfigData {
  towerOrigin: string;
  towerApiBase: string;
  casinoOrigin: string;
  configured: boolean;
  env: Record<string, boolean>;
  endpoints: Record<string, string>;
}

function Dot({ ok, pending }: { ok: boolean | null; pending?: boolean }) {
  if (pending) return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />;
  return <span className={`h-2.5 w-2.5 rounded-full inline-block ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />;
}

export function BridgePage() {
  const qc = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const [form, setForm] = useState({
    name: 'TOLS Governance', towerOrigin: 'https://gov.tols.fun', towerApiBase: 'https://gov.tols.fun/api',
    casinoOrigin: 'https://www.tols.fun', apiKey: '', appKey: '', bridgeSecret: '',
    healthPath: '/api/platform/health', webhookPath: '/api/platform/webhooks', enabled: true,
  });

  const healthQ = useQuery<{ ok: boolean; service: string; timestamp: string } & BridgeHealth>({
    queryKey: ['bridge-health'],
    queryFn: async () => {
      const r = await fetch('/api/bridge/health?probe=true');
      return r.json();
    },
    refetchInterval: 15000,
  });

  const configQ = useQuery<{ success: boolean; data: BridgeConfigData }>({
    queryKey: ['bridge-config'],
    queryFn: async () => {
      const r = await fetch('/api/bridge/config');
      if (!r.ok) throw new Error('Unauthorized — log in as operator');
      return r.json();
    },
    retry: false,
  });

  const connectionQ = useQuery<{ success: boolean; data: { connection: GovernanceConnection | null; encryptionConfigured: boolean } }>({
    queryKey: ['governance-connection'],
    queryFn: async () => {
      const r = await fetch('/api/bridge/connection', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load Governance connection');
      return j;
    },
    retry: false,
  });

  const syncQ = useQuery<{ success: boolean; data: { pending: Record<string, number>; towerOrigin: string } }>({
    queryKey: ['bridge-sync-preview'],
    queryFn: async () => {
      const r = await fetch('/api/bridge/sync');
      if (!r.ok) throw new Error('sync preview failed');
      return r.json();
    },
    retry: false,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/bridge/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'sync failed');
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bridge-health'] }); qc.invalidateQueries({ queryKey: ['bridge-sync-preview'] }); },
  });

  const saveConnection = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/bridge/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not save connection'); return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['governance-connection'] }); qc.invalidateQueries({ queryKey: ['bridge-health'] }); qc.invalidateQueries({ queryKey: ['bridge-config'] }); },
  });
  const testConnection = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/bridge/connection/test', { method: 'POST' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Connection failed'); return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['governance-connection'] }); qc.invalidateQueries({ queryKey: ['bridge-health'] }); },
  });
  const deleteConnection = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/bridge/connection', { method: 'DELETE' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not delete connection'); return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['governance-connection'] }); qc.invalidateQueries({ queryKey: ['bridge-health'] }); },
  });

  const connection = connectionQ.data?.data.connection;
  useEffect(() => {
    if (!connection) return;
    // Query hydration is external state; defer the controlled-form update so
    // the effect does not synchronously cascade a second render.
    const task = window.setTimeout(() => setForm((current) => ({ ...current, name: connection.name, towerOrigin: connection.towerOrigin, towerApiBase: connection.towerApiBase, casinoOrigin: connection.casinoOrigin, apiKey: '', appKey: '', bridgeSecret: '', healthPath: connection.healthPath, webhookPath: connection.webhookPath, enabled: connection.enabled })), 0);
    return () => window.clearTimeout(task);
  }, [connection]);

  const health = healthQ.data as BridgeHealth | undefined;
  const cfg = configQ.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Link2 className="h-6 w-6 text-primary" /> Ponte Governance ↔ Casino</h1>
          <p className="text-sm text-muted-foreground">Stato del ponte bidirezionale, health check e sincronizzazione.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { healthQ.refetch(); configQ.refetch(); syncQ.refetch(); }}><RefreshCw className="h-4 w-4 mr-1" />Aggiorna</Button>
      </div>

      {/* Real persisted Governance connection — encrypted in PlatformSetting, not browser localStorage. */}
      <Card className="border-primary/20 bg-card/55">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Connessione backend TOLS Governance</CardTitle><CardDescription>Crea la connessione service-to-service reale. URL e credenziali vengono salvati cifrati nel database e usati da webhook, sync, eventi e SSO.</CardDescription></div>
            {connection ? <Badge className={connection.lastStatus === 'connected' ? 'bg-emerald-600' : connection.lastStatus === 'error' ? 'bg-red-600' : 'bg-amber-600'}>{connection.lastStatus}{connection.lastLatencyMs ? ` · ${connection.lastLatencyMs}ms` : ''}</Badge> : <Badge variant="outline">non creata</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionQ.data?.data.encryptionConfigured && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><KeyRound className="mr-1 inline h-3.5 w-3.5" />Configura <code>CONNECTION_ENCRYPTION_KEY</code> o <code>ADMIN_SESSION_SECRET</code> prima di salvare credenziali.</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs"><span>Nome connessione</span><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="TOLS Governance Production" /></label>
            <label className="space-y-1 text-xs"><span>Casino origin</span><Input value={form.casinoOrigin} onChange={(e) => setForm({ ...form, casinoOrigin: e.target.value })} placeholder="https://www.tols.fun" /></label>
            <label className="space-y-1 text-xs"><span>Governance origin</span><Input value={form.towerOrigin} onChange={(e) => setForm({ ...form, towerOrigin: e.target.value })} placeholder="https://gov.tols.fun" /></label>
            <label className="space-y-1 text-xs"><span>Governance API base</span><Input value={form.towerApiBase} onChange={(e) => setForm({ ...form, towerApiBase: e.target.value })} placeholder="https://gov.tols.fun/api" /></label>
            <label className="space-y-1 text-xs"><span>API key {connection?.apiKeyHint && <em className="text-muted-foreground">({connection.apiKeyHint} salvata)</em>}</span><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={connection?.hasApiKey ? 'Lascia vuoto per mantenere' : 'Governance API key'} /></label>
            <label className="space-y-1 text-xs"><span>App key {connection?.appKeyHint && <em className="text-muted-foreground">({connection.appKeyHint} salvata)</em>}</span><Input type="password" value={form.appKey} onChange={(e) => setForm({ ...form, appKey: e.target.value })} placeholder={connection?.hasAppKey ? 'Lascia vuoto per mantenere' : 'Governance app key'} /></label>
            <label className="space-y-1 text-xs md:col-span-2"><span>Bridge secret condiviso</span><Input type="password" value={form.bridgeSecret} onChange={(e) => setForm({ ...form, bridgeSecret: e.target.value })} placeholder={connection?.hasBridgeSecret ? 'Lascia vuoto per mantenere il secret cifrato' : 'Minimo 32 caratteri — stesso valore su Governance'} /></label>
            <label className="space-y-1 text-xs"><span>Health path</span><Input value={form.healthPath} onChange={(e) => setForm({ ...form, healthPath: e.target.value })} /></label>
            <label className="space-y-1 text-xs"><span>Registration/webhook path</span><Input value={form.webhookPath} onChange={(e) => setForm({ ...form, webhookPath: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> usa questa connessione come backend Governance attivo</label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveConnection.mutate()} disabled={saveConnection.isPending || !connectionQ.data?.data.encryptionConfigured}><Save className="mr-1 h-4 w-4" />{connection ? 'Aggiorna connessione' : 'Crea connessione'}</Button>
            <Button variant="outline" onClick={() => testConnection.mutate()} disabled={!connection || testConnection.isPending}><Link2 className="mr-1 h-4 w-4" />{testConnection.isPending ? 'Handshake…' : 'Test + registra'}</Button>
            {connection && <Button variant="destructive" onClick={() => deleteConnection.mutate()} disabled={deleteConnection.isPending}><Trash2 className="mr-1 h-4 w-4" />Elimina</Button>}
          </div>
          {(saveConnection.isError || testConnection.isError || deleteConnection.isError) && <p className="text-xs text-red-600">{((saveConnection.error || testConnection.error || deleteConnection.error) as Error).message}</p>}
          {testConnection.data?.data && <pre className="max-h-52 overflow-auto rounded-lg bg-muted p-2 text-[10px]">{JSON.stringify(testConnection.data.data, null, 2)}</pre>}
          {connection?.lastError && <p className="text-xs text-red-500"><Unplug className="mr-1 inline h-3.5 w-3.5" />{connection.lastError}</p>}
        </CardContent>
      </Card>

      {/* Health cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> Casino</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Origin</span><span className="font-mono text-xs truncate max-w-[160px]">{health?.casino?.origin || cfg?.casinoOrigin || '—'}</span></div>
            <div className="flex items-center justify-between text-sm"><span>DB</span><span className="flex items-center gap-2">{healthQ.isLoading ? <Dot ok={null} pending /> : <Dot ok={Boolean(health?.db?.ok)} />}<span className="text-xs">{health?.db?.ok ? `${health.db.latencyMs}ms` : (health?.db?.error?.slice(0,40) || '—')}</span></span></div>
            <div className="flex items-center justify-between text-sm"><span>Health</span>{healthQ.isLoading ? <Badge variant="secondary">...</Badge> : health?.ok ? <Badge className="bg-emerald-600">OK</Badge> : <Badge variant="destructive">Degraded</Badge>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Governance Tower</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Origin</span><span className="font-mono text-xs truncate max-w-[160px]">{health?.tower?.origin || cfg?.towerOrigin || '—'}</span></div>
            <div className="flex items-center justify-between text-sm"><span>API Base</span><span className="font-mono text-[11px] truncate max-w-[160px]">{health?.tower?.apiBase || cfg?.towerApiBase || '—'}</span></div>
            <div className="flex items-center justify-between text-sm"><span>Raggiungibile</span><span className="flex items-center gap-2">{healthQ.isLoading ? <Dot ok={null} pending /> : health?.tower?.reachable === null ? <Badge variant="secondary">skip</Badge> : <Dot ok={Boolean(health?.tower?.reachable)} />}<span className="text-xs">{health?.tower?.reachable ? `HTTP ${health.tower.status} · ${health.tower.latencyMs}ms` : (health?.tower?.error || 'no')}</span></span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Bridge</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Secret</span>{health?.bridge?.configured ? <Badge className="bg-emerald-600">configurato</Badge> : <Badge variant="destructive">manca</Badge>}</div>
            <div className="flex items-center justify-between text-sm"><span>Tower Keys</span>{health?.bridge?.hasTowerKeys ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}</div>
            <div className="text-[11px] text-muted-foreground">Imposta <code>GOVERNANCE_BRIDGE_SECRET</code> identico su Tower e Casino. Alias: <code>GOVERNANCE_WEBHOOK_SECRET</code>.</div>
          </CardContent>
        </Card>
      </div>

      {/* Endpoints + sync */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Sincronizzazione</CardTitle><CardDescription>Spinge uno snapshot del Casino verso la Tower (best-effort).</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {syncQ.data?.data?.pending && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-muted p-2 text-center"><div className="font-bold text-base">{syncQ.data.data.pending['bets'] ?? '—'}</div><div className="text-muted-foreground">bets</div></div>
                <div className="rounded-lg bg-muted p-2 text-center"><div className="font-bold text-base">{syncQ.data.data.pending['withdrawalsPending'] ?? syncQ.data.data.pending['pendingWithdrawals'] ?? '—'}</div><div className="text-muted-foreground">withdrawals pending</div></div>
                <div className="rounded-lg bg-muted p-2 text-center"><div className="font-bold text-base">{syncQ.data.data.pending['activeControls'] ?? '—'}</div><div className="text-muted-foreground">active controls</div></div>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> dryRun (anteprima senza push)</label>
            <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="w-full" variant={dryRun ? 'secondary' : 'default'}>
              {syncMut.isPending ? <><Clock className="h-4 w-4 mr-1 animate-spin" />Invio…</> : <><Send className="h-4 w-4 mr-1" />{dryRun ? 'Anteprima sync' : 'Sincronizza ora'}</>}
            </Button>
            {syncMut.data && (
              <pre className="text-[11px] bg-muted rounded p-2 overflow-auto max-h-64">{JSON.stringify(syncMut.data, null, 2)}</pre>
            )}
            {syncMut.isError && <p className="text-xs text-red-600">{(syncMut.error as Error).message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Endpoint del ponte</CardTitle><CardDescription>Usa questi URL su Tower e Vercel.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {[
              { m: 'GET', p: '/api/bridge/health?probe=true', d: 'health pubblico (Vercel cron ogni 15m)' },
              { m: 'POST', p: '/api/bridge/webhook', d: 'Tower → Casino (HMAC X-Bridge-Signature)' },
              { m: 'GET', p: '/api/bridge/sso?token=...', d: 'SSO Tower→Casino (bridge secret)' },
              { m: 'POST', p: '/api/bridge/sso', d: 'SSO Casino→Tower (mint token)' },
              { m: 'POST', p: '/api/bridge/sync', d: 'admin: push snapshot a Tower' },
              { m: 'GET', p: '/api/tols?path=/…', d: 'proxy TOLS Platform (admin)' },
            ].map((e) => (
              <div key={e.p} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                <div><span className="text-[10px] font-bold rounded bg-primary text-primary-foreground px-1 py-0.5 mr-1">{e.m}</span><span className="font-mono text-xs">{e.p}</span><div className="text-[11px] text-muted-foreground">{e.d}</div></div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigator.clipboard.writeText(e.p)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <div className="text-[11px] text-muted-foreground pt-2">
              Webhook header: <code>X-Bridge-Signature: sha256=&lt;hmac_sha256(rawBody, secret)&gt;</code>. In dev senza secret, <code>ping</code> è aperto.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Env matrix */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Env — cosa manca su Vercel?</CardTitle><CardDescription>Verde = presente. Configura su Vercel → Settings → Environment Variables (Production).</CardDescription></CardHeader>
        <CardContent>
          {health?.bridge?.envPresent ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(health.bridge.envPresent).map(([k, v]) => (
                <div key={k} className={`rounded-lg border p-2 flex items-center justify-between ${v ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'}`}>
                  <span className="font-mono text-[11px]">{k}</span>{v ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-600" />}
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">In attesa di health…</p>}
          <details className="mt-3">
            <summary className="text-xs cursor-pointer text-primary">Mostra env richiesti su Vercel</summary>
            <pre className="text-[11px] bg-muted rounded p-2 mt-2 overflow-auto">{`DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres
ADMIN_SESSION_SECRET=$(openssl rand -hex 32)
APP_URL=https://tols.fun
GOVERNANCE_TOWER_URL=https://tolscrypto.base44.app
GOVERNANCE_BRIDGE_SECRET=$(openssl rand -hex 32)   # identico su Tower!
TOLS_BASE_URL=https://tolscrypto.base44.app/api
TOLS_API_KEY=...
TOLS_APP_KEY=...
CRON_SECRET=$(openssl rand -hex 16)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
`}</pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
