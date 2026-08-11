'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Dice5,
  MessageSquare,
  Trophy,
  Clock,
  Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTolsQuery } from '@/lib/tols-hooks';
import { formatDate, formatAmount, CurrencyBadge, StatusBadge } from '@/lib/tols-utils';
import type { Deposit, Withdrawal, Bet, ChatMessage, TournamentEntry } from '@/types/tols';
import { cn } from '@/lib/utils';

// ---------- Types ----------

interface TimelineActivity {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'chat' | 'tournament_entry';
  label: string;
  icon: React.ReactNode;
  color: string;
  dotColor: string;
  detail: React.ReactNode;
  status?: string;
  created_date: string;
}

// ---------- Relative time ----------

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return formatDate(dateStr);
}

// ---------- Icon helpers ----------

const ICON_MAP = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  bet: Dice5,
  chat: MessageSquare,
  tournament_entry: Trophy,
};

const COLOR_MAP = {
  deposit: { dot: 'bg-emerald-500', card: 'border-l-emerald-500' },
  withdrawal: { dot: 'bg-rose-500', card: 'border-l-rose-500' },
  bet: { dot: 'bg-sky-500', card: 'border-l-sky-500' },
  chat: { dot: 'bg-purple-500', card: 'border-l-purple-500' },
  tournament_entry: { dot: 'bg-orange-500', card: 'border-l-orange-500' },
};

// ---------- Mappers ----------

function mapDeposit(d: Deposit): TimelineActivity {
  return {
    id: d.id,
    type: 'deposit',
    label: 'Deposit Received',
    icon: <ArrowDownToLine className="h-3.5 w-3.5" />,
    color: COLOR_MAP.deposit.card,
    dotColor: COLOR_MAP.deposit.dot,
    status: d.status,
    created_date: d.created_date,
    detail: (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-medium">{formatAmount(d.amount, d.currency)}</span>
        <CurrencyBadge currency={d.currency} />
        {d.chain && <span className="text-xs text-muted-foreground">on {d.chain}</span>}
      </div>
    ),
  };
}

function mapWithdrawal(w: Withdrawal): TimelineActivity {
  return {
    id: w.id,
    type: 'withdrawal',
    label: 'Withdrawal Requested',
    icon: <ArrowUpFromLine className="h-3.5 w-3.5" />,
    color: COLOR_MAP.withdrawal.card,
    dotColor: COLOR_MAP.withdrawal.dot,
    status: w.status,
    created_date: w.created_date,
    detail: (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-medium">{formatAmount(w.amount, w.currency)}</span>
        <CurrencyBadge currency={w.currency} />
        {w.fee > 0 && <span className="text-xs text-muted-foreground">fee: {w.fee}</span>}
      </div>
    ),
  };
}

function mapBet(b: Bet): TimelineActivity {
  return {
    id: b.id,
    type: 'bet',
    label: 'Bet Placed',
    icon: <Dice5 className="h-3.5 w-3.5" />,
    color: COLOR_MAP.bet.card,
    dotColor: COLOR_MAP.bet.dot,
    status: b.result,
    created_date: b.created_date,
    detail: (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm">{formatAmount(b.bet_amount, b.currency)}</span>
        <span className="text-xs text-muted-foreground">on {b.game_type || 'game'}</span>
        {b.result === 'win' && (
          <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            +{formatAmount(b.win_amount, b.currency)}
          </span>
        )}
      </div>
    ),
  };
}

function mapChat(c: ChatMessage): TimelineActivity {
  return {
    id: c.id,
    type: 'chat',
    label: 'Message Sent',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    color: COLOR_MAP.chat.card,
    dotColor: COLOR_MAP.chat.dot,
    created_date: c.created_date,
    detail: (
      <p className="text-sm text-muted-foreground truncate max-w-[280px]">
        &ldquo;{c.content}&rdquo;
      </p>
    ),
  };
}

function mapTournamentEntry(e: TournamentEntry): TimelineActivity {
  return {
    id: e.id,
    type: 'tournament_entry',
    label: 'Tournament Entry',
    icon: <Trophy className="h-3.5 w-3.5" />,
    color: COLOR_MAP.tournament_entry.card,
    dotColor: COLOR_MAP.tournament_entry.dot,
    status: e.status,
    created_date: e.created_date,
    detail: (
      <div className="flex items-center gap-2">
        <span className="text-sm">Score: <span className="font-mono font-medium">{e.score}</span></span>
        <span className="text-xs text-muted-foreground">Rank #{e.rank}</span>
      </div>
    ),
  };
}

// ---------- Skeleton ----------

function TimelineSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-start">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-60" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Empty State ----------

