'use client';

import React, { useMemo } from 'react';
import {
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Dice5,
  Trophy,
  ShoppingCart,
  CreditCard,
  Package,
  Megaphone,
  UserCheck,
  MessageSquare,
  Settings,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTolsQuery, useTolsGet } from '@/lib/tols-hooks';
import { useAdminStore } from '@/stores/admin';
import { formatDate, formatAmount, StatusBadge, CurrencyBadge, truncateAddress } from '@/lib/tols-utils';
import { ENTITY_MAP } from '@/types/tols';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

// ---------- Types ----------

interface RelatedEntity {
  entityName: string;
  entityLabel: string;
  icon: React.ReactNode;
  queryEntity: string;
  filterField: string;
  filterValue: string;
  page: string; // AdminPage key for navigation
}

interface EntityExplorerProps {
  entityType: string;
  entityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------- Icon map ----------

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  User: <Users className="h-4 w-4" />,
  UserWallet: <Wallet className="h-4 w-4" />,
  Deposit: <ArrowDownToLine className="h-4 w-4" />,
  Withdrawal: <ArrowUpFromLine className="h-4 w-4" />,
  Bet: <Dice5 className="h-4 w-4" />,
  Tournament: <Trophy className="h-4 w-4" />,
  TournamentEntry: <Trophy className="h-4 w-4" />,
  MarketListing: <ShoppingCart className="h-4 w-4" />,
  CollectibleCard: <CreditCard className="h-4 w-4" />,
  CardPack: <Package className="h-4 w-4" />,
  CardPull: <Package className="h-4 w-4" />,
  Affiliate: <Megaphone className="h-4 w-4" />,
  Referral: <UserCheck className="h-4 w-4" />,
  CommissionLog: <Megaphone className="h-4 w-4" />,
  HouseEarning: <Dice5 className="h-4 w-4" />,
  PlatformSetting: <Settings className="h-4 w-4" />,
  ResponsibleLimit: <ShieldCheck className="h-4 w-4" />,
  ChatMessage: <MessageSquare className="h-4 w-4" />,
  DemoSession: <Dice5 className="h-4 w-4" />,
  SlotGame: <Dice5 className="h-4 w-4" />,
  GlobalJackpot: <Trophy className="h-4 w-4" />,
};

const ENTITY_PAGE_MAP: Record<string, string> = {
  User: 'users',
  UserWallet: 'wallets',
  Deposit: 'deposits',
  Withdrawal: 'withdrawals',
  Bet: 'bets',
  Tournament: 'tournaments',
  TournamentEntry: 'tournament-entries',
  MarketListing: 'marketplace',
  CollectibleCard: 'collectibles',
  CardPack: 'card-packs',
  CardPull: 'card-pulls',
  Affiliate: 'affiliates',
  Referral: 'referrals',
  CommissionLog: 'commissions',
  HouseEarning: 'house-earnings',
  PlatformSetting: 'settings',
  ResponsibleLimit: 'responsible-gaming',
  ChatMessage: 'chat',
  DemoSession: 'demo-sessions',
  SlotGame: 'slot-games',
  GlobalJackpot: 'jackpot',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Users',
  UserWallet: 'Wallets',
  Deposit: 'Deposits',
  Withdrawal: 'Withdrawals',
  Bet: 'Bets',
  Tournament: 'Tournaments',
  TournamentEntry: 'Tournament Entries',
  MarketListing: 'Marketplace',
  CollectibleCard: 'Collectibles',
  CardPack: 'Card Packs',
  CardPull: 'Card Pulls',
  Affiliate: 'Affiliates',
  Referral: 'Referrals',
  CommissionLog: 'Commissions',
  HouseEarning: 'House Earnings',
  PlatformSetting: 'Settings',
  ResponsibleLimit: 'Responsible Gaming',
  ChatMessage: 'Chat Messages',
  DemoSession: 'Demo Sessions',
  SlotGame: 'Slot Games',
  GlobalJackpot: 'Global Jackpot',
};

// ---------- Relationship mapping ----------

