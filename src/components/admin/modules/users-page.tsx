'use client';

import React, { useMemo, useState } from 'react';
import type { User } from '@/types/tols';
import { useTolsQuery, useTolsDelete } from '@/lib/tols-hooks';
import { RoleBadge, StatusBadge, formatDate } from '@/lib/tols-utils';
import { Users, PieChartIcon, UserCircle, Clock, GitBranch } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { UserProfilePanel } from '@/components/admin/shared/user-profile-panel';
import { ActivityTimeline } from '@/components/admin/shared/activity-timeline';
import { EntityExplorer } from '@/components/admin/shared/entity-explorer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { toast } from 'sonner';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

const ROLE_COLORS = ['#22c55e', 'var(--color-vip)', 'var(--color-pending)', '#6b7280'];

const createFields: FieldConfig[] = [
  {
    key: 'username',
    label: 'Username',
    type: 'text',
    placeholder: 'Enter username',
    required: true,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'text',
    placeholder: 'Enter email address',
    required: true,
  },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { label: 'Player', value: 'player' },
      { label: 'Operator', value: 'operator' },
      { label: 'Admin', value: 'admin' },
    ],
    required: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Suspended', value: 'suspended' },
      { label: 'Banned', value: 'banned' },
    ],
    required: true,
  },
];

const editFields: FieldConfig[] = [
  {
    key: 'username',
    label: 'Username',
    type: 'text',
    required: true,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'text',
    required: true,
  },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { label: 'Player', value: 'player' },
      { label: 'Operator', value: 'operator' },
      { label: 'Admin', value: 'admin' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Suspended', value: 'suspended' },
      { label: 'Banned', value: 'banned' },
    ],
  },
];

function UserRolesChart() {
  const { data, isLoading } = useTolsQuery<User>('User', { limit: 100 });
  const users = data?.data || [];

  const chartData = useMemo(() => {
    const roleMap: Record<string, number> = {};
    users.forEach((u) => {
      const r = u.role || 'unknown';
      roleMap[r] = (roleMap[r] || 0) + 1;
    });
    return ['player', 'operator', 'admin']
      .map((name) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: roleMap[name] || 0,
      }))
      .filter((d) => d.value > 0);
  }, [users]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          User Role Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No user data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '10px',
                  fontSize: 12,
                  padding: '10px 14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [deleteItem, setDeleteItem] = useState<User | null>(null);
  const [viewItem, setViewItem] = useState<Record<string, unknown> | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [timelineUserId, setTimelineUserId] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerUserId, setExplorerUserId] = useState<string | null>(null);

  const deleteMutation = useTolsDelete('User');

  const handleBulkDelete = (ids: string[]) => {
    ids.forEach((id) => {
      deleteMutation.mutate(id);
    });
    toast.success(`Deleting ${ids.length} users...`);
  };

  const columns: Column<User>[] = [
    {
      key: 'username',
      label: 'Username',
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (u) => formatDate(u.created_date),
    },
  ];

  const handleOpenProfile = (user: User) => {
    setProfileUserId(user.id);
    setProfileOpen(true);
  };

  return (
    <div className="relative">
      <PageDecoration variant="emerald" />
      <div className="relative z-10 space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage player accounts, roles, and statuses across the platform</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent" />
      </div>

      <UserRolesChart />

      <DataTable<User>
        entity="User"
        columns={columns}
        filterKey="username"
        title="User Management"
        createLabel="Add User"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => setViewItem(item as unknown as Record<string, unknown>)}
        onEdit={setEditItem}
        onDelete={setDeleteItem}
        statusFilters={[
          { label: 'Active', value: 'active' },
          { label: 'Suspended', value: 'suspended' },
          { label: 'Banned', value: 'banned' },
        ]}
        exportable
        exportFilename="users"
        dateRangeKey="created_date"
        selectable
        onBulkDelete={handleBulkDelete}
        extraActions={(user) => (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sky-500 hover:text-sky-600"
                  onClick={() => setTimelineUserId(user.id)}
                >
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="end">
                <div className="border-b px-4 py-3">
                  <h4 className="text-sm font-semibold">Activity Timeline</h4>
                  <p className="text-xs text-muted-foreground">Recent activity for {user.username}</p>
                </div>
                <ActivityTimeline entityId={user.id} entityType="user" />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-500 hover:text-purple-600"
              onClick={() => {
                setExplorerUserId(user.id);
                setExplorerOpen(true);
              }}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
              onClick={() => handleOpenProfile(user)}
            >
              <UserCircle className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      />

      <EntityDialog
        entity="User"
        title="User"
        description="Create a new platform user"
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity="User"
        title="User"
        description="Edit user details"
        fields={editFields}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        editId={editItem?.id}
        defaultValues={
          editItem
            ? {
                username: editItem.username,
                email: editItem.email,
                role: editItem.role,
                status: editItem.status,
              }
            : undefined
        }
      />

      <DetailDialog
        title="User"
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        data={viewItem}
      />

      <DeleteDialog
        entity="User"
        entityName="User"
        itemId={deleteItem?.id || null}
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      />

      <UserProfilePanel
        userId={profileUserId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />

      <EntityExplorer
        entityType="User"
        entityId={explorerUserId || ''}
        open={explorerOpen}
        onOpenChange={setExplorerOpen}
      />
      </div>
    </div>
  );
}
