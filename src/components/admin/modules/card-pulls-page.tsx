'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { CardPull } from '@/types/tols';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, History, Star, Shield } from 'lucide-react';

const ENTITY = 'CardPull';

const createFields: FieldConfig[] = [
  { key: 'user_id', label: 'User ID', type: 'text', required: true, placeholder: 'Enter user ID' },
  { key: 'card_pack_id', label: 'Card Pack ID', type: 'text', required: true, placeholder: 'Enter pack ID' },
];

function CardPullsSummaryCards() {
  const { data, isLoading } = useTolsQuery<CardPull>(ENTITY, { limit: 200 });
  const pulls = data?.data || [];

  const totalPulls = pulls.length;
  const allCards = pulls.flatMap((p) => p.cards || []);
  const uniquePackIds = new Set(pulls.map((p) => p.card_pack_id)).size;
  const uniqueUsers = new Set(pulls.map((p) => p.user_id)).size;

  const cards = [
    { label: 'Total Pulls', value: totalPulls.toLocaleString(), icon: History, color: 'teal' },
    { label: 'Cards Pulled', value: allCards.length.toLocaleString(), icon: Package, color: 'purple' },
    { label: 'Unique Packs', value: uniquePackIds.toLocaleString(), icon: Star, color: 'amber' },
    { label: 'Unique Pullers', value: uniqueUsers.toLocaleString(), icon: Shield, color: 'sky' },
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

export function CardPullsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<CardPull | null>(null);

  const columns: Column<CardPull>[] = [
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
      key: 'card_pack_id',
      label: 'Card Pack',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.card_pack_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.card_pack_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'cards',
      label: 'Cards Pulled',
      render: (item) => {
        const cards = item.cards || [];
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="font-medium">
              <Package className="h-3 w-3 mr-1" />
              {cards.length}
            </Badge>
            {cards.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {cards.slice(0, 2).map((c) => c?.slice(0, 6)).join(', ')}
                {cards.length > 2 ? ` +${cards.length - 2}` : ''}
              </span>
            )}
          </div>
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
            <History className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Card Pull History</h1>
            <p className="text-sm text-muted-foreground">View pack opening history, card distribution statistics, and pull activity</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent" />
      </div>

      <CardPullsSummaryCards />

      <DataTable<CardPull>
        entity={ENTITY}
        columns={columns}
        filterKey="user_id"
        title="Card Pulls"
        createLabel="Simulate Pull"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        // No edit or delete — pulls are immutable
      />

      <EntityDialog
        entity={ENTITY}
        title="Card Pull"
        description="Simulate a card pull for a user from a specific pack."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <DetailDialog
        title="Card Pull"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />
    </div>
  );
}
