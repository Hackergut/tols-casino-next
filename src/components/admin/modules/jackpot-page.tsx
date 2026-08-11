'use client';

import React, { useState } from 'react';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import type { GlobalJackpot } from '@/types/tols';
import { useTolsQuery } from '@/lib/tols-hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trophy, Gem, Target, DollarSign, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const createFields: FieldConfig[] = [
  { key: 'name', label: 'Jackpot Name', type: 'text', required: true, placeholder: 'e.g. Mega Jackpot' },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    required: true,
    options: [
      { label: 'BTC', value: 'BTC' },
      { label: 'ETH', value: 'ETH' },
      { label: 'SOL', value: 'SOL' },
    ],
  },
  {
    key: 'chain',
    label: 'Chain',
    type: 'select',
    required: true,
    options: [
      { label: 'Bitcoin', value: 'bitcoin' },
      { label: 'Ethereum', value: 'ethereum' },
      { label: 'Solana', value: 'solana' },
    ],
  },
  { key: 'seed_amount', label: 'Seed Amount', type: 'number', required: true, placeholder: '1.0', description: 'Initial jackpot amount' },
  { key: 'contribution_rate', label: 'Contribution Rate (%)', type: 'number', required: true, placeholder: '2.5', description: 'Percentage of each bet added to the jackpot' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Closed', value: 'closed' },
    ],
  },
];

const editFields: FieldConfig[] = [
  { key: 'name', label: 'Jackpot Name', type: 'text', required: true },
  { key: 'contribution_rate', label: 'Contribution Rate (%)', type: 'number', placeholder: '2.5' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Closed', value: 'closed' },
    ],
  },
];

function BiggestJackpotBanner() {
  const { data, isLoading } = useTolsQuery<GlobalJackpot>('GlobalJackpot', {
    limit: 50,
    q: JSON.stringify({ status: 'active' }),
  });

  const jackpots = data?.data || [];
  const biggest = jackpots.reduce(
    (max, j) => (Number(j.current_amount) > Number(max.current_amount) ? j : max),
    jackpots[0] || null
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-gradient-to-r from-amber-950/40 via-yellow-900/30 to-amber-950/40 p-6">
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (!biggest) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/50 via-yellow-900/30 to-amber-950/50 p-6 sm:p-8">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
      
      {/* Sparkle decorations */}
      <div className="absolute top-3 right-4 animate-pulse">
        <Sparkles className="h-5 w-5 text-amber-400" />
      </div>
      <div className="absolute bottom-3 left-6 animate-pulse" style={{ animationDelay: '1s' }}>
        <Sparkles className="h-4 w-4 text-yellow-400/60" />
      </div>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="animate-pulse rounded-full bg-amber-500/20 p-3 ring-2 ring-amber-500/30">
            <Trophy className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-amber-300/80 uppercase tracking-wider">Biggest Active Jackpot</p>
            <h3 className="text-lg font-bold text-amber-100 mt-0.5">{biggest.name}</h3>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <CurrencyBadge currency={biggest.currency} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight animate-pulse">
            {formatAmount(biggest.current_amount, biggest.currency)}
          </p>
          <p className="text-xs text-amber-300/60 mt-1">
            Seed: {formatAmount(biggest.seed_amount, biggest.currency)} &middot; {biggest.contribution_rate}% per bet
          </p>
        </div>
      </div>
    </div>
  );
}

function JackpotSummaryCards() {
  const { data, isLoading } = useTolsQuery<GlobalJackpot>('GlobalJackpot', { limit: 100 });
  const jackpots = data?.data || [];

  const totalJackpots = jackpots.length;
  const activeJackpots = jackpots.filter((j) => j.status === 'active').length;
  const totalPrizePool = jackpots.reduce((sum, j) => sum + Number(j.current_amount || 0), 0);
  const largestJackpot = jackpots.reduce(
    (max, j) => (Number(j.current_amount) > Number(max.current_amount) ? j : max),
    jackpots[0] || { current_amount: 0 }
  );

  const cards = [
    { label: 'Total Jackpots', value: totalJackpots.toLocaleString(), icon: Target, color: 'purple' },
    { label: 'Active Jackpots', value: activeJackpots.toLocaleString(), icon: Sparkles, color: 'amber' },
    { label: 'Total Prize Pool', value: totalPrizePool.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: DollarSign, color: 'emerald' },
    { label: 'Largest Jackpot', value: Number(largestJackpot.current_amount).toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: Crown, color: 'rose' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                )}
              </div>
              <div className={`h-10 w-10 rounded-lg bg-${card.color}-500/10 flex items-center justify-center`}>
                <card.icon className={`h-5 w-5 text-${card.color}-500`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function JackpotPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GlobalJackpot | null>(null);

  const columns: Column<GlobalJackpot>[] = [
    { key: 'name', label: 'Name', render: (item) => <span className="font-medium">{item.name}</span> },
    {
      key: 'currency',
      label: 'Currency',
      render: (item) => <CurrencyBadge currency={item.currency} />,
    },
    {
      key: 'chain',
      label: 'Chain',
      render: (item) => (
        <span className="text-xs capitalize text-muted-foreground">{item.chain}</span>
      ),
    },
    {
      key: 'seed_amount',
      label: 'Seed Amount',
      render: (item) => (
        <span className="font-mono text-sm text-muted-foreground">
          {formatAmount(item.seed_amount, item.currency)}
        </span>
      ),
    },
    {
      key: 'current_amount',
      label: 'Current Amount',
      render: (item) => (
        <span className="font-mono text-sm font-bold text-amber-500">
          {formatAmount(item.current_amount, item.currency)}
        </span>
      ),
    },
    {
      key: 'contribution_rate',
      label: 'Contrib. Rate',
      render: (item) => <span className="font-mono text-sm">{item.contribution_rate}%</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'last_win_date',
      label: 'Last Win',
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.last_win_date ? formatDate(item.last_win_date) : '—'}</span>
      ),
    },
  ];

  const handleView = (item: GlobalJackpot) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: GlobalJackpot) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: GlobalJackpot) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Gem className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Global Jackpots</h1>
            <p className="text-sm text-muted-foreground">Configure progressive jackpot pools, seed amounts, and contribution rates</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
      </div>

      <JackpotSummaryCards />

      <BiggestJackpotBanner />

      <DataTable<GlobalJackpot>
        entity="GlobalJackpot"
        columns={columns}
        filterKey="name"
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel="Create Jackpot"
        title="Global Jackpots"
      />

      <EntityDialog
        entity="GlobalJackpot"
        title="Global Jackpot"
        description="Create a new global jackpot pool."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="GlobalJackpot"
        title="Global Jackpot"
        description="Update jackpot settings."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem
          ? {
              name: selectedItem.name,
              contribution_rate: selectedItem.contribution_rate,
              status: selectedItem.status,
            }
          : undefined}
      />

      <DetailDialog
        title="Global Jackpot"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity="GlobalJackpot"
        entityName="Jackpot"
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
