'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { ResponsibleLimit } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Shield, AlertTriangle, Users } from 'lucide-react';

const ENTITY = 'ResponsibleLimit';

const createFields: FieldConfig[] = [
  { key: 'user_id', label: 'User ID', type: 'text', required: true, placeholder: 'Enter user ID' },
  {
    key: 'type',
    label: 'Limit Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Deposit Daily', value: 'deposit_daily' },
      { label: 'Wager Weekly', value: 'wager_weekly' },
      { label: 'Loss Monthly', value: 'loss_monthly' },
      { label: 'Session Time (minutes)', value: 'session_time_minutes' },
    ],
  },
  { key: 'limit_value', label: 'Limit Value', type: 'number', required: true, placeholder: '0', description: 'The maximum allowed value for this limit type' },
];

const editFields: FieldConfig[] = [
  { key: 'limit_value', label: 'Limit Value', type: 'number', required: true, placeholder: '0' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Paused', value: 'paused' },
      { label: 'Expired', value: 'expired' },
    ],
  },
];

function typeColor(type: string) {
  switch (type) {
    case 'deposit_daily': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    case 'wager_weekly': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'loss_monthly': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'session_time_minutes': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function typeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function UsageProgressBar({ current, limit }: { current: number; limit: number }) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  let barColor = 'bg-emerald-500';
  if (pct >= 80) barColor = 'bg-red-500';
  else if (pct >= 50) barColor = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function ResponsibleGamingSummaryCards() {
  const { data, isLoading } = useTolsQuery<ResponsibleLimit>(ENTITY, { limit: 200 });
  const limits = data?.data || [];

  const totalLimits = limits.length;
  const activeLimits = limits.filter((l) => l.status === 'active').length;
  const reachedLimits = limits.filter((l) => {
    const pct = l.limit_value > 0 ? (l.current_usage || 0) / l.limit_value : 0;
    return pct >= 0.8;
  }).length;
  const usersWithLimits = new Set(limits.map((l) => l.user_id)).size;

  const cards = [
    { label: 'Total Limits', value: totalLimits.toLocaleString(), icon: Shield, color: 'sky' },
    { label: 'Active Limits', value: activeLimits.toLocaleString(), icon: ShieldCheck, color: 'emerald' },
    { label: 'Near Limit (80%+)', value: reachedLimits.toLocaleString(), icon: AlertTriangle, color: 'amber' },
    { label: 'Users with Limits', value: usersWithLimits.toLocaleString(), icon: Users, color: 'purple' },
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

export function ResponsibleGamingPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<ResponsibleLimit | null>(null);

  const columns: Column<ResponsibleLimit>[] = [
    {
      key: 'user_id',
      label: 'User',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor(item.type)}`}>
          {typeLabel(item.type)}
        </span>
      ),
    },
    {
      key: 'limit_value',
      label: 'Limit',
      render: (item) => <span className="font-medium font-mono text-sm">{item.limit_value?.toLocaleString()}</span>,
    },
    {
      key: 'current_usage',
      label: 'Usage',
      render: (item) => (
        <UsageProgressBar current={item.current_usage || 0} limit={item.limit_value || 1} />
      ),
    },
    {
      key: 'period_start',
      label: 'Period Start',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.period_start)}</span>,
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

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <ShieldCheck className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Responsible Gaming</h1>
            <p className="text-sm text-muted-foreground">Monitor player protection limits, self-exclusion settings, and compliance status</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />
      </div>

      <ResponsibleGamingSummaryCards />

      <DataTable<ResponsibleLimit>
        entity={ENTITY}
        columns={columns}
        filterKey="user_id"
        title="Gaming Limits"
        createLabel="New Limit"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
      />

      <EntityDialog
        entity={ENTITY}
        title="Gaming Limit"
        description="Set a new responsible gaming limit for a user."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Gaming Limit"
        description="Update the limit value or pause/resume."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected
          ? { limit_value: selected.limit_value, status: selected.status }
          : undefined}
      />

      <DetailDialog
        title="Gaming Limit"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Gaming Limit"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
