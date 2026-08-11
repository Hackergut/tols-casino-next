'use client';

import React, { useState } from 'react';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { TournamentEntry } from '@/types/tols';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Medal, Trophy, Users, Fingerprint, Target } from 'lucide-react';

const createFields: FieldConfig[] = [
  { key: 'tournament_id', label: 'Tournament ID', type: 'text', required: true, placeholder: 'Tournament ID' },
  { key: 'user_id', label: 'User ID', type: 'text', required: true, placeholder: 'User ID' },
];

const editFields: FieldConfig[] = [
  { key: 'score', label: 'Score', type: 'number', placeholder: '0' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Eliminated', value: 'eliminated' },
      { label: 'Completed', value: 'completed' },
    ],
  },
  { key: 'rank', label: 'Rank', type: 'number', placeholder: '1' },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 text-xs font-bold">
      <Medal className="h-3 w-3" /> 1st
    </span>
  );
  if (rank === 2) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs font-bold">
      <Medal className="h-3 w-3" /> 2nd
    </span>
  );
  if (rank === 3) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 text-xs font-bold">
      <Medal className="h-3 w-3" /> 3rd
    </span>
  );
  return <span className="font-mono text-sm">#{rank}</span>;
}

function TournamentEntriesSummaryCards() {
  const { data, isLoading } = useTolsQuery<TournamentEntry>('TournamentEntry', { limit: 200 });
  const entries = data?.data || [];

  const totalEntries = entries.length;
  const activePlayers = entries.filter((e) => e.status === 'active').length;
  const uniquePlayers = new Set(entries.map((e) => e.user_id)).size;
  const totalWagered = entries.reduce((sum, e) => sum + Number(e.score || 0), 0);

  const cards = [
    { label: 'Total Entries', value: totalEntries.toLocaleString(), icon: Trophy, color: 'orange' },
    { label: 'Active Players', value: activePlayers.toLocaleString(), icon: Users, color: 'emerald' },
    { label: 'Unique Players', value: uniquePlayers.toLocaleString(), icon: Fingerprint, color: 'sky' },
    { label: 'Total Score', value: totalWagered.toLocaleString(), icon: Target, color: 'amber' },
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

export function TournamentEntriesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TournamentEntry | null>(null);

  const columns: Column<TournamentEntry>[] = [
    {
      key: 'tournament_id',
      label: 'Tournament',
      render: (item) => (
        <span className="font-mono text-xs">{item.tournament_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      render: (item) => (
        <span className="font-mono text-xs">{item.user_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: (item) => (
        <span className="font-mono text-sm font-medium">{Number(item.score).toLocaleString()}</span>
      ),
    },
    {
      key: 'rank',
      label: 'Rank',
      render: (item) => <RankBadge rank={item.rank} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'created_date',
      label: 'Joined',
      render: (item) => (
        <span className="text-xs text-muted-foreground">{formatDate(item.created_date)}</span>
      ),
    },
  ];

  const handleView = (item: TournamentEntry) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: TournamentEntry) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: TournamentEntry) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shadow-lg shadow-orange-500/10">
            <Trophy className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tournament Entries</h1>
            <p className="text-sm text-muted-foreground">Track player participation, scores, and leaderboard standings across tournaments</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-orange-500/30 via-orange-500/10 to-transparent" />
      </div>

      <TournamentEntriesSummaryCards />

      <DataTable<TournamentEntry>
        entity="TournamentEntry"
        columns={columns}
        filterKey="status"
        defaultFilter='{"status":"active"}'
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel="Add Entry"
        title="Tournament Entries"
      />

      <EntityDialog
        entity="TournamentEntry"
        title="Tournament Entry"
        description="Register a user for a tournament."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="TournamentEntry"
        title="Tournament Entry"
        description="Update entry score, rank, and status."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem
          ? {
              score: selectedItem.score,
              status: selectedItem.status,
              rank: selectedItem.rank,
            }
          : undefined}
      />

      <DetailDialog
        title="Tournament Entry"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity="TournamentEntry"
        entityName="Tournament Entry"
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
