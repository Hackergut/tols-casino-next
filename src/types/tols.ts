// TOLS Platform Entity Types

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ===== User Module =====
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'player' | 'operator' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  created_date: string;
  updated_date: string;
}

export interface UserWallet {
  id: string;
  user_id: string;
  currency: string;
  chain: 'bitcoin' | 'ethereum' | 'solana';
  address: string;
  balance: number;
  locked_balance: number;
  status: 'active' | 'locked' | 'archived';
  created_date: string;
  updated_date: string;
}

// ===== Financial Module =====
export interface Deposit {
  id: string;
  user_id: string;
  wallet_id: string;
  currency: string;
  chain: string;
  tx_hash: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  created_date: string;
  updated_date: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  wallet_id: string;
  currency: string;
  chain: string;
  to_address: string;
  amount: number;
  fee: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
  tx_hash: string | null;
  created_date: string;
  updated_date: string;
}

// ===== Gaming Module =====
export interface SlotGame {
  id: string;
  name: string;
  provider: string;
  type: 'classic' | 'video' | 'megaways';
  rtp: number;
  min_bet: number;
  max_bet: number;
  supported_currencies: string[];
  status: 'active' | 'inactive' | 'maintenance';
  image_url: string;
  created_date: string;
  updated_date: string;
}

export interface Bet {
  id: string;
  user_id: string;
  wallet_id: string | null;
  game_id: string;
  game_type: string;
  is_demo: boolean;
  demo_session_id: string | null;
  bet_amount: number;
  currency: string;
  result: 'pending' | 'win' | 'loss';
  payout_multiplier: number;
  win_amount: number;
  jackpot_contribution: number;
  jackpot_win_amount: number;
  free_spins_awarded: number;
  created_date: string;
  updated_date: string;
}

export interface DemoSession {
  id: string;
  user_id: string;
  initial_balance: number;
  current_balance: number;
  status: 'active' | 'ended';
  created_date: string;
  updated_date: string;
}

export interface GlobalJackpot {
  id: string;
  name: string;
  currency: string;
  chain: string;
  seed_amount: number;
  current_amount: number;
  contribution_rate: number;
  status: 'active' | 'closed';
  last_win_date: string | null;
  created_date: string;
  updated_date: string;
}

// ===== Tournament Module =====
export interface Tournament {
  id: string;
  name: string;
  game_id: string;
  type: 'freeroll' | 'paid';
  entry_fee: number;
  currency: string;
  min_players: number;
  max_players: number;
  prize_pool: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  created_date: string;
  updated_date: string;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  score: number;
  rank: number;
  status: 'active' | 'eliminated' | 'completed';
  created_date: string;
  updated_date: string;
}

// ===== Marketplace & Collectibles =====
export interface MarketListing {
  id: string;
  seller_user_id: string;
  item_type: string;
  item_id: string;
  price: number;
  currency: string;
  status: 'listed' | 'sold' | 'cancelled';
  created_date: string;
  updated_date: string;
}

export interface CollectibleCard {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image_url: string;
  attributes: Record<string, number | string>;
  owner_user_id: string;
  created_date: string;
  updated_date: string;
}

export interface CardPack {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  status: 'active' | 'discontinued';
  created_date: string;
  updated_date: string;
}

export interface CardPull {
  id: string;
  user_id: string;
  card_pack_id: string;
  cards: string[];
  created_date: string;
}

// ===== Affiliate & Commission =====
export interface Affiliate {
  id: string;
  code: string;
  user_id: string | null;
  name: string;
  commission_rate: number;
  total_earned: number;
  status: 'active' | 'suspended' | 'closed';
  created_date: string;
  updated_date: string;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  code: string;
  status: 'pending' | 'active' | 'rewarded';
  reward_amount: number;
  created_date: string;
  updated_date: string;
}

export interface CommissionLog {
  id: string;
  affiliate_id: string | null;
  referrer_user_id: string | null;
  source_type: 'bet' | 'deposit' | 'referral_bonus';
  source_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled';
  created_date: string;
  updated_date: string;
}

export interface HouseEarning {
  id: string;
  bet_id: string;
  game_id: string;
  user_id: string;
  amount: number;
  currency: string;
  created_date: string;
}

// ===== Platform Module =====
export interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  description: string;
  created_date: string;
  updated_date: string;
}

export interface ResponsibleLimit {
  id: string;
  user_id: string;
  type: 'deposit_daily' | 'wager_weekly' | 'loss_monthly' | 'session_time_minutes';
  limit_value: number;
  current_usage: number;
  period_start: string;
  status: 'active' | 'paused' | 'expired';
  created_date: string;
  updated_date: string;
}

export interface ChatMessage {
  id: string;
  sender_user_id: string;
  recipient_user_id: string | null;
  channel: 'global' | 'game_room' | 'tournament_<id>' | 'private';
  content: string;
  created_date: string;
}

// ===== Query Helpers =====
export interface QueryParams {
  limit?: number;
  skip?: number;
  sort_by?: string;
  q?: string;
}

export const ENTITY_MAP: Record<string, string> = {
  User: '/entities/User',
  UserWallet: '/entities/UserWallet',
  Deposit: '/entities/Deposit',
  Withdrawal: '/entities/Withdrawal',
  Bet: '/entities/Bet',
  SlotGame: '/entities/SlotGame',
  DemoSession: '/entities/DemoSession',
  GlobalJackpot: '/entities/GlobalJackpot',
  Tournament: '/entities/Tournament',
  TournamentEntry: '/entities/TournamentEntry',
  MarketListing: '/entities/MarketListing',
  CollectibleCard: '/entities/CollectibleCard',
  CardPack: '/entities/CardPack',
  CardPull: '/entities/CardPull',
  Affiliate: '/entities/Affiliate',
  Referral: '/entities/Referral',
  CommissionLog: '/entities/CommissionLog',
  HouseEarning: '/entities/HouseEarning',
  PlatformSetting: '/entities/PlatformSetting',
  ResponsibleLimit: '/entities/ResponsibleLimit',
  ChatMessage: '/entities/ChatMessage',
};
