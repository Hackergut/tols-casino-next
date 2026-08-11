// Re-export casino types for backward compatibility
// Casino components import from @/lib/types — forward to @/casino/lib/types
export {
  type GameCategory,
  type SlotGameType,
  type WalletState,
  type JackpotState,
  type BetHistoryItem,
  type TournamentType,
  type CollectibleCardType,
  type CardPackType,
  type MarketListingType,
  type ChatMessageType,
  type AffiliateStats,
  fairFloat,
  serverSeedHash,
  sha256Hash,
  formatCurrency,
  formatNumber,
  shortAddress,
  timeAgo,
  RARITY_META,
  COLLECTIONS,
} from "@/casino/lib/types";
