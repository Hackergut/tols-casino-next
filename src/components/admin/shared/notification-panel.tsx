'use client';

import React from 'react';
import { Bell, ArrowUpFromLine, ArrowDownToLine, Trophy, UserPlus, ChevronRight, Inbox } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTolsQuery } from '@/lib/tols-hooks';
import { useAdminStore, type AdminPage } from '@/stores/admin';
import type { Withdrawal, Deposit, Tournament, User } from '@/types/tols';

interface NotificationItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  page: AdminPage;
  count: number;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const Icon = item.icon;

  return (
    <button
      onClick={() => {
        setCurrentPage(item.page);
      }}
      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left group"
    >
      <div className={`rounded-lg p-2 shrink-0 ${item.iconBg}`}>
        <Icon className={`h-4 w-4 ${item.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {item.count > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0 tabular-nums">
              {item.count}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground/70">{item.time}</span>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            View <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function NotificationPanel({
  pendingWithdrawals: propPendingWithdrawals,
  pendingDeposits: propPendingDeposits,
  activeTournaments: propActiveTournaments,
  recentUsers: propRecentUsers,
}: {
  pendingWithdrawals?: number;
  pendingDeposits?: number;
  activeTournaments?: number;
  recentUsers?: number;
}) {
  const [open, setOpen] = React.useState(false);

  // Self-contained data fetching when props not provided
  const withdrawalsQuery = useTolsQuery<Withdrawal>('Withdrawal', { limit: 100 });
  const depositsQuery = useTolsQuery<Deposit>('Deposit', { limit: 100 });
  const tournamentsQuery = useTolsQuery<Tournament>('Tournament', { limit: 50 });
  const usersQuery = useTolsQuery<User>('User', { limit: 100 });

  const isLoading =
    withdrawalsQuery.isLoading ||
    depositsQuery.isLoading ||
    tournamentsQuery.isLoading ||
    usersQuery.isLoading;

  const withdrawals = withdrawalsQuery.data?.data || [];
  const deposits = depositsQuery.data?.data || [];
  const tournaments = tournamentsQuery.data?.data || [];
  const users = usersQuery.data?.data || [];

  const pendingWithdrawals = propPendingWithdrawals ?? withdrawals.filter((w) => w.status === 'pending').length;
  const pendingDeposits = propPendingDeposits ?? deposits.filter((d) => d.status === 'pending').length;
  const activeTournaments = propActiveTournaments ?? tournaments.filter((t) => t.status === 'active' || t.status === 'upcoming').length;
  const recentUsers = propRecentUsers ?? users.filter((u) => {
    if (!u.created_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return u.created_date.slice(0, 10) === today;
  }).length;

  const totalCount = pendingWithdrawals + pendingDeposits + activeTournaments + recentUsers;

  const notifications: NotificationItem[] = [
    {
      id: 'pending-withdrawals',
      icon: ArrowUpFromLine,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10',
      title: 'Pending Withdrawals',
      description: `${pendingWithdrawals} withdrawal${pendingWithdrawals !== 1 ? 's' : ''} awaiting review`,
      time: 'Requires action',
      page: 'withdrawals',
      count: pendingWithdrawals,
    },
    {
      id: 'pending-deposits',
      icon: ArrowDownToLine,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      title: 'Pending Deposits',
      description: `${pendingDeposits} deposit${pendingDeposits !== 1 ? 's' : ''} pending confirmation`,
      time: 'Awaiting confirmation',
      page: 'deposits',
      count: pendingDeposits,
    },
    {
      id: 'active-tournaments',
      icon: Trophy,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10',
      title: 'Active Tournaments',
      description: `${activeTournaments} tournament${activeTournaments !== 1 ? 's' : ''} currently running`,
      time: 'Live now',
      page: 'tournaments',
      count: activeTournaments,
    },
    {
      id: 'new-users',
      icon: UserPlus,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-500/10',
      title: 'New Users Today',
      description: `${recentUsers} new user${recentUsers !== 1 ? 's' : ''} registered today`,
      time: 'Today',
      page: 'users',
      count: recentUsers,
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
              <span className="text-[10px] font-bold leading-none text-destructive-foreground">
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            </span>
          )}
          {totalCount === 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        {/* Subtle gradient header accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-t-lg" />
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
              <Bell className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {totalCount}
              </Badge>
            )}
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="p-2 space-y-1">
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </div>
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Everything is running smoothly</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {notifications.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </ScrollArea>
        {totalCount > 0 && (
          <>
            <Separator />
            <div className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Mark all as reviewed
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
