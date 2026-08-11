'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, CurrencyBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { CardPack } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Layers, CheckCircle2, BarChart3 } from 'lucide-react';

const ENTITY = 'CardPack';

const currencyOptions = [
  { label: 'BTC', value: 'BTC' },
  { label: 'ETH', value: 'ETH' },
  { label: 'SOL', value: 'SOL' },
  { label: 'USDT', value: 'USDT' },
  { label: 'USDC', value: 'USDC' },
];

const createFields: FieldConfig[] = [
  { key: 'name', label: 'Pack Name', type: 'text', required: true, placeholder: 'e.g. Fire Starter Pack' },
  { key: 'price', label: 'Price', type: 'number', required: true, placeholder: '0.00' },
  { key: 'currency', label: 'Currency', type: 'select', required: true, options: currencyOptions },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe what this pack contains...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Discontinued', value: 'discontinued' },
    ],
  },
];

const editFields: FieldConfig[] = [
  { key: 'name', label: 'Pack Name', type: 'text', required: true, placeholder: 'Pack name' },
  { key: 'price', label: 'Price', type: 'number', required: true, placeholder: '0.00' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Pack description...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Discontinued', value: 'discontinued' },
    ],
  },
];

function CardPacksSummaryCards() {
  const { data, isLoading } = useTolsQuery<CardPack>(ENTITY, { limit: 200 });
  const packs = data?.data || [];

  const totalPacks = packs.length;
  const availablePacks = packs.filter((p) => p.status === 'active').length;
  const avgPrice = totalPacks > 0
    ? (packs.reduce((sum, p) => sum + Number(p.price || 0), 0) / totalPacks).toFixed(2)
    : '0.00';
  const discontinuedPacks = packs.filter((p) => p.status === 'discontinued').length;

  const cards = [
    { label: 'Total Packs', value: totalPacks.toLocaleString(), icon: Package, color: 'teal' },
    { label: 'Available Packs', value: availablePacks.toLocaleString(), icon: CheckCircle2, color: 'emerald' },
    { label: 'Discontinued', value: discontinuedPacks.toLocaleString(), icon: Layers, color: 'rose' },
    { label: 'Avg Price', value: avgPrice, icon: BarChart3, color: 'amber' },
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

export function CardPacksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<CardPack | null>(null);

  const columns: Column<CardPack>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (item) => <span className="font-medium">{item.name}</span>,
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
      key: 'description',
      label: 'Description',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground cursor-default hover:underline line-clamp-1 max-w-[200px]">
              {item.description?.length > 50 ? item.description.slice(0, 50) + '...' : item.description || '—'}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-sm whitespace-pre-wrap">{item.description || 'No description'}</p>
          </TooltipContent>
        </Tooltip>
      ),
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
            <Package className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Card Packs</h1>
            <p className="text-sm text-muted-foreground">Configure purchasable card packs, pricing, card distributions, and opening statistics</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent" />
      </div>

      <CardPacksSummaryCards />

      <DataTable<CardPack>
        entity={ENTITY}
        columns={columns}
        filterKey="name"
        title="Card Packs"
        createLabel="New Pack"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
      />

      <EntityDialog
        entity={ENTITY}
        title="Card Pack"
        description="Create a new card pack that users can purchase."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Card Pack"
        description="Update card pack details."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected
          ? { name: selected.name, price: selected.price, description: selected.description, status: selected.status }
          : undefined}
      />

      <DetailDialog
        title="Card Pack"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Card Pack"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
