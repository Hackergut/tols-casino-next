'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { CommissionLog } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Receipt } from 'lucide-react';

const ENTITY = 'CommissionLog';

const currencyOptions = [
  { label: 'BTC', value: 'BTC' },
  { label: 'ETH', value: 'ETH' },
  { label: 'SOL', value: 'SOL' },
  { label: 'USDT', value: 'USDT' },
  { label: 'USDC', value: 'USDC' },
];

const createFields: FieldConfig[] = [
  { key: 'affiliate_id', label: 'Affiliate ID', type: 'text', placeholder: 'Enter affiliate ID' },
  { key: 'referrer_user_id', label: 'Referrer User ID', type: 'text', placeholder: 'Enter referrer user ID' },
  {
    key: 'source_type',
    label: 'Source Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Bet', value: 'bet' },
      { label: 'Deposit', value: 'deposit' },
      { label: 'Referral Bonus', value: 'referral_bonus' },
    ],
  },
  { key: 'source_id', label: 'Source ID', type: 'text', required: true, placeholder: 'ID of the source entity' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'currency', label: 'Currency', type: 'select', required: true, options: currencyOptions },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Paid', value: 'paid' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
  },
];

function SummaryCards() {
  const { data } = useTolsQuery<CommissionLog>(ENTITY, { limit: 999, sort_by: '-created_date' });
  const items = data?.data || [];

  const pendingAmount = items
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const paidTotal = items
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const cancelledTotal = items
    .filter((c) => c.status === 'cancelled')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const cards = [
    { label: 'Pending Amount', value: pendingAmount.toLocaleString(), icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Paid Total', value: paidTotal.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Cancelled Total', value: cancelledTotal.toLocaleString(), icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className={`p-2 rounded-lg ${card.bgColor} ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function sourceTypeColor(type: string) {
  switch (type) {
    case 'bet': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'deposit': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    case 'referral_bonus': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function CommissionsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<CommissionLog | null>(null);

  const columns: Column<CommissionLog>[] = [
    {
      key: 'affiliate_id',
      label: 'Affiliate',
      render: (item) =>
        item.affiliate_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs cursor-default hover:underline">{item.affiliate_id.slice(0, 8)}...</span>
            </TooltipTrigger>
            <TooltipContent><p className="font-mono text-xs">{item.affiliate_id}</p></TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'referrer_user_id',
      label: 'Referrer',
      render: (item) =>
        item.referrer_user_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs cursor-default hover:underline">{item.referrer_user_id.slice(0, 8)}...</span>
            </TooltipTrigger>
            <TooltipContent><p className="font-mono text-xs">{item.referrer_user_id}</p></TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'source_type',
      label: 'Source Type',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${sourceTypeColor(item.source_type)}`}>
          {item.source_type?.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'source_id',
      label: 'Source ID',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">{item.source_id?.slice(0, 8)}...</span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.source_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (item) => <span className="font-medium">{formatAmount(item.amount, item.currency)}</span>,
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (item) => <CurrencyBadge currency={item.currency} />,
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
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <Receipt className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Commission Logs</h1>
            <p className="text-sm text-muted-foreground">Review commission payouts and payment status</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />
      </div>

      <SummaryCards />

      <DataTable<CommissionLog>
        entity={ENTITY}
        columns={columns}
        title="Commission Logs"
        createLabel="New Commission"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
        statusFilters={[
          { label: 'Pending', value: 'pending' },
          { label: 'Paid', value: 'paid' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="commissions"
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity={ENTITY}
        title="Commission"
        description="Log a new commission entry."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Commission"
        description="Update commission status."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected ? { status: selected.status } : undefined}
      />

      <DetailDialog
        title="Commission"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Commission"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
