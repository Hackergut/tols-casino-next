'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { StatusBadge, formatAmount, formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { Affiliate } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Handshake } from 'lucide-react';

const ENTITY = 'Affiliate';

const createFields: FieldConfig[] = [
  { key: 'code', label: 'Affiliate Code', type: 'text', required: true, placeholder: 'e.g. PARTNER2024', description: 'Unique referral code for this affiliate' },
  { key: 'user_id', label: 'User ID', type: 'text', placeholder: 'Link to existing user (optional)' },
  { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'e.g. CryptoStream' },
  { key: 'commission_rate', label: 'Commission Rate (%)', type: 'number', placeholder: '5.0', description: 'Percentage commission on referred activity' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Suspended', value: 'suspended' },
      { label: 'Closed', value: 'closed' },
    ],
  },
];

const editFields: FieldConfig[] = [
  { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'Affiliate name' },
  { key: 'commission_rate', label: 'Commission Rate (%)', type: 'number', placeholder: '5.0' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Suspended', value: 'suspended' },
      { label: 'Closed', value: 'closed' },
    ],
  },
];

function SummaryCards() {
  const { data } = useTolsQuery<Affiliate>(ENTITY, { limit: 999, sort_by: '-created_date' });
  const items = data?.data || [];

  const totalAffiliates = items.length;
  const activeCount = items.filter((a) => a.status === 'active').length;
  const totalPaid = items.reduce((sum, a) => sum + (a.total_earned || 0), 0);

  const cards = [
    { label: 'Total Affiliates', value: totalAffiliates, icon: Users, color: 'text-primary' },
    { label: 'Active', value: activeCount, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Total Paid Out', value: totalPaid.toLocaleString(), icon: DollarSign, color: 'text-amber-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
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

export function AffiliatesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Affiliate | null>(null);

  const columns: Column<Affiliate>[] = [
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
      key: 'user_id',
      label: 'User ID',
      render: (item) =>
        item.user_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs cursor-default hover:underline">{item.user_id.slice(0, 8)}...</span>
            </TooltipTrigger>
            <TooltipContent><p className="font-mono text-xs">{item.user_id}</p></TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'commission_rate',
      label: 'Commission',
      render: (item) => <span className="font-medium text-emerald-500">{item.commission_rate}%</span>,
    },
    {
      key: 'total_earned',
      label: 'Total Earned',
      render: (item) => <span className="font-medium">{formatAmount(item.total_earned)}</span>,
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
            <Handshake className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Affiliate Partners</h1>
            <p className="text-sm text-muted-foreground">Manage marketing affiliates and commission structures</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />
      </div>

      <SummaryCards />

      <DataTable<Affiliate>
        entity={ENTITY}
        columns={columns}
        filterKey="name"
        title="Affiliate Partners"
        createLabel="New Affiliate"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
        statusFilters={[
          { label: 'Active', value: 'active' },
          { label: 'Suspended', value: 'suspended' },
          { label: 'Closed', value: 'closed' },
        ]}
        selectable
        bulkStatusChange
        exportable
        exportFilename="affiliates"
      />

      <EntityDialog
        entity={ENTITY}
        title="Affiliate"
        description="Register a new affiliate partner with a unique code."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Affiliate"
        description="Update affiliate name, commission rate, or status."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected
          ? { name: selected.name, commission_rate: selected.commission_rate, status: selected.status }
          : undefined}
      />

      <DetailDialog
        title="Affiliate"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Affiliate"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
