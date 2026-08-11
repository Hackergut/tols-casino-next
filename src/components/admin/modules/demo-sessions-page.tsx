'use client';

import React, { useState } from 'react';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatDate } from '@/lib/tols-utils';
import type { DemoSession } from '@/types/tols';
import { useTolsQuery } from '@/lib/tols-hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Wallet, CreditCard, Gamepad2 } from 'lucide-react';

const createFields: FieldConfig[] = [
  { key: 'user_id', label: 'User ID', type: 'text', required: true, placeholder: 'User ID' },
  { key: 'initial_balance', label: 'Initial Balance', type: 'number', required: true, placeholder: '10000', description: 'Starting demo credits' },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Ended', value: 'ended' },
    ],
  },
];

function SummaryCards() {
  const { data, isLoading } = useTolsQuery<DemoSession>('DemoSession', { limit: 100 });
  const sessions = data?.data || [];

  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const totalSessions = sessions.length;
  const avgCredits = totalSessions > 0
    ? Math.round(sessions.reduce((sum, s) => sum + Number(s.initial_balance || 0), 0) / totalSessions)
    : 0;

  const cards = [
    { label: 'Active Sessions', value: activeSessions.toLocaleString(), icon: Users, color: 'text-emerald-500' },
    { label: 'Total Sessions', value: totalSessions.toLocaleString(), icon: CreditCard, color: 'text-foreground' },
    { label: 'Avg Credits / Session', value: avgCredits.toLocaleString(), icon: Wallet, color: 'text-amber-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border bg-card p-4 flex flex-col gap-1.5"
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

export function DemoSessionsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DemoSession | null>(null);

  const columns: Column<DemoSession>[] = [
    {
      key: 'user_id',
      label: 'User',
      render: (item) => (
        <span className="font-mono text-xs">{item.user_id?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'initial_balance',
      label: 'Initial Balance',
      render: (item) => (
        <span className="font-mono text-sm">{Number(item.initial_balance).toLocaleString()}</span>
      ),
    },
    {
      key: 'current_balance',
      label: 'Current Balance',
      render: (item) => {
        const diff = Number(item.current_balance) - Number(item.initial_balance);
        const isPositive = diff >= 0;
        return (
          <span className={`font-mono text-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {Number(item.current_balance).toLocaleString()}
            <span className="text-[10px] ml-1">({isPositive ? '+' : ''}{diff.toLocaleString()})</span>
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.created_date)}</span>,
    },
  ];

  const handleView = (item: DemoSession) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: DemoSession) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: DemoSession) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Gamepad2 className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Demo Sessions</h1>
            <p className="text-sm text-muted-foreground">Track play-money sessions and demo gameplay activity</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
      </div>

      <SummaryCards />

      <DataTable<DemoSession>
        entity="DemoSession"
        columns={columns}
        filterKey="user_id"
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel="New Session"
        title="Demo Sessions"
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity="DemoSession"
        title="Demo Session"
        description="Create a new demo play session for a user."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="DemoSession"
        title="Demo Session"
        description="Update demo session status."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem ? { status: selectedItem.status } : undefined}
      />

      <DetailDialog
        title="Demo Session"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity="DemoSession"
        entityName="Demo Session"
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
