'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { MarketListing } from '@/types/tols';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Store, Package, DollarSign, CheckCircle2 } from 'lucide-react';

const ENTITY = 'MarketListing';

const createFields: FieldConfig[] = [
  { key: 'seller_user_id', label: 'Seller User ID', type: 'text', required: true, placeholder: 'Enter user ID' },
  {
    key: 'item_type',
    label: 'Item Type',
    type: 'select',
    required: true,
    options: [{ label: 'Collectible Card', value: 'collectible_card' }],
  },
  { key: 'item_id', label: 'Item ID', type: 'text', required: true, placeholder: 'Enter item ID' },
  { key: 'price', label: 'Price', type: 'number', required: true, placeholder: '0.00' },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    required: true,
    options: [
      { label: 'BTC', value: 'BTC' },
      { label: 'ETH', value: 'ETH' },
      { label: 'SOL', value: 'SOL' },
      { label: 'USDT', value: 'USDT' },
      { label: 'USDC', value: 'USDC' },
    ],
  },
];

const editFields: FieldConfig[] = [
  { key: 'price', label: 'Price', type: 'number', required: true, placeholder: '0.00' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { label: 'Listed', value: 'listed' },
      { label: 'Sold', value: 'sold' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
  },
];

function MarketplaceSummaryCards() {
  const { data, isLoading } = useTolsQuery<MarketListing>(ENTITY, { limit: 200 });
  const listings = data?.data || [];

  const totalListings = listings.length;
  const activeListings = listings.filter((l) => l.status === 'listed').length;
  const soldItems = listings.filter((l) => l.status === 'sold').length;
  const totalVolume = listings.filter((l) => l.status === 'sold').reduce((sum, l) => sum + Number(l.price || 0), 0);

  const cards = [
    { label: 'Total Listings', value: totalListings.toLocaleString(), icon: Store, color: 'teal' },
    { label: 'Active Listings', value: activeListings.toLocaleString(), icon: Package, color: 'emerald' },
    { label: 'Sold Items', value: soldItems.toLocaleString(), icon: CheckCircle2, color: 'sky' },
    { label: 'Total Volume', value: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: DollarSign, color: 'amber' },
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

export function MarketplacePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<MarketListing | null>(null);

  const columns: Column<MarketListing>[] = [
    {
      key: 'seller_user_id',
      label: 'Seller',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.seller_user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.seller_user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'item_type',
      label: 'Item Type',
      render: (item) => <Badge variant="outline" className="capitalize">{item.item_type?.replace('_', ' ')}</Badge>,
    },
    {
      key: 'item_id',
      label: 'Item ID',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.item_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.item_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (item) => <span className="font-medium">{formatAmount(item.price, item.currency)}</span>,
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
          <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center shadow-lg shadow-teal-500/10">
            <Store className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
            <p className="text-sm text-muted-foreground">Monitor and manage player-to-player item listings, trades, and transaction volume</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent" />
      </div>

      <MarketplaceSummaryCards />

      <DataTable<MarketListing>
        entity={ENTITY}
        columns={columns}
        filterKey="seller_user_id"
        title="Market Listings"
        createLabel="New Listing"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
        statusFilters={[
          { label: 'Listed', value: 'listed' },
          { label: 'Sold', value: 'sold' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="marketplace"
        dateRangeKey="created_date"
      />

      <EntityDialog
        entity={ENTITY}
        title="Market Listing"
        description="Create a new marketplace listing for an item."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Market Listing"
        description="Update the listing price or status."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected ? { price: selected.price, status: selected.status } : undefined}
      />

      <DetailDialog
        title="Market Listing"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Market Listing"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
