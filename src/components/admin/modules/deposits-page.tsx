'use client';

import React, { useMemo, useState } from 'react';
import type { Deposit } from '@/types/tols';
import { CurrencyBadge, StatusBadge, formatDate, formatAmount, truncateAddress } from '@/lib/tols-utils';
import { ArrowDownToLine, BarChart3, GitBranch } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { EntityExplorer } from '@/components/admin/shared/entity-explorer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTolsQuery } from '@/lib/tols-hooks';
import { StatsBarChart } from '@/components/admin/shared/stats-bar-chart';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#22c55e',
  pending: 'var(--color-pending)',
  failed: 'var(--color-loss)',
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
    required: true,
  },
  {
    key: 'chain',
    label: 'Chain',
    type: 'text',
    placeholder: 'e.g. ethereum, bitcoin, solana',
    required: true,
  },
  {
    key: 'tx_hash',
    label: 'Transaction Hash',
    type: 'text',
    placeholder: 'Enter transaction hash',
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
      { label: 'Confirmed', value: 'confirmed' },
      { label: 'Failed', value: 'failed' },
    ],
  },
];

function DepositStatusChart() {
  const { data, isLoading } = useTolsQuery<Deposit>('Deposit', { limit: 100 });
  const deposits = data?.data || [];

  const chartData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    deposits.forEach((d) => {
      const s = d.status || 'unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    return ['confirmed', 'pending', 'failed']
      .map((name) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: statusMap[name] || 0,
        color: STATUS_COLORS[name] || '#6b7280',
      }))
      .filter((d) => d.value > 0);
  }, [deposits]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Deposit Status Distribution
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

export function DepositsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Deposit | null>(null);
  const [viewItem, setViewItem] = useState<Record<string, unknown> | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerDepositId, setExplorerDepositId] = useState<string | null>(null);

  const columns: Column<Deposit>[] = [
    {
      key: 'user_id',
      label: 'User ID',
      render: (d) => (
        <span className="font-mono text-xs">{d.user_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'wallet_id',
      label: 'Wallet ID',
      render: (d) => (
        <span className="font-mono text-xs">{d.wallet_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (d) => <CurrencyBadge currency={d.currency} />,
    },
    {
      key: 'chain',
      label: 'Chain',
      render: (d) => (
        <span className="capitalize text-sm">{d.chain}</span>
      ),
    },
    {
      key: 'tx_hash',
      label: 'Tx Hash',
      render: (d) => (
        <span className="font-mono text-xs">{truncateAddress(d.tx_hash)}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (d) => (
        <span className="font-mono text-sm font-medium">{formatAmount(d.amount, d.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (d) => formatDate(d.created_date),
    },
  ];

  return (
    <div className="relative">
      <PageDecoration variant="amber" />
      <div className="relative z-10 space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <ArrowDownToLine className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deposit Management</h1>
            <p className="text-sm text-muted-foreground">Monitor and manage cryptocurrency deposit transactions</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
      </div>

      <DepositStatusChart />

      <DataTable<Deposit>
        entity="Deposit"
        columns={columns}
        filterKey="tx_hash"
        title="Deposit Management"
        createLabel="Add Deposit"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => setViewItem(item as unknown as Record<string, unknown>)}
        onEdit={setEditItem}
        statusFilters={[
          { label: 'Pending', value: 'pending' },
          { label: 'Confirmed', value: 'confirmed' },
          { label: 'Failed', value: 'failed' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="deposits"
        dateRangeKey="created_date"
        extraActions={(deposit) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-purple-500 hover:text-purple-600"
            onClick={() => {
              setExplorerDepositId(deposit.id);
              setExplorerOpen(true);
            }}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </Button>
        )}
      />

      <EntityDialog
        entity="Deposit"
        title="Deposit"
        description="Record a new deposit"
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="Deposit"
        title="Deposit"
        description="Update deposit status"
        fields={editFields}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        editId={editItem?.id}
        defaultValues={editItem ? { status: editItem.status } : undefined}
      />

      <DetailDialog
        title="Deposit"
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        data={viewItem}
      />

      <EntityExplorer
        entityType="Deposit"
        entityId={explorerDepositId || ''}
        open={explorerOpen}
        onOpenChange={setExplorerOpen}
      />
      </div>
    </div>
  );
}
