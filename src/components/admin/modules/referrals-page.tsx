'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { Referral } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Users, CheckCircle2, Clock } from 'lucide-react';

const ENTITY = 'Referral';

const createFields: FieldConfig[] = [
  { key: 'referrer_user_id', label: 'Referrer User ID', type: 'text', required: true, placeholder: 'Enter referrer user ID' },
  { key: 'referred_user_id', label: 'Referred User ID', type: 'text', required: true, placeholder: 'Enter referred user ID' },
  { key: 'code', label: 'Referral Code', type: 'text', required: true, placeholder: 'e.g. FRIEND2024' },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Active', value: 'active' },
      { label: 'Rewarded', value: 'rewarded' },
    ],
  },
  { key: 'reward_amount', label: 'Reward Amount', type: 'number', placeholder: '0.00' },
];

function ReferralsSummaryCards() {
  const { data, isLoading } = useTolsQuery<Referral>(ENTITY, { limit: 200 });
  const referrals = data?.data || [];

  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter((r) => r.status === 'active').length;
  const converted = referrals.filter((r) => r.status === 'rewarded').length;
  const pending = referrals.filter((r) => r.status === 'pending').length;

  const cards = [
    { label: 'Total Referrals', value: totalReferrals.toLocaleString(), icon: UserPlus, color: 'rose' },
    { label: 'Active', value: activeReferrals.toLocaleString(), icon: Users, color: 'emerald' },
    { label: 'Converted', value: converted.toLocaleString(), icon: CheckCircle2, color: 'sky' },
    { label: 'Pending', value: pending.toLocaleString(), icon: Clock, color: 'amber' },
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

export function ReferralsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Referral | null>(null);

  const columns: Column<Referral>[] = [
    {
      key: 'referrer_user_id',
      label: 'Referrer',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.referrer_user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.referrer_user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'referred_user_id',
      label: 'Referred',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.referred_user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.referred_user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      render: (item) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold">
          {item.code}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'reward_amount',
      label: 'Reward',
      render: (item) => <span className="font-medium text-amber-500">{formatAmount(item.reward_amount)}</span>,
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
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <UserPlus className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Referral Program</h1>
            <p className="text-sm text-muted-foreground">Track player-to-player referral conversions, rewards, and program performance</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />
      </div>

      <ReferralsSummaryCards />

      <DataTable<Referral>
        entity={ENTITY}
        columns={columns}
        filterKey="code"
        title="Referrals"
        createLabel="New Referral"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity={ENTITY}
        title="Referral"
        description="Create a new referral link between two users."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Referral"
        description="Update referral status or reward amount."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected
          ? { status: selected.status, reward_amount: selected.reward_amount }
          : undefined}
      />

      <DetailDialog
        title="Referral"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Referral"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
