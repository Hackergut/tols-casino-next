'use client';

/*
 * Deposit Addresses — admin page.
 *
 * Configures the PUBLIC receive address (and optional memo) shown to players
 * for each supported deposit chain, via /api/admin/deposit-addresses. This is
 * a receive address only — the API rejects anything that looks like a seed
 * phrase and this UI never asks for a private key.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageDecoration } from '@/components/admin/shared/page-decoration';
import { truncateAddress } from '@/lib/tols-utils';
import { CHAINS, CHAIN_IDS } from '@/lib/chains';
import { Loader2, Wallet, ShieldCheck, Copy, Check, Save, Info } from 'lucide-react';

interface ChainRow {
  chain: string;
  name: string;
  symbol: string;
  address: string;
  memo: string;
  minConfirmations: number;
  enabled: boolean;
}

interface Draft {
  address: string;
  memo: string;
  minConfirmations: number;
  enabled: boolean;
}

function buildDraft(row?: ChainRow): Draft {
  return {
    address: row?.address ?? '',
    memo: row?.memo ?? '',
    minConfirmations: row?.minConfirmations ?? 2,
    enabled: row?.enabled ?? false,
  };
}

export function DepositAddressesPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<ChainRow[]>({
    queryKey: ['admin-deposit-addresses'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deposit-addresses');
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed to fetch deposit addresses');
      return j.data as ChainRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (chain: string) => {
      const draft = drafts[chain];
      if (!draft) return;
      const res = await fetch('/api/admin/deposit-addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, ...draft }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Save failed');
      return j.data as ChainRow;
    },
    onMutate: (chain) => setSaving(chain),
    onSuccess: (_, chain) => {
      toast.success(`${CHAINS[chain].name} aggiornato`);
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-addresses'] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSaving(null),
  });

  const configuredCount = useMemo(() => rows.filter((r) => r.enabled && r.address).length, [rows]);

  const copy = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }, []);

  return (
    <div className="relative">
      <PageDecoration variant="emerald" />

      <div className="relative z-10 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Deposit Addresses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Indirizzi pubblici di ricezione mostrati ai giocatori per ogni chain. Incolla solo indirizzi
            di ricezione — mai seed phrase o chiavi private.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Chain supportate', value: CHAIN_IDS.length, icon: Wallet },
            { label: 'Configurate', value: configuredCount, icon: ShieldCheck },
            { label: 'Da configurare', value: CHAIN_IDS.length - configuredCount, icon: Info },
          ].map((c) => (
            <Card key={c.label} className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <c.icon className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: CHAIN_IDS.length }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rows.map((row) => {
              const draft = drafts[row.chain] ?? buildDraft(row);
              const meta = CHAINS[row.chain];
              const dirty =
                draft.address !== row.address ||
                draft.memo !== row.memo ||
                Number(draft.minConfirmations) !== Number(row.minConfirmations) ||
                draft.enabled !== row.enabled;
              return (
                <Card key={row.chain} className="bg-card/40 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black"
                          style={{ background: `${meta.color}22`, color: meta.color }}
                        >
                          {row.symbol.slice(0, 3)}
                        </span>
                        <div>
                          <CardTitle className="text-base">{meta.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">{row.symbol} · {row.chain}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={row.enabled ? 'default' : 'outline'}>
                        {row.enabled ? 'Attivo' : 'Disattivo'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Indirizzo di ricezione</Label>
                      <div className="flex gap-2">
                        <Input
                          value={draft.address}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [row.chain]: { ...draft, address: e.target.value } }))
                          }
                          placeholder={`${row.symbol} address…`}
                          className="font-mono text-xs h-9"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        {draft.address && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => copy(draft.address)}
                            title="Copia"
                          >
                            {copied === draft.address ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {draft.address && (
                        <p className="text-[11px] text-muted-foreground break-all">
                          {truncateAddress(draft.address)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Memo / Tag (opzionale)</Label>
                      <Input
                        value={draft.memo}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [row.chain]: { ...draft, memo: e.target.value } }))
                        }
                        placeholder="Memo…"
                        className="font-mono text-xs h-9"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Conferme min.</Label>
                          <Input
                            type="number"
                            min={0}
                            max={64}
                            value={draft.minConfirmations}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [row.chain]: { ...draft, minConfirmations: Math.max(0, Number(e.target.value) || 0) } }))
                            }
                            className="w-20 h-8 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Attivo</Label>
                          <div className="h-8 flex items-center">
                            <Switch
                              checked={draft.enabled}
                              onCheckedChange={(v) =>
                                setDrafts((d) => ({ ...d, [row.chain]: { ...draft, enabled: v } }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => saveMutation.mutate(row.chain)}
                        disabled={saving === row.chain || !dirty}
                        className="h-9 gap-1.5"
                      >
                        {saving === row.chain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salva
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="bg-card/40 border-border/50">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Gli indirizzi vengono mostrati ai giocatori per generare i QR di deposito. Il monitoraggio
              dei depositi è separato (vedi <span className="font-semibold">Deposits</span> e{' '}
              <span className="font-semibold">Deposit Tracker</span>): qui configuri solo la destinazione
              pubblica per chain.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DepositAddressesPage;