function EmptyState({ entityType }: { entityType: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">No activity found for this {entityType}</p>
    </div>
  );
}

// ---------- Main Component ----------

interface ActivityTimelineProps {
  entityId: string;
  entityType: 'user' | 'wallet' | 'tournament';
  className?: string;
}

export function ActivityTimeline({ entityId, entityType, className }: ActivityTimelineProps) {
  // Fetch data based on entity type
  const userQuery = useTolsQuery<Deposit>('Deposit', {
    limit: 20,
    q: entityType === 'user' ? `user_id:${entityId}` : undefined,
  });
  const userWithdrawalQuery = useTolsQuery<Withdrawal>('Withdrawal', {
    limit: 20,
    q: entityType === 'user' ? `user_id:${entityId}` : undefined,
  });
  const userBetQuery = useTolsQuery<Bet>('Bet', {
    limit: 20,
    q: entityType === 'user' ? `user_id:${entityId}` : undefined,
  });
  const userChatQuery = useTolsQuery<ChatMessage>('ChatMessage', {
    limit: 20,
    q: entityType === 'user' ? `sender_user_id:${entityId}` : undefined,
  });

  const walletDepositQuery = useTolsQuery<Deposit>('Deposit', {
    limit: 20,
    q: entityType === 'wallet' ? `wallet_id:${entityId}` : undefined,
  });
  const walletWithdrawalQuery = useTolsQuery<Withdrawal>('Withdrawal', {
    limit: 20,
    q: entityType === 'wallet' ? `wallet_id:${entityId}` : undefined,
  });

  const tournamentEntryQuery = useTolsQuery<TournamentEntry>('TournamentEntry', {
    limit: 20,
    q: entityType === 'tournament' ? `tournament_id:${entityId}` : undefined,
  });

  const activities = useMemo<TimelineActivity[]>(() => {
    const items: TimelineActivity[] = [];

    if (entityType === 'user') {
      (userQuery.data?.data || []).forEach((d) => items.push(mapDeposit(d)));
      (userWithdrawalQuery.data?.data || []).forEach((w) => items.push(mapWithdrawal(w)));
      (userBetQuery.data?.data || []).forEach((b) => items.push(mapBet(b)));
      (userChatQuery.data?.data || []).forEach((c) => items.push(mapChat(c)));
    } else if (entityType === 'wallet') {
      (walletDepositQuery.data?.data || []).forEach((d) => items.push(mapDeposit(d)));
      (walletWithdrawalQuery.data?.data || []).forEach((w) => items.push(mapWithdrawal(w)));
    } else if (entityType === 'tournament') {
      (tournamentEntryQuery.data?.data || []).forEach((e) => items.push(mapTournamentEntry(e)));
    }

    items.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    return items.slice(0, 20);
  }, [
    entityType,
    userQuery.data?.data,
    userWithdrawalQuery.data?.data,
    userBetQuery.data?.data,
    userChatQuery.data?.data,
    walletDepositQuery.data?.data,
    walletWithdrawalQuery.data?.data,
    tournamentEntryQuery.data?.data,
  ]);

  const isLoading =
    (entityType === 'user' && (userQuery.isLoading || userWithdrawalQuery.isLoading || userBetQuery.isLoading || userChatQuery.isLoading)) ||
    (entityType === 'wallet' && (walletDepositQuery.isLoading || walletWithdrawalQuery.isLoading)) ||
    (entityType === 'tournament' && tournamentEntryQuery.isLoading);

  return (
    <div className={cn('w-full', className)}>
      {isLoading ? (
        <TimelineSkeleton />
      ) : activities.length === 0 ? (
        <EmptyState entityType={entityType} />
      ) : (
        <ScrollArea className="max-h-[480px]">
          <div className="relative px-4 py-2">
            {/* Vertical dashed line */}
            <div className="absolute left-[22px] top-2 bottom-2 w-px border-l border-dashed border-border" />

            <div className="space-y-1">
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
                  className="flex gap-4 items-start relative"
                >
                  {/* Dot */}
                  <div className="relative z-10 shrink-0 mt-1">
                    <div
                      className={cn(
                        'h-[10px] w-[10px] rounded-full ring-2 ring-background',
                        activity.dotColor
                      )}
                    />
                  </div>

                  {/* Card */}
                  <Card className={cn('flex-1 border-l-4 py-0', activity.color)} >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{activity.icon}</span>
                          <span className="text-sm font-medium">{activity.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {activity.status && <StatusBadge status={activity.status} />}
                        </div>
                      </div>
                      <div className="mb-1">{activity.detail}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {relativeTime(activity.created_date)}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
