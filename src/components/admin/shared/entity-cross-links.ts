'use client';

import type { AdminPage } from '@/stores/admin';

/**
 * Maps entity ID field names (e.g. `user_id`) to the AdminPage key for navigation.
 * Used by both DataTable cells and DetailDialog to render clickable cross-entity links.
 */
export const ENTITY_ID_FIELD_MAP: Record<string, AdminPage> = {
  user_id: 'users',
  wallet_id: 'wallets',
  tournament_id: 'tournaments',
  game_id: 'slot-games',
  affiliate_id: 'affiliates',
  card_pack_id: 'card-packs',
  collectible_card_id: 'collectibles',
  marketplace_listing_id: 'marketplace',
  chat_message_id: 'chat',
  parent_id: 'users',
};

/** Human-readable labels for entity pages (used in navigation buttons). */
export const ENTITY_LINK_LABELS: Record<string, string> = {
  users: 'Users',
  wallets: 'Wallets',
  tournaments: 'Tournaments',
  'slot-games': 'Slot Games',
  affiliates: 'Affiliates',
  'card-packs': 'Card Packs',
  collectibles: 'Collectibles',
  marketplace: 'Marketplace',
  chat: 'Chat',
};
