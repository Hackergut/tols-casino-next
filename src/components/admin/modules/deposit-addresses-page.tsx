'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Save, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { toast } from 'sonner';

/*
 * Deposit Addresses — set the platform's public receive address per chain.
 * These are the addresses players' QR codes and payment URIs are built from
 * (see /api/deposits/address); the deposit watcher only credits a deposit once
 * an on-chain transfer to this exact address is confirmed.
 *
 * SECURITY: only a public receive address goes here, never a seed phrase or
 * private key — the backend has no signing capability by design (watch-only).
 */

interface AddressRow {
  chain: string;
  name: string;
  symbol: string;
  address: string;
  memo: string;
  minConfirmations: number;
  enabled: boolean;
}

function ChainCard({ row, onSaved }: { row: AddressRow; onSaved: () => void }) {
  const [address, setAddress] = useState(row.address);
  const [memo, setMemo] = useState(row.memo);
  const [minConfirmations, setMinConfirmations] = useState(row.minConfirmations);
  const [enabled, setEnabled] = useState(row.enabled);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAddress(row.address); setMemo(row.memo); setMinConfirmations(row.minConfirmations); setEnabled(row.enabled);
    setDirty(false);
  }, [row]);

  const configured = row.address.length > 0;

  async function save() {
    if (address.split(/\s+/).length >= 12) {
      toast.error('That looks like a seed phrase — paste only a public receive address');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/deposit-addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: row.chain, address, memo, minConfirmations, enabled }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Save failed');
      toast.success(`${row.name} address saved`);
      setDirty(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{row.symbol}</span>
            <CardTitle className="text-sm font-normal text-muted-foreground">{row.name}</CardTitle>
          </div>
          {configured ? (
            row.enabled
              ? <Badge variant="default" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> live</Badge>
              : <Badge variant="secondary" className="text-[10px]">saved, disabled</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" /> not set</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div>
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">Receive address</label>
          <Input
            value={address}
            onChange={(e) => { setAddress(e.target.value); setDirty(true); }}
            placeholder="Public address only — never a seed phrase"
            className="font-mono text-xs mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Memo / tag (optional)</label>
            <Input value={memo} onChange={(e) => { setMemo(e.target.value); setDirty(true); }} className="text-xs mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Min confirmations</label>
            <Input
              type="number"
              min={0}
              max={64}
              value={minConfirmations}
              onChange={(e) => { setMinConfirmations(Number(e.target.value) || 0); setDirty(true); }}
              className="text-xs mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => { setEnabled((v) => !v); setDirty(true); }}
            className="flex items-center gap-2 text-xs"
          >
            <span className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            <span className="text-muted-foreground">{enabled ? 'Enabled for deposits' : 'Disabled'}</span>
          </button>
          <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DepositAddressesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: AddressRow[] }>({
    queryKey: ['deposit-addresses'],
    queryFn: async () => {
      const r = await fetch('/api/admin/deposit-addresses');
      if (!r.ok) throw new Error('Failed to load deposit addresses');
      return r.json();
    },
  });

  const rows = data?.data ?? [];
  const liveCount = rows.filter((r) => r.enabled && r.address).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Deposit Addresses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set the platform&apos;s public receive address per chain. Players scan a QR generated from this
            address — the backend never holds a private key (watch-only).
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <QrCode className="h-3.5 w-3.5" /> {liveCount} / {rows.length || '—'} live
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <ChainCard key={row.chain} row={row} onSaved={() => qc.invalidateQueries({ queryKey: ['deposit-addresses'] })} />
          ))}
        </div>
      )}
    </div>
  );
}
