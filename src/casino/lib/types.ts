// Shared TOLS types
export type GameCategory = "originals" | "slots" | "live" | "table" | "instant" | "new" | "popular";

// Provably-fair utilities (shared between server and client)
export function fairFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const input = `${serverSeed}:${clientSeed}:${nonce}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0)) / 9007199254740992;
  return combined;
}

export function serverSeedHash(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export interface SlotGameType {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: GameCategory;
  image: string;
  rtp: number;
  volatility: string;
  hasDemo: boolean;
  hasReal: boolean;
  enabled: boolean;
  featured: boolean;
  description: string;
  minBet: number;
  maxBet: number;
  popularity: number;
}

export interface WalletState {
  balance: number;
  currency: string;
  vipLevel: number;
  xp: number;
  totalWagered: number;
  totalWon: number;
}

export interface JackpotState {
  amount: number;
  contributionsCount: number;
  lastWinner: string;
  lastWinAmount: number;
  lastWinDate: string | null;
}

export interface BetHistoryItem {
  id: string;
  gameName: string;
  gameCategory: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: "win" | "lose";
  createdAt: string;
  username: string;
}

export interface TournamentType {
  id: string;
  name: string;
  game: string;
  prizePool: number;
  entryFee: number;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "ended";
  participantsCount: number;
  maxParticipants: number;
  description: string;
  currency: string;
  bannerColor: string;
}

export interface CollectibleCardType {
  id: string;
  collection: string;
  cardName: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  insuredValue: number;
  currency: string;
  gradingCompany: string;
  gradingId: string;
  image: string;
  packName: string;
  isNew: boolean;
}

export interface CardPackType {
  id: string;
  name: string;
  collection: string;
  price: number;
  currency: string;
  cardsPerPack: number;
  image: string;
  description: string;
  dropRates: string;
  enabled: boolean;
}

export interface MarketListingType {
  id: string;
  cardName: string;
  collection: string;
  rarity: string;
  insuredValue: number;
  image: string;
  listingType: "sale" | "swap";
  price: number;
  swapFor: string;
  sellerAlias: string;
  status: string;
}

export interface ChatMessageType {
  id: string;
  username: string;
  avatarColor: string;
  message: string;
  channel: string;
  createdAt: string;
}

export interface AffiliateStats {
  referralCode: string;
  commissionPlan: string;
  commissionRate: number;
  totalClicks: number;
  totalReferrals: number;
  totalWagered: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

// Provably-fair helpers
export function sha256Hash(input: string): string {
  // Simple synchronous hash for demo client display (not crypto-secure; server is source of truth)
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return out.toString(16).padStart(16, "0");
}

export function formatCurrency(amount: number, currency = "USDT"): string {
  const sym = currency === "USDT" ? "$" : "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: amount < 100 ? 2 : 0,
    maximumFractionDigits: amount < 100 ? 4 : 2,
  });
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`;
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function shortAddress(addr: string, chars = 6): string {
  if (!addr) return "";
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export const RARITY_META: Record<string, { color: string; label: string; glow: string }> = {
  common: { color: "#9ca3af", label: "Common", glow: "rgba(156,163,175,0.4)" },
  rare: { color: "#3b82f6", label: "Rare", glow: "rgba(59,130,246,0.5)" },
  epic: { color: "#a855f7", label: "Epic", glow: "rgba(168,85,247,0.5)" },
  legendary: { color: "#f59e0b", label: "Legendary", glow: "rgba(245,158,11,0.6)" },
  mythic: { color: "var(--color-lime)", label: "Mythic", glow: "rgba(204,255,0,0.7)" },
};

export const COLLECTIONS = ["Pokémon", "NBA", "FIFA", "F1", "UFC", "Yu-Gi-Oh!"] as const;
