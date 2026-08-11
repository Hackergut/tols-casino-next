'use client';

import React, { useMemo, useState } from 'react';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import type { Bet } from '@/types/tols';
import { Badge } from '@/components/ui/badge';
import { useTolsQuery } from '@/lib/tols-hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Trophy, DollarSign, Activity, Percent, Dice5, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsBarChart } from '@/components/admin/shared/stats-bar-chart';

const RESULT_COLORS: Record<string, string> = {
  win: '#22c55e',
  loss: 'var(--color-loss)',
  pending: '#6b7280',
};

const createFields: FieldConfig[] = [
  { key: 'user_id', label: 'User ID', type: 'text', required: true, placeholder: 'User ID' },
  { key: 'wallet_id', label: 'Wallet ID', type: 'text', placeholder: 'Wallet ID' },
  { key: 'game_id', label: 'Game ID', type: 'text', required: true, placeholder: 'Game ID' },
  { key: 'game_type', label: 'Game Type', type: 'text', placeholder: 'e.g. slot, table' },
  { key: 'is_demo', label: 'Demo Bet', type: 'boolean', description: 'Whether this is a demo/play-money bet' },
  { key: 'demo_session_id', label: 'Demo Session ID', type: 'text', placeholder: 'Demo session ID (if demo)' },
  { key: 'bet_amount', label: 'Bet Amount', type: 'number', required: true, placeholder: '0.00' },
];

const editFields: FieldConfig[] = [
  {
    key: 'result',
    label: 'Result',
    type: 'select',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Win', value: 'win' },
      { label: 'Loss', value: 'loss' },
    ],
  },
  { key: 'payout_multiplier', label: 'Payout Multiplier', type: 'number', placeholder: 'e.g. 2.5' },
  { key: 'win_amount', label: 'Win Amount', type: 'number', placeholder: '0.00' },
  { key: 'jackpot_win_amount', label: 'Jackpot Win Amount', type: 'number', placeholder: '0.00' },
  { key: 'free_spins_awarded', label: 'Free Spins Awarded', type: 'number', placeholder: '0' },
];

