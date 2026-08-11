'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { RarityBadge, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { CollectibleCard } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, Layers, Star, Shield, Zap, Crown } from 'lucide-react';

const ENTITY = 'CollectibleCard';

const createFields: FieldConfig[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Dragon Fire' },
  {
    key: 'rarity',
    label: 'Rarity',
    type: 'select',
    required: true,
    options: [
      { label: 'Common', value: 'common' },
      { label: 'Rare', value: 'rare' },
      { label: 'Epic', value: 'epic' },
      { label: 'Legendary', value: 'legendary' },
    ],
  },
  { key: 'image_url', label: 'Image URL', type: 'text', placeholder: 'https://...' },
  {
    key: 'attributes',
    label: 'Attributes (JSON)',
    type: 'textarea',
    placeholder: '{"attack": 50, "defense": 30}',
    description: 'Enter card attributes as a JSON object',
  },
];

const editFields: FieldConfig[] = [
  { key: 'owner_user_id', label: 'Owner User ID', type: 'text', placeholder: 'Enter new owner user ID' },
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Card name' },
];

function CollectiblesSummaryCards() {
  const { data, isLoading } = useTolsQuery<CollectibleCard>(ENTITY, { limit: 200 });
  const cards = data?.data || [];

  const totalCards = cards.length;
  const common = cards.filter((c) => c.rarity === 'common').length;
  const rare = cards.filter((c) => c.rarity === 'rare').length;
  const epic = cards.filter((c) => c.rarity === 'epic').length;
  const legendary = cards.filter((c) => c.rarity === 'legendary').length;

  const summaryCards = [
    { label: 'Total Cards', value: totalCards.toLocaleString(), icon: Layers, color: 'teal' },
    { label: 'Common', value: common.toLocaleString(), icon: Star, color: 'emerald' },
    { label: 'Rare', value: rare.toLocaleString(), icon: Shield, color: 'sky' },
    { label: 'Epic', value: epic.toLocaleString(), icon: Zap, color: 'purple' },
    { label: 'Legendary', value: legendary.toLocaleString(), icon: Crown, color: 'amber' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {summaryCards.map((card) => (
        <Card key={card.label} className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
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

export function CollectiblesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<CollectibleCard | null>(null);

  const columns: Column<CollectibleCard>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'rarity',
      label: 'Rarity',
      render: (item) => <RarityBadge rarity={item.rarity} />,
    },
    {
      key: 'image_url',
      label: 'Image',
      render: (item) =>
        item.image_url ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden border bg-muted">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      key: 'owner_user_id',
      label: 'Owner',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.owner_user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.owner_user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'attributes',
      label: 'Attributes',
      render: (item) => {
        const json = JSON.stringify(item.attributes);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-default hover:underline">
                {json.length > 30 ? json.slice(0, 30) + '...' : json}
              </code>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(item.attributes, null, 2)}</pre>
            </TooltipContent>
          </Tooltip>
        );
      },
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
            <Layers className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Collectible Cards</h1>
            <p className="text-sm text-muted-foreground">Manage digital collectible card assets, rarity distribution, and ownership records</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent" />
      </div>

      <CollectiblesSummaryCards />

      <DataTable<CollectibleCard>
        entity={ENTITY}
        columns={columns}
        filterKey="name"
        title="Collectible Cards"
        createLabel="New Card"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
      />

      <EntityDialog
        entity={ENTITY}
        title="Collectible Card"
        description="Mint a new collectible card with attributes."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Collectible Card"
        description="Update card name or transfer ownership."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected ? { owner_user_id: selected.owner_user_id, name: selected.name } : undefined}
      />

      <DetailDialog
        title="Collectible Card"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Collectible Card"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
