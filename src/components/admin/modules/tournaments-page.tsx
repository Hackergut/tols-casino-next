'use client';

import React, { useState } from 'react';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { Tournament } from '@/types/tols';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Clock, DollarSign } from 'lucide-react';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

const createFields: FieldConfig[] = [
  { key: 'name', label: 'Tournament Name', type: 'text', required: true, placeholder: 'e.g. Weekend Slot Showdown' },
  { key: 'game_id', label: 'Game ID', type: 'text', required: true, placeholder: 'Slot game ID' },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Freeroll', value: 'freeroll' },
      { label: 'Paid', value: 'paid' },
    ],
  },
  { key: 'entry_fee', label: 'Entry Fee', type: 'number', placeholder: '0.00', description: '0 for freeroll tournaments' },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    options: [
      { label: 'BTC', value: 'BTC' },
      { label: 'ETH', value: 'ETH' },
      { label: 'SOL', value: 'SOL' },
      { label: 'USDT', value: 'USDT' },
      { label: 'USDC', value: 'USDC' },
    ],
  },
  { key: 'min_players', label: 'Min Players', type: 'number', placeholder: '10' },
  { key: 'max_players', label: 'Max Players', type: 'number', placeholder: '100' },
  { key: 'start_date', label: 'Start Date', type: 'text', required: true, placeholder: '2025-01-15T18:00:00Z', description: 'ISO 8601 datetime' },
  { key: 'end_date', label: 'End Date', type: 'text', required: true, placeholder: '2025-01-15T22:00:00Z', description: 'ISO 8601 datetime' },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Upcoming', value: 'upcoming' },
      { label: 'Active', value: 'active' },
      { label: 'Completed', value: 'completed' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
  },
];

const typeVariant: Record<string, 'default' | 'secondary'> = {
  freeroll: 'default',
  paid: 'secondary',
};

function TournamentsSummaryCards() {
  const { data, isLoading } = useTolsQuery<Tournament>('Tournament', { limit: 200 });
  const tournaments = data?.data || [];

  const total = tournaments.length;
  const active = tournaments.filter((t) => t.status === 'active').length;
  const upcoming = tournaments.filter((t) => t.status === 'upcoming').length;
  const totalPrizePool = tournaments.reduce((sum, t) => sum + Number(t.prize_pool || 0), 0);

  const cards = [
    { label: 'Total Tournaments', value: total.toLocaleString(), icon: Trophy, color: 'orange' },
    { label: 'Active', value: active.toLocaleString(), icon: Clock, color: 'emerald' },
    { label: 'Upcoming', value: upcoming.toLocaleString(), icon: Calendar, color: 'sky' },
    { label: 'Total Prize Pool', value: totalPrizePool.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: DollarSign, color: 'amber' },
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

export function TournamentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Tournament | null>(null);

  const columns: Column<Tournament>[] = [
    { key: 'name', label: 'Name', render: (item) => <span className='font-medium'>{item.name}</span> },
    {
      key: 'game_id',
      label: 'Game',
      render: (item) => (
        <span className='font-mono text-xs'>{item.game_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (item) => (
        <Badge variant={typeVariant[item.type] || 'secondary'} className='capitalize text-xs'>
          {item.type}
        </Badge>
      ),
    },
    {
      key: 'entry_fee',
      label: 'Entry Fee',
      render: (item) => (
        <span className='font-mono text-sm'>
          {Number(item.entry_fee) === 0 ? 'Free' : formatAmount(item.entry_fee, item.currency)}
        </span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (item) => <CurrencyBadge currency={item.currency} />,
    },
    {
      key: 'min_players',
      label: 'Players',
      render: (item) => (
        <span className='text-sm text-muted-foreground'>
          {item.min_players}–{item.max_players}
        </span>
      ),
    },
    {
      key: 'prize_pool',
      label: 'Prize Pool',
      render: (item) => (
        <span className='font-mono text-sm font-bold text-emerald-500'>
          {formatAmount(item.prize_pool, item.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'start_date',
      label: 'Start',
      render: (item) => (
        <span className='text-xs text-muted-foreground'>{formatDate(item.start_date)}</span>
      ),
    },
    {
      key: 'end_date',
      label: 'End',
      render: (item) => (
        <span className='text-xs text-muted-foreground'>{formatDate(item.end_date)}</span>
      ),
    },
  ];

  const handleView = (item: Tournament) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: Tournament) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: Tournament) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className='relative'>
      <PageDecoration variant="orange" />
      <div className='relative z-10 space-y-6'>
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shadow-lg shadow-orange-500/10">
            <Trophy className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tournament Management</h1>
            <p className="text-sm text-muted-foreground">Create and manage competitive gaming tournaments with prize pools and leaderboards</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-orange-500/30 via-orange-500/10 to-transparent" />
      </div>

      <TournamentsSummaryCards />

      <DataTable<Tournament>
        entity='Tournament'
        columns={columns}
        filterKey='name'
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel='Create Tournament'
        title='Tournaments'
        statusFilters={[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Active', value: 'active' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename='tournaments'
        dateRangeKey="start_date"
      />

      <EntityDialog
        entity='Tournament'
        title='Tournament'
        description='Create a new tournament.'
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity='Tournament'
        title='Tournament'
        description='Update tournament status.'
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem ? { status: selectedItem.status } : undefined}
      />

      <DetailDialog
        title='Tournament'
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity='Tournament'
        entityName='Tournament'
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      </div>
    </div>
  );
}