function SummaryCards() {
  const { data, isLoading } = useTolsQuery<Bet>('Bet', { limit: 100, sort_by: '-created_date' });
  const bets = data?.data || [];

  const totalBets = bets.length;
  const wins = bets.filter((b) => b.result === 'win').length;
  const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : '0.0';
  const totalWagered = bets.reduce((sum, b) => sum + Number(b.bet_amount || 0), 0);
  const totalWon = bets.reduce((sum, b) => sum + Number(b.win_amount || 0), 0);
  const houseEdge = totalWagered > 0 ? (((totalWagered - totalWon) / totalWagered) * 100).toFixed(1) : '0.0';

  const cards = [
    { label: 'Total Bets', value: totalBets.toLocaleString(), icon: Activity, color: 'text-foreground' },
    { label: 'Win Rate', value: `${winRate}%`, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Total Wagered', value: totalWagered.toLocaleString(), icon: DollarSign, color: 'text-amber-500' },
    { label: 'Total Won', value: totalWon.toLocaleString(), icon: Trophy, color: 'text-purple-500' },
    { label: 'House Edge', value: `${houseEdge}%`, icon: Percent, color: 'text-rose-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01]"
        >
          <div className="flex items-center gap-2">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className={`text-lg font-bold tracking-tight ${card.color}`}>{card.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function BetResultChart() {
  const { data, isLoading } = useTolsQuery<Bet>('Bet', { limit: 100, sort_by: '-created_date' });
  const bets = data?.data || [];

  const chartData = useMemo(() => {
    const resultMap: Record<string, number> = {};
    bets.forEach((b) => {
      const r = b.result || 'unknown';
      resultMap[r] = (resultMap[r] || 0) + 1;
    });
    return ['win', 'loss', 'pending']
      .map((name) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: resultMap[name] || 0,
        color: RESULT_COLORS[name] || '#6b7280',
      }))
      .filter((d) => d.value > 0);
  }, [bets]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Bet Results Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <StatsBarChart data={chartData} height={150} />
        )}
      </CardContent>
    </Card>
  );
}

export function BetsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Bet | null>(null);

  const columns: Column<Bet>[] = [
    {
      key: 'user_id',
      label: 'User',
      render: (item) => (
        <span className="font-mono text-xs">{item.user_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'game_id',
      label: 'Game',
      render: (item) => (
        <span className="font-mono text-xs">{item.game_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'game_type',
      label: 'Game Type',
      render: (item) => <Badge variant="outline" className="text-xs capitalize">{item.game_type}</Badge>,
    },
    {
      key: 'is_demo',
      label: 'Demo',
      render: (item) => (
        <Badge variant={item.is_demo ? 'secondary' : 'default'} className="text-xs">
          {item.is_demo ? 'Demo' : 'Real'}
        </Badge>
      ),
    },
    {
      key: 'bet_amount',
      label: 'Bet Amount',
      render: (item) => (
        <span className="font-mono text-sm">{formatAmount(item.bet_amount, item.currency)}</span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (item) => <CurrencyBadge currency={item.currency} />,
    },
    {
      key: 'result',
      label: 'Result',
      render: (item) => <StatusBadge status={item.result} />,
    },
    {
      key: 'payout_multiplier',
      label: 'Multiplier',
      render: (item) => (
        <span className="font-mono text-sm">{item.payout_multiplier}x</span>
      ),
    },
    {
      key: 'win_amount',
      label: 'Win Amount',
      render: (item) => (
        <span className="font-mono text-sm text-emerald-500">
          {item.win_amount > 0 ? formatAmount(item.win_amount, item.currency) : '—'}
        </span>
      ),
    },
    {
      key: 'jackpot_win_amount',
      label: 'Jackpot Win',
      render: (item) => (
        <span className="font-mono text-sm text-amber-500">
          {item.jackpot_win_amount > 0 ? formatAmount(item.jackpot_win_amount, item.currency) : '—'}
        </span>
      ),
    },
    {
      key: 'free_spins_awarded',
      label: 'Free Spins',
      render: (item) => (
        <span className="font-mono text-sm">
          {item.free_spins_awarded > 0 ? item.free_spins_awarded : '—'}
        </span>
      ),
    },
    {
      key: 'created_date',
      label: 'Date',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.created_date)}</span>,
    },
  ];

  const handleView = (item: Bet) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: Bet) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: Bet) => {
    if (item.result !== 'pending') {
      toast.error('Only pending bets can be deleted');
      return;
    }
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Dice5 className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Betting Activity</h1>
            <p className="text-sm text-muted-foreground">Monitor all betting activity, settlements, and outcomes</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
      </div>

      <SummaryCards />

      <BetResultChart />

      <DataTable<Bet>
        entity="Bet"
        columns={columns}
        filterKey="user_id"
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel="Place Bet"
        title="Bets"
        statusFilters={[
          { label: 'Pending', value: 'pending' },
          { label: 'Win', value: 'win' },
          { label: 'Loss', value: 'loss' },
        ]}
        statusFilterKey="result"
        selectable
        bulkStatusChange
        exportable
        exportFilename="bets"
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity="Bet"
        title="Bet"
        description="Record a new bet placement."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="Bet"
        title="Bet"
        description="Update bet result and payout details."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem
          ? {
              result: selectedItem.result,
              payout_multiplier: selectedItem.payout_multiplier,
              win_amount: selectedItem.win_amount,
              jackpot_win_amount: selectedItem.jackpot_win_amount,
              free_spins_awarded: selectedItem.free_spins_awarded,
            }
          : undefined}
      />

      <DetailDialog
        title="Bet"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity="Bet"
        entityName="Bet"
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
