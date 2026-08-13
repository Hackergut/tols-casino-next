'use client';

import React, { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Withdrawal {
  id: string;
  userId: string;
  username: string;
  email: string;
  amount: number;
  currency: string;
  chain: string;
  walletAddress: string;
  status: string;
  txHash: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  processedDate: string | null;
  createdAt: string;
}

type ActionType = 'approve' | 'reject';

const STATUS_BADGE: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  approved: { variant: 'default', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
};

export default function WithdrawalsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [search, setSearch] = useState('');
  const [actionItem, setActionItem] = useState<{ w: Withdrawal; action: ActionType } | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Fetch withdrawals
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '200');
      const res = await fetch(`/api/ops/withdrawals?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as {
        pendingCount: number;
        pendingAmount: number;
        totalCount: number;
        withdrawals: Withdrawal[];
      };
    },
    refetchInterval: 15000,
  });

  // Process withdrawal mutation
  const processMutation = useMutation({
    mutationFn: async (params: { id: string; action: ActionType; txHash?: string; reason?: string }) => {
      const res = await fetch('/api/ops/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setActionItem(null);
      setTxHashInput('');
      setRejectReason('');
    },
  });

  // Filtered data
  const filteredWithdrawals = useMemo(() => {
    if (!data?.withdrawals) return [];
    if (!search.trim()) return data.withdrawals;
    const q = search.toLowerCase();
    return data.withdrawals.filter(
      (w) =>
        w.username.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.walletAddress.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
    );
  }, [data?.withdrawals, search]);

  // Table columns
  const columns: ColumnDef<Withdrawal>[] = useMemo(
    () => [
      {
        accessorKey: 'username',
        header: 'Player',
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.username || 'Unknown'}</span>
            <br />
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            ${row.original.amount.toFixed(2)} <span className="text-xs text-muted-foreground">{row.original.currency}</span>
          </span>
        ),
      },
      {
        accessorKey: 'chain',
        header: 'Chain',
        cell: ({ row }) => <span className="uppercase text-xs font-medium">{row.original.chain}</span>,
      },
      {
        accessorKey: 'walletAddress',
        header: 'Address',
        cell: ({ row }) => (
          <span className="font-mono text-xs max-w-[160px] truncate block" title={row.original.walletAddress}>
            {row.original.walletAddress}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = STATUS_BADGE[row.original.status] ?? { variant: 'secondary' as const, label: row.original.status };
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Requested',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (row.original.status !== 'pending') {
            return <span className="text-xs text-muted-foreground">\u2014</span>;
          }
          return (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => setActionItem({ w: row.original, action: 'approve' })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => setActionItem({ w: row.original, action: 'reject' })}
              >
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredWithdrawals,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.pendingCount} pending (${data.pendingAmount.toFixed(2)} total) \u00b7 {data.totalCount} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search player, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 h-9"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <Button
            key={s || 'all'}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            className="h-8 text-xs"
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-destructive">Failed to load withdrawals</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No withdrawals found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approve Dialog */}
      {actionItem?.action === 'approve' && (
        <ConfirmDialog
          open
          title="Approve Withdrawal"
          description={`Approve $${actionItem.w.amount} ${actionItem.w.currency} to ${actionItem.w.walletAddress}?`}
          confirmLabel={processMutation.isPending ? 'Processing...' : 'Approve & Send'}
          destructive={false}
          onConfirm={() => {
            processMutation.mutate({
              id: actionItem.w.id,
              action: 'approve',
              txHash: txHashInput.trim() || undefined,
            });
          }}
          onCancel={() => { setActionItem(null); setTxHashInput(''); }}
        >
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-sm font-medium">Transaction Hash (required)</label>
              <Input
                placeholder="Paste the on-chain tx hash..."
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                className="mt-1"
              />
            </div>
            {processMutation.isError && (
              <p className="text-sm text-destructive">{(processMutation.error as Error).message}</p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {/* Reject Dialog */}
      {actionItem?.action === 'reject' && (
        <ConfirmDialog
          open
          title="Reject Withdrawal"
          description={`Reject and refund $${actionItem.w.amount} ${actionItem.w.currency} back to ${actionItem.w.username}'s balance?`}
          confirmLabel={processMutation.isPending ? 'Processing...' : 'Reject & Refund'}
          destructive
          onConfirm={() => {
            processMutation.mutate({
              id: actionItem.w.id,
              action: 'reject',
              reason: rejectReason.trim() || undefined,
            });
          }}
          onCancel={() => { setActionItem(null); setRejectReason(''); }}
        >
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                placeholder="e.g. Suspicious activity, KYC required..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
              />
            </div>
            {processMutation.isError && (
              <p className="text-sm text-destructive">{(processMutation.error as Error).message}</p>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
