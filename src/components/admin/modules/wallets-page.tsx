'use client';

import React, { useState } from 'react';
import type { UserWallet } from '@/types/tols';
import { StatusBadge, CurrencyBadge, formatDate, formatAmount, truncateAddress } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import { Wallet, CircleDollarSign, AlertTriangle, CheckCircle2, Clock, GitBranch } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { ActivityTimeline } from '@/components/admin/shared/activity-timeline';
import { EntityExplorer } from '@/components/admin/shared/entity-explorer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const createFields: FieldConfig[] = [
  {
    key: 'user_id',
    label: 'User ID',
    type: 'text',
    placeholder: 'Enter user ID',
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
    type: 'select',
    options: [
      { label: 'Bitcoin', value: 'bitcoin' },
      { label: 'Ethereum', value: 'ethereum' },
      { label: 'Solana', value: 'solana' },
    ],
    required: true,
  },
  {
    key: 'address',
    label: 'Address',
    type: 'text',
    placeholder: 'Enter wallet address',
    required: true,
  },
];

const editFields: FieldConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Locked', value: 'locked' },
      { label: 'Archived', value: 'archived' },
    ],
  },
];

function WalletSummaryCards() {
  const { data, isLoading } = useTolsQuery<UserWallet>('UserWallet', { limit: 200 });
  const wallets = data?.data || [];

  const totalWallets = wallets.length;
  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
  const activeWallets = wallets.filter((w) => w.status === 'active').length;
  const lowBalanceAlerts = wallets.filter((w) => Number(w.balance || 0) < 0.001 && w.status === 'active').length;

  const cards = [
    { label: 'Total Wallets', value: totalWallets.toLocaleString(), icon: Wallet, color: 'emerald' },
    { label: 'Total Balance', value: totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: CircleDollarSign, color: 'amber' },
    { label: 'Active Wallets', value: activeWallets.toLocaleString(), icon: CheckCircle2, color: 'sky' },
    { label: 'Low Balance Alerts', value: lowBalanceAlerts.toLocaleString(), icon: AlertTriangle, color: 'rose' },
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

export function WalletsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<UserWallet | null>(null);
  const [deleteItem, setDeleteItem] = useState<UserWallet | null>(null);
  const [viewItem, setViewItem] = useState<Record<string, unknown> | null>(null);
  const [timelineWalletId, setTimelineWalletId] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerWalletId, setExplorerWalletId] = useState<string | null>(null);

  const columns: Column<UserWallet>[] = [
    {
      key: 'user_id',
      label: 'User ID',
      render: (w) => (
        <span className="font-mono text-xs">{w.user_id.slice(0, 8)}...</span>
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
      key: 'address',
      label: 'Address',
      render: (w) => (
        <span className="font-mono text-xs">{truncateAddress(w.address)}</span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (w) => (
        <span className="font-mono text-sm">{formatAmount(w.balance, w.currency)}</span>
      ),
    },
    {
      key: 'locked_balance',
      label: 'Locked',
      render: (w) => (
        <span className="font-mono text-sm text-muted-foreground">{formatAmount(w.locked_balance, w.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (w) => <StatusBadge status={w.status} />,
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
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wallet Management</h1>
            <p className="text-sm text-muted-foreground">View and manage crypto wallets, balances, and chain addresses for all users</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent" />
      </div>

      <WalletSummaryCards />

      <DataTable<UserWallet>
        entity="UserWallet"
        columns={columns}
        filterKey="address"
        title="Wallet Management"
        createLabel="Add Wallet"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => setViewItem(item as unknown as Record<string, unknown>)}
        onEdit={setEditItem}
        onDelete={setDeleteItem}
        extraActions={(wallet) => (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sky-500 hover:text-sky-600"
                  onClick={() => setTimelineWalletId(wallet.id)}
                >
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="end">
                <div className="border-b px-4 py-3">
                  <h4 className="text-sm font-semibold">Activity Timeline</h4>
                  <p className="text-xs text-muted-foreground">Recent activity for wallet {truncateAddress(wallet.address)}</p>
                </div>
                <ActivityTimeline entityId={wallet.id} entityType="wallet" />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-500 hover:text-purple-600"
              onClick={() => {
                setExplorerWalletId(wallet.id);
                setExplorerOpen(true);
              }}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      />

      <EntityDialog
        entity="UserWallet"
        title="Wallet"
        description="Create a new wallet"
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="UserWallet"
        title="Wallet"
        description="Update wallet status"
        fields={editFields}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        editId={editItem?.id}
        defaultValues={editItem ? { status: editItem.status } : undefined}
      />

      <DetailDialog
        title="Wallet"
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        data={viewItem}
      />

      <DeleteDialog
        entity="UserWallet"
        entityName="Wallet"
        itemId={deleteItem?.id || null}
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      />

      <EntityExplorer
        entityType="UserWallet"
        entityId={explorerWalletId || ''}
        open={explorerOpen}
        onOpenChange={setExplorerOpen}
      />
    </div>
  );
}
