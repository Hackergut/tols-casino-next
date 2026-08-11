'use client';

import React, { useMemo, useState } from 'react';
import { TrendingUp, DollarSign, BarChart3, Wallet, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { HouseEarning } from '@/types/tols';
import { useTolsQuery } from '@/lib/tols-hooks';
import { CurrencyBadge, formatDate, formatAmount } from '@/lib/tols-utils';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';

export function HouseEarningsPage() {
  const [viewItem, setViewItem] = useState<Record<string, unknown> | null>(null);
  const { data, isLoading } = useTolsQuery<HouseEarning>('HouseEarning', { limit: 200 });

  const earnings = data?.data || [];

  // Summary stats
  const stats = useMemo(() => {
    const total = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const avgPerBet = earnings.length > 0 ? total / earnings.length : 0;

    // Group by currency
    const byCurrency: Record<string, number> = {};
    earnings.forEach((e) => {
      byCurrency[e.currency] = (byCurrency[e.currency] || 0) + (e.amount || 0);
    });

    // Group by game
    const byGame: Record<string, number> = {};
    earnings.forEach((e) => {
      byGame[e.game_id] = (byGame[e.game_id] || 0) + (e.amount || 0);
    });

    const topGame = Object.entries(byGame).sort((a, b) => b[1] - a[1])[0];

    return { total, avgPerBet, byCurrency, topGame, count: earnings.length };
  }, [earnings]);

  const columns: Column<HouseEarning>[] = [
    {
      key: 'bet_id',
      label: 'Bet ID',
      render: (e) => (
        <span className="font-mono text-xs">{e.bet_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'game_id',
      label: 'Game ID',
      render: (e) => (
        <span className="font-mono text-xs">{e.game_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'user_id',
      label: 'User ID',
      render: (e) => (
        <span className="font-mono text-xs">{e.user_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (e) => (
        <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
          +{formatAmount(e.amount, e.currency)}
        </span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (e) => <CurrencyBadge currency={e.currency} />,
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (e) => formatDate(e.created_date),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Landmark className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">House Earnings</h1>
            <p className="text-sm text-muted-foreground">Platform revenue analytics and house profit tracking</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">Total Earnings</CardDescription>
            <div className="rounded-lg p-2 bg-emerald-500">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mb-1" />
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">{stats.count.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">total earning records</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">Avg per Bet</CardDescription>
            <div className="rounded-lg p-2 bg-teal-500">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mb-1" />
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">{stats.avgPerBet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">average per earning</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">Top Game</CardDescription>
            <div className="rounded-lg p-2 bg-purple-500">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mb-1" />
            ) : (
              <>
                <div className="text-lg font-bold tracking-tight truncate">
                  {stats.topGame ? stats.topGame[0].slice(0, 16) + '...' : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.topGame ? `Total: ${stats.topGame[1].toLocaleString()}` : 'No data'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">Currencies</CardDescription>
            <div className="rounded-lg p-2 bg-amber-500">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mb-1" />
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">{Object.keys(stats.byCurrency).length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.keys(stats.byCurrency).length > 0
                    ? Object.entries(stats.byCurrency)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([c]) => c)
                        .join(', ')
                    : 'No data'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Currency Breakdown */}
      {Object.keys(stats.byCurrency).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings by Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.byCurrency)
                .sort((a, b) => b[1] - a[1])
                .map(([currency, amount]) => (
                  <div
                    key={currency}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <CurrencyBadge currency={currency} />
                    <span className="font-mono text-sm font-medium">{amount.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <DataTable<HouseEarning>
        entity="HouseEarning"
        columns={columns}
        filterKey="user_id"
        title="Earnings Records"
        onView={(item) => setViewItem(item as unknown as Record<string, unknown>)}
        dateRangeKey="created_date"
      />

      <DetailDialog
        title="House Earning"
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        data={viewItem}
      />
    </div>
  );
}