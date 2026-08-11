'use client';

import React from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Gamepad2,
  TrendingUp,
  Calendar,
  Coins,
  Pencil,
  Eye,
  Loader2,
  MinusIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTolsGet, useTolsQuery } from '@/lib/tols-hooks';
import { RoleBadge, StatusBadge, formatDate, formatAmount, CurrencyBadge, truncateAddress } from '@/lib/tols-utils';
import { useAdminStore } from '@/stores/admin';
import type { User, UserWallet, Deposit, Withdrawal, Bet } from '@/types/tols';

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface UserProfilePanelProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfilePanel({ userId, open, onOpenChange }: UserProfilePanelProps) {
  const { data: userData, isLoading: userLoading } = useTolsGet<User>('User', userId);
  const user = userData?.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto p-0">
        {userLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <div className="flex flex-col">
            {/* Header Section */}
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <div
                  className={`h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${getAvatarColor(user.username)}`}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg">{user.username}</SheetTitle>
                  <SheetDescription className="text-xs mt-1">
                    {user.email}
                  </SheetDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <RoleBadge role={user.role} />
                    <StatusBadge status={user.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {formatDate(user.created_date)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1">
              <TabsList className="mx-6 mt-4 w-full grid grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="wallets" className="text-xs">Wallets</TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
                <TabsTrigger value="bets" className="text-xs">Bets</TabsTrigger>
              </TabsList>

              <div className="px-6 pb-6 mt-4">
                <OverviewTab userId={user.id} />
                <WalletsTab userId={user.id} />
                <TransactionsTab userId={user.id} />
                <BetsTab userId={user.id} />
              </div>
            </Tabs>

            <Separator />

            {/* Quick Actions */}
            <div className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <QuickActionButton icon={Pencil} label="Edit User" page="users" />
                <QuickActionButton icon={Wallet} label="View Wallet" page="wallets" />
                <QuickActionButton icon={ArrowDownLeft} label="View Deposits" page="deposits" />
                <QuickActionButton icon={Gamepad2} label="View Bets" page="bets" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            User not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ========================
   Overview Tab
   ======================== */
function OverviewTab({ userId }: { userId: string }) {
  const { data: depositsData } = useTolsQuery<Deposit>('Deposit', {
    q: JSON.stringify({ user_id: userId }),
    limit: 1000,
  });
  const { data: withdrawalsData } = useTolsQuery<Withdrawal>('Withdrawal', {
    q: JSON.stringify({ user_id: userId }),
    limit: 1000,
  });
  const { data: betsData } = useTolsQuery<Bet>('Bet', {
    q: JSON.stringify({ user_id: userId }),
    limit: 1000,
  });

  const deposits = depositsData?.data || [];
  const withdrawals = withdrawalsData?.data || [];
  const bets = betsData?.data || [];

  const totalDeposits = deposits
    .filter((d) => d.status === 'confirmed')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalWithdrawals = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((sum, w) => sum + w.amount, 0);

  const totalBets = bets.reduce((sum, b) => sum + b.bet_amount, 0);

  const wins = bets.filter((b) => b.result === 'win');
  const winRate = bets.length > 0 ? ((wins.length / bets.length) * 100).toFixed(1) : '0.0';

  const totalWinAmount = wins.reduce((sum, b) => sum + b.win_amount, 0);
  const netBalance = totalDeposits - totalWithdrawals - totalBets + totalWinAmount;

  const stats = [
    { icon: ArrowDownLeft, label: 'Total Deposits', value: formatAmount(totalDeposits), color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: ArrowUpRight, label: 'Total Withdrawals', value: formatAmount(totalWithdrawals), color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { icon: Gamepad2, label: 'Total Bets', value: formatAmount(totalBets), color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { icon: TrendingUp, label: 'Win Rate', value: `${winRate}%`, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { icon: Coins, label: 'Balance', value: formatAmount(netBalance), color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { icon: Calendar, label: 'Total Bets', value: String(bets.length), color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <TabsContent value="overview" className="mt-0">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border p-3 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-md ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-sm font-semibold truncate">{stat.value}</span>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}

/* ========================
   Wallets Tab
   ======================== */
function WalletsTab({ userId }: { userId: string }) {
  const { data, isLoading } = useTolsQuery<UserWallet>('UserWallet', {
    q: JSON.stringify({ user_id: userId }),
    limit: 100,
  });
  const wallets = data?.data || [];

  if (isLoading) {
    return (
      <TabsContent value="wallets" className="mt-0">
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </TabsContent>
    );
  }

  if (wallets.length === 0) {
    return (
      <TabsContent value="wallets" className="mt-0">
        <div className="text-center py-8 text-sm text-muted-foreground">
          No wallets found for this user
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="wallets" className="mt-0">
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs">Currency</TableHead>
              <TableHead className="text-xs">Chain</TableHead>
              <TableHead className="text-xs">Balance</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <CurrencyBadge currency={w.currency} />
                </TableCell>
                <TableCell className="text-xs capitalize">{w.chain}</TableCell>
                <TableCell className="text-xs font-medium">{formatAmount(w.balance, w.currency)}</TableCell>
                <TableCell>
                  <StatusBadge status={w.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TabsContent>
  );
}

/* ========================
   Transactions Tab
   ======================== */
interface TransactionItem {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  status: string;
  date: string;
}

function TransactionsTab({ userId }: { userId: string }) {
  const { data: depositsData, isLoading: depLoading } = useTolsQuery<Deposit>('Deposit', {
    q: JSON.stringify({ user_id: userId }),
    limit: 50,
    sort_by: '-created_date',
  });
  const { data: withdrawalsData, isLoading: withLoading } = useTolsQuery<Withdrawal>('Withdrawal', {
    q: JSON.stringify({ user_id: userId }),
    limit: 50,
    sort_by: '-created_date',
  });

  const isLoading = depLoading || withLoading;
  const deposits = depositsData?.data || [];
  const withdrawals = withdrawalsData?.data || [];

  const transactions: TransactionItem[] = [
    ...deposits.map((d) => ({
      id: d.id,
      type: 'deposit' as const,
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      date: d.created_date,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      type: 'withdrawal' as const,
      amount: w.amount,
      currency: w.currency,
      status: w.status,
      date: w.created_date,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (isLoading) {
    return (
      <TabsContent value="transactions" className="mt-0">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </TabsContent>
    );
  }

  if (transactions.length === 0) {
    return (
      <TabsContent value="transactions" className="mt-0">
        <div className="text-center py-8 text-sm text-muted-foreground">
          No transactions found for this user
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="transactions" className="mt-0">
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                tx.type === 'deposit' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              }`}
            >
              {tx.type === 'deposit' ? (
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">{tx.type}</span>
                <StatusBadge status={tx.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.date)}</p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
              {tx.type === 'deposit' ? '+' : '-'}{formatAmount(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}

/* ========================
   Bets Tab
   ======================== */
function BetsTab({ userId }: { userId: string }) {
  const { data, isLoading } = useTolsQuery<Bet>('Bet', {
    q: JSON.stringify({ user_id: userId }),
    limit: 50,
    sort_by: '-created_date',
  });
  const bets = data?.data || [];

  if (isLoading) {
    return (
      <TabsContent value="bets" className="mt-0">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </TabsContent>
    );
  }

  if (bets.length === 0) {
    return (
      <TabsContent value="bets" className="mt-0">
        <div className="text-center py-8 text-sm text-muted-foreground">
          No bets found for this user
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="bets" className="mt-0">
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {bets.map((bet) => {
          const isWin = bet.result === 'win';
          const isLoss = bet.result === 'loss';
          const profit = isWin ? bet.win_amount - bet.bet_amount : -bet.bet_amount;

          return (
            <div
              key={bet.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  isWin
                    ? 'bg-emerald-500/10'
                    : isLoss
                      ? 'bg-rose-500/10'
                      : 'bg-amber-500/10'
                }`}
              >
                {isWin ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : isLoss ? (
                  <MinusIcon className="h-3.5 w-3.5 text-rose-500" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{bet.game_type}</span>
                  <Badge variant={isWin ? 'default' : isLoss ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">
                    {bet.result}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bet {formatAmount(bet.bet_amount)} {bet.currency} · {formatDate(bet.created_date)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold whitespace-nowrap ${
                  profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-rose-500' : 'text-muted-foreground'
                }`}
              >
                {profit > 0 ? '+' : ''}{formatAmount(profit)}
              </span>
            </div>
          );
        })}
      </div>
    </TabsContent>
  );
}

/* ========================
   Quick Action Button
   ======================== */
function QuickActionButton({
  icon: Icon,
  label,
  page,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  page: string;
}) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);

  const handleClick = () => {
    setCurrentPage(page as 'users' | 'wallets' | 'deposits' | 'bets');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5 justify-start"
      onClick={handleClick}
    >
      <Icon className="h-3.5 w-3.5 text-emerald-500" />
      {label}
    </Button>
  );
}
