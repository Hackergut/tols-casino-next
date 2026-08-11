import { Badge } from '@/components/ui/badge';

const statusColorMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  // Positive
  active: 'default',
  confirmed: 'default',
  completed: 'default',
  win: 'default',
  paid: 'default',
  rewarded: 'default',
  sold: 'default',
  approved: 'default',
  // Pending
  pending: 'secondary',
  processing: 'secondary',
  upcoming: 'secondary',
  // Neutral / Warning
  suspended: 'outline',
  locked: 'outline',
  maintenance: 'outline',
  ended: 'outline',
  expired: 'outline',
  archived: 'outline',
  inactive: 'outline',
  discontinued: 'outline',
  closed: 'outline',
  paused: 'outline',
  // Negative
  banned: 'destructive',
  failed: 'destructive',
  rejected: 'destructive',
  cancelled: 'destructive',
  loss: 'destructive',
  eliminated: 'destructive',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusColorMap[status?.toLowerCase()] || 'secondary';
  return (
    <Badge variant={variant} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    operator: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    player: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  };
  const color = colorMap[role?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
      {role}
    </span>
  );
}

export function CurrencyBadge({ currency }: { currency: string }) {
  const colorMap: Record<string, string> = {
    BTC: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    ETH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    SOL: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    USDT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    USDC: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };
  const color = colorMap[currency] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>
      {currency}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: string }) {
  const colorMap: Record<string, string> = {
    common: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    rare: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    epic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    legendary: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };
  const color = colorMap[rarity?.toLowerCase()] || 'bg-gray-200 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${color}`}>
      {rarity}
    </span>
  );
}

export function formatAmount(amount: number, currency?: string): string {
  if (amount === undefined || amount === null) return '—';
  if (currency) {
    // For crypto, show with appropriate decimals
    if (['BTC'].includes(currency)) return `${(amount / 1e8).toFixed(8)} ${currency}`;
    if (['ETH', 'USDT', 'USDC'].includes(currency)) return `${(amount / 1e18).toFixed(6)} ${currency}`;
    if (['SOL'].includes(currency)) return `${(amount / 1e9).toFixed(9)} ${currency}`;
  }
  return amount.toLocaleString();
}

export function formatDate(date: string): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date;
  }
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
