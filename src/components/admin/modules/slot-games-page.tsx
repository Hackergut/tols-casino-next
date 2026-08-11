'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Column } from '@/components/admin/shared/data-table';
import { DataTable } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { SlotGame } from '@/types/tols';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, Layers, Wrench, Percent } from 'lucide-react';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

const createFields: FieldConfig[] = [
  { key: 'name', label: 'Game Name', type: 'text', required: true, placeholder: 'e.g. Mega Fortune' },
  { key: 'provider', label: 'Provider', type: 'text', required: true, placeholder: 'e.g. Pragmatic Play' },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Classic', value: 'classic' },
      { label: 'Video', value: 'video' },
      { label: 'Megaways', value: 'megaways' },
    ],
  },
  { key: 'rtp', label: 'RTP (%)', type: 'number', placeholder: 'e.g. 96.5', description: 'Return to Player percentage' },
  { key: 'min_bet', label: 'Min Bet', type: 'number', placeholder: '0.01' },
  { key: 'max_bet', label: 'Max Bet', type: 'number', placeholder: '100.00' },
  { key: 'supported_currencies', label: 'Supported Currencies', type: 'array', placeholder: 'BTC, ETH, SOL', description: 'Comma-separated currency codes' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
      { label: 'Maintenance', value: 'maintenance' },
    ],
  },
  { key: 'image_url', label: 'Image URL', type: 'text', placeholder: 'https://example.com/game-image.png' },
];

const editFields: FieldConfig[] = [
  { key: 'name', label: 'Game Name', type: 'text', required: true },
  { key: 'provider', label: 'Provider', type: 'text', required: true },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Classic', value: 'classic' },
      { label: 'Video', value: 'video' },
      { label: 'Megaways', value: 'megaways' },
    ],
  },
  { key: 'rtp', label: 'RTP (%)', type: 'number' },
  { key: 'min_bet', label: 'Min Bet', type: 'number' },
  { key: 'max_bet', label: 'Max Bet', type: 'number' },
  { key: 'supported_currencies', label: 'Supported Currencies', type: 'array', description: 'Comma-separated currency codes' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
      { label: 'Maintenance', value: 'maintenance' },
    ],
  },
  { key: 'image_url', label: 'Image URL', type: 'text' },
];

const typeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  classic: 'outline',
  video: 'default',
  megaways: 'secondary',
};

function SlotGamesSummaryCards() {
  const { data, isLoading } = useTolsQuery<SlotGame>('SlotGame', { limit: 200 });
  const games = data?.data || [];

  const totalGames = games.length;
  const activeGames = games.filter((g) => g.status === 'active').length;
  const maintenanceGames = games.filter((g) => g.status === 'maintenance').length;
  const avgRtp = totalGames > 0
    ? (games.reduce((sum, g) => sum + Number(g.rtp || 0), 0) / totalGames).toFixed(1)
    : '0.0';

  const cards = [
    { label: 'Total Games', value: totalGames.toLocaleString(), icon: Gamepad2, color: 'purple' },
    { label: 'Active Games', value: activeGames.toLocaleString(), icon: Layers, color: 'emerald' },
    { label: 'In Maintenance', value: maintenanceGames.toLocaleString(), icon: Wrench, color: 'amber' },
    { label: 'Average RTP', value: `${avgRtp}%`, icon: Percent, color: 'sky' },
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

export function SlotGamesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SlotGame | null>(null);

  const columns: Column<SlotGame>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.image_url ? (
            <div className="h-8 w-12 rounded overflow-hidden bg-muted flex-shrink-0 relative">
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="48px"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-8 w-12 rounded bg-muted flex-shrink-0 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground font-medium">No img</span>
            </div>
          )}
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    { key: 'provider', label: 'Provider' },
    {
      key: 'type',
      label: 'Type',
      render: (item) => (
        <Badge variant={typeVariant[item.type] || 'secondary'} className="capitalize text-xs">
          {item.type}
        </Badge>
      ),
    },
    {
      key: 'rtp',
      label: 'RTP',
      render: (item) => <span className="font-mono text-sm">{item.rtp}%</span>,
    },
    {
      key: 'min_bet',
      label: 'Min Bet',
      render: (item) => <span className="font-mono text-sm">{Number(item.min_bet).toLocaleString()}</span>,
    },
    {
      key: 'max_bet',
      label: 'Max Bet',
      render: (item) => <span className="font-mono text-sm">{Number(item.max_bet).toLocaleString()}</span>,
    },
    {
      key: 'supported_currencies',
      label: 'Currencies',
      render: (item) => {
        const currencies = Array.isArray(item.supported_currencies) ? item.supported_currencies : [];
        return (
          <div className="flex flex-wrap gap-1">
            {currencies.slice(0, 3).map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                {c}
              </Badge>
            ))}
            {currencies.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{currencies.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const handleView = (item: SlotGame) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleEdit = (item: SlotGame) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: SlotGame) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="relative">
      <PageDecoration variant="purple" />
      <div className="relative z-10 space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Gamepad2 className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Slot Game Catalog</h1>
            <p className="text-sm text-muted-foreground">Manage slot game library, providers, RTP settings, and availability status</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
      </div>

      <SlotGamesSummaryCards />

      <DataTable<SlotGame>
        entity="SlotGame"
        columns={columns}
        filterKey="name"
        onCreate={() => setCreateOpen(true)}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        createLabel="Add Game"
        title="Slot Games"
        statusFilters={[
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Maintenance', value: 'maintenance' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="slot-games"
      />

      <EntityDialog
        entity="SlotGame"
        title="Slot Game"
        description="Add a new slot game to the platform."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="SlotGame"
        title="Slot Game"
        description="Update slot game details."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selectedItem?.id}
        defaultValues={selectedItem ? {
          name: selectedItem.name,
          provider: selectedItem.provider,
          type: selectedItem.type,
          rtp: selectedItem.rtp,
          min_bet: selectedItem.min_bet,
          max_bet: selectedItem.max_bet,
          supported_currencies: Array.isArray(selectedItem.supported_currencies)
            ? selectedItem.supported_currencies.join(', ')
            : '',
          status: selectedItem.status,
          image_url: selectedItem.image_url,
        } : undefined}
      />

      <DetailDialog
        title="Slot Game"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedItem as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity="SlotGame"
        entityName="Slot Game"
        itemId={selectedItem?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      </div>
    </div>
  );
}
