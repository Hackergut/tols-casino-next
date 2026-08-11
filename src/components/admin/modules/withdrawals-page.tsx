'use client';

import React, { useMemo, useState } from 'react';
import type { Withdrawal } from '@/types/tols';
import { CurrencyBadge, StatusBadge, formatDate, formatAmount, truncateAddress } from '@/lib/tols-utils';
import { ArrowUpFromLine, BarChart3 } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTolsQuery } from '@/lib/tols-hooks';
import { StatsBarChart } from '@/components/admin/shared/stats-bar-chart';

const WITHDRAWAL_STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  pending: 'var(--color-pending)',
  approved: '#3b82f6',
  processing: 'var(--color-vip)',
  rejected: 'var(--color-loss)',
  failed: '#6b7280',
};

const createFields: FieldConfig[] = [
  {
    key: 'user_id',
    label: 'User ID',
    type: 'text',
    placeholder: 'Enter user ID',
    required: true,
  },
  {
    key: 'wallet_id',
    label: 'Wallet ID',
    type: 'text',
    placeholder: 'Enter wallet ID',
    required: true,
  },
  {
    key: 'to_address',
    label: 'To Address',
    type: 'text',
    placeholder: 'Enter destination address',
    required: true,
  },
  {
    key: 'amount',
    label: 'Amount',
    type: 'number',
    placeholder: '0.00',
    required: true,
  },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Approved', value: 'approved' },
      { label: 'Processing', value: 'processing' },
      { label: 'Completed', value: 'completed' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Failed', value: 'failed' },
    ],
  },
];

function WithdrawalStatusChart() {
  const { data, isLoading } = useTolsQuery<Withdrawal>('Withdrawal', { limit: 100 });
  const withdrawals = data?.data || [];

  const chartData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    withdrawals.forEach((w) => {
      const s = w.status || 'unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    return ['completed', 'pending', 'approved', 'processing', 'rejected', 'failed']
      .map((name) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: statusMap[name] || 0,
        color: WITHDRAWAL_STATUS_COLORS[name] || '#6b7280',
      }))
      .filter((d) => d.value > 0);
  }, [withdrawals]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Withdrawal Status Distribution
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

export function WithdrawalsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Withdrawal | null>(null);
  const [deleteItem, setDeleteItem] = useState<Withdrawal | null>(null);
  const [viewItem, setViewItem] = useState<Record<string, unknown> | null>(null);

  const columns: Column<Withdrawal>[] = [
    {
      key: 'user_id',
      label: 'User ID',
      render: (w) => (
        <span className="font-mono text-xs">{w.user_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'wallet_id',
      label: 'Wallet ID',
      render: (w) => (
        <span className="font-mono text-xs">{w.wallet_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (w) => <CurrencyBadge currency={w.currency} />,
    },
    {
      key: 'chain',
      label: 'Chain',
      render: (w) => (
        <span className="capitalize text-sm">{w.chain}</span>
      ),
    },
    {
      key: 'to_address',
      label: 'To Address',
      render: (w) => (
        <span className="font-mono text-xs">{truncateAddress(w.to_address)}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (w) => (
        <span className="font-mono text-sm font-medium">{formatAmount(w.amount, w.currency)}</span>
      ),
    },
    {
      key: 'fee',
      label: 'Fee',
      render: (w) => (
        <span className="font-mono text-sm text-muted-foreground">{formatAmount(w.fee, w.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (w) => <StatusBadge status={w.status} />,
    },
    {
      key: 'tx_hash',
      label: 'Tx Hash',
      render: (w) => (
        <span className="font-mono text-xs">{w.tx_hash ? truncateAddress(w.tx_hash) : '—'}</span>
      ),
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (w) => formatDate(w.created_date),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <ArrowUpFromLine className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Withdrawal Management</h1>
            <p className="text-sm text-muted-foreground">Review and process withdrawal requests from players</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
      </div>

      <WithdrawalStatusChart />

      <DataTable<Withdrawal>
        entity="Withdrawal"
        columns={columns}
        filterKey="to_address"
        title="Withdrawal Management"
        createLabel="Add Withdrawal"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => setViewItem(item as unknown as Record<string, unknown>)}
        onEdit={setEditItem}
        onDelete={setDeleteItem}
        statusFilters={[
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Processing', value: 'processing' },
          { label: 'Completed', value: 'completed' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Failed', value: 'failed' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="withdrawals"
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity="Withdrawal"
        title="Withdrawal"
        description="Create a new withdrawal"
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="Withdrawal"
        title="Withdrawal"
        description="Update withdrawal status"
        fields={editFields}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        editId={editItem?.id}
        defaultValues={editItem ? { status: editItem.status } : undefined}
      />

      <DetailDialog
        title="Withdrawal"
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        data={viewItem}
      />

      <DeleteDialog
        entity="Withdrawal"
        entityName="Withdrawal"
        itemId={deleteItem?.id || null}
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      />
    </div>
  );
}