function getRelatedEntities(entityType: string, entityData: Record<string, unknown> | null): RelatedEntity[] {
  const related: RelatedEntity[] = [];

  switch (entityType) {
    case 'User':
      related.push(
        { entityName: 'UserWallet', entityLabel: 'Wallets', icon: ENTITY_ICONS.UserWallet, queryEntity: 'UserWallet', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.UserWallet },
        { entityName: 'Deposit', entityLabel: 'Deposits', icon: ENTITY_ICONS.Deposit, queryEntity: 'Deposit', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Deposit },
        { entityName: 'Withdrawal', entityLabel: 'Withdrawals', icon: ENTITY_ICONS.Withdrawal, queryEntity: 'Withdrawal', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Withdrawal },
        { entityName: 'Bet', entityLabel: 'Bets', icon: ENTITY_ICONS.Bet, queryEntity: 'Bet', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Bet },
        { entityName: 'TournamentEntry', entityLabel: 'Tournament Entries', icon: ENTITY_ICONS.TournamentEntry, queryEntity: 'TournamentEntry', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.TournamentEntry },
        { entityName: 'ChatMessage', entityLabel: 'Chat Messages', icon: ENTITY_ICONS.ChatMessage, queryEntity: 'ChatMessage', filterField: 'sender_user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.ChatMessage },
        { entityName: 'CardPull', entityLabel: 'Card Pulls', icon: ENTITY_ICONS.CardPull, queryEntity: 'CardPull', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.CardPull },
        { entityName: 'MarketListing', entityLabel: 'Marketplace Listings', icon: ENTITY_ICONS.MarketListing, queryEntity: 'MarketListing', filterField: 'seller_user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.MarketListing },
        { entityName: 'ResponsibleLimit', entityLabel: 'Responsible Limits', icon: ENTITY_ICONS.ResponsibleLimit, queryEntity: 'ResponsibleLimit', filterField: 'user_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.ResponsibleLimit },
      );
      break;

    case 'UserWallet':
      related.push(
        { entityName: 'Deposit', entityLabel: 'Deposits', icon: ENTITY_ICONS.Deposit, queryEntity: 'Deposit', filterField: 'wallet_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Deposit },
        { entityName: 'Withdrawal', entityLabel: 'Withdrawals', icon: ENTITY_ICONS.Withdrawal, queryEntity: 'Withdrawal', filterField: 'wallet_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Withdrawal },
        { entityName: 'Bet', entityLabel: 'Bets', icon: ENTITY_ICONS.Bet, queryEntity: 'Bet', filterField: 'wallet_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.Bet },
      );
      break;

    case 'Tournament':
      related.push(
        { entityName: 'TournamentEntry', entityLabel: 'Tournament Entries', icon: ENTITY_ICONS.TournamentEntry, queryEntity: 'TournamentEntry', filterField: 'tournament_id', filterValue: entityData?.id as string || '', page: ENTITY_PAGE_MAP.TournamentEntry },
      );
      break;

    case 'Deposit':
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      if (entityData?.wallet_id) {
        related.push({ entityName: 'UserWallet', entityLabel: 'Wallet', icon: ENTITY_ICONS.UserWallet, queryEntity: 'UserWallet', filterField: 'id', filterValue: entityData.wallet_id as string, page: ENTITY_PAGE_MAP.UserWallet });
      }
      break;

    case 'Withdrawal':
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      if (entityData?.wallet_id) {
        related.push({ entityName: 'UserWallet', entityLabel: 'Wallet', icon: ENTITY_ICONS.UserWallet, queryEntity: 'UserWallet', filterField: 'id', filterValue: entityData.wallet_id as string, page: ENTITY_PAGE_MAP.UserWallet });
      }
      break;

    case 'Bet':
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      if (entityData?.wallet_id) {
        related.push({ entityName: 'UserWallet', entityLabel: 'Wallet', icon: ENTITY_ICONS.UserWallet, queryEntity: 'UserWallet', filterField: 'id', filterValue: entityData.wallet_id as string, page: ENTITY_PAGE_MAP.UserWallet });
      }
      break;

    case 'TournamentEntry':
      if (entityData?.tournament_id) {
        related.push({ entityName: 'Tournament', entityLabel: 'Tournament', icon: ENTITY_ICONS.Tournament, queryEntity: 'Tournament', filterField: 'id', filterValue: entityData.tournament_id as string, page: ENTITY_PAGE_MAP.Tournament });
      }
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      break;

    case 'MarketListing':
      if (entityData?.seller_user_id) {
        related.push({ entityName: 'User', entityLabel: 'Seller', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.seller_user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      break;

    case 'CollectibleCard':
      if (entityData?.owner_user_id) {
        related.push({ entityName: 'User', entityLabel: 'Owner', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.owner_user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      break;

    case 'Affiliate':
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      break;

    case 'CardPull':
      if (entityData?.user_id) {
        related.push({ entityName: 'User', entityLabel: 'User', icon: ENTITY_ICONS.User, queryEntity: 'User', filterField: 'id', filterValue: entityData.user_id as string, page: ENTITY_PAGE_MAP.User });
      }
      if (entityData?.card_pack_id) {
        related.push({ entityName: 'CardPack', entityLabel: 'Card Pack', icon: ENTITY_ICONS.CardPack, queryEntity: 'CardPack', filterField: 'id', filterValue: entityData.card_pack_id as string, page: ENTITY_PAGE_MAP.CardPack });
      }
      break;

    default:
      break;
  }

  return related;
}

// ---------- Field display helper ----------

function formatFieldValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (key === 'status') return <StatusBadge status={value as string} />;
  if (key === 'currency') return <CurrencyBadge currency={value as string} />;
  if (key.endsWith('_date')) return <span className="text-xs">{formatDate(value as string)}</span>;
  if (key === 'address' || key === 'tx_hash' || key === 'to_address') return <span className="font-mono text-xs">{truncateAddress(value as string)}</span>;
  if (typeof value === 'number' && (key.includes('amount') || key.includes('balance') || key.includes('fee'))) {
    return <span className="font-mono text-sm">{value.toLocaleString()}</span>;
  }
  if (typeof value === 'boolean') return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>;
  if (typeof value === 'object') return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(value)}</span>;
  return <span className="text-sm">{String(value)}</span>;
}

// ---------- Count Badge Component ----------

function RelationCard({ related }: { related: RelatedEntity }) {
  const { data, isLoading } = useTolsQuery<Record<string, unknown>>(related.queryEntity, {
    limit: 100,
    q: `${related.filterField}:${related.filterValue}`,
  });
  const count = data?.data?.length || 0;

  return (
    <Card className="hover:border-primary/30 transition-all duration-200 cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            {related.icon}
            <span className="text-sm font-medium">{related.entityLabel}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? '...' : count}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-3 w-3" />
          View all
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Loading skeleton ----------

function ExplorerSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16 w-full" />
      <Separator />
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

// ---------- Main Component ----------

export function EntityExplorer({ entityType, entityId, open, onOpenChange }: EntityExplorerProps) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const [copied, setCopied] = useState(false);

  // Fetch the entity itself
  const { data: entityData, isLoading: entityLoading } = useTolsGet<Record<string, unknown>>(entityType, open ? entityId : null);

  const entityRecord = entityData?.data || null;

  const relatedEntities = useMemo(() => {
    if (!entityRecord) return [];
    return getRelatedEntities(entityType, entityRecord);
  }, [entityType, entityRecord]);

  const entityFields = useMemo(() => {
    if (!entityRecord) return [];
    return Object.entries(entityRecord)
      .filter(([key]) => key !== 'id' && key !== 'created_date' && key !== 'updated_date')
      .slice(0, 8);
  }, [entityRecord]);

  const handleCopy = () => {
    navigator.clipboard.writeText(entityId).then(() => {
      setCopied(true);
      toast.success('ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleNavigateToRelation = (related: RelatedEntity) => {
    setCurrentPage(related.page as Parameters<typeof setCurrentPage>[0]);
    onOpenChange(false);
  };

  const handleOpenFullPage = () => {
    const pageKey = ENTITY_PAGE_MAP[entityType];
    if (pageKey) {
      setCurrentPage(pageKey as Parameters<typeof setCurrentPage>[0]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-muted-foreground">{ENTITY_ICONS[entityType]}</span>
            Entity Explorer
          </DialogTitle>
          <DialogDescription>
            Explore {ENTITY_LABELS[entityType] || entityType} relationships and connected data
          </DialogDescription>
        </DialogHeader>

        {entityLoading ? (
          <ExplorerSkeleton />
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {/* Hero card: main entity */}
              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {entityType}
                      </Badge>
                      <span className="text-sm font-medium">{ENTITY_LABELS[entityType] || entityType}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {entityId.length > 20 ? entityId.slice(0, 20) + '...' : entityId}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {entityFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {entityFields.map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs capitalize">{key.replace(/_/g, ' ')}</span>
                          {formatFieldValue(key, value)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Related entities */}
              {relatedEntities.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    Related Entities
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {relatedEntities.map((related) => (
                      <div
                        key={`${related.entityName}-${related.filterField}`}
                        onClick={() => handleNavigateToRelation(related)}
                      >
                        <RelationCard related={related} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No related entities found for this {entityType}.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleOpenFullPage} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Full Page
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
