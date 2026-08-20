import type { LobbyGame } from "@/components/lobby/lobby-types";
import type { TolsPromotion } from "@/components/lobby/promotions";

/*
 * Card CMS — shared types and merge helpers.
 *
 * The platform ships card defaults in code (promotions.ts, the Originals
 * registry, the games-lobby API). The CMS stores ONLY operator overrides
 * (CmsCard rows) and these helpers apply them on top of the defaults:
 *
 *   effective = { ...default, ...override }
 *
 * Every field is optional in the override, so an operator can replace just
 * the artwork, or just the title, or the whole card. Deleting the row
 * reverts to the built-in default with no redeploy.
 */

export type CmsEntity = "game" | "promo";

export interface CmsCardOverride {
  entity: CmsEntity;
  key: string;
  title?: string | null;
  tagline?: string | null;
  reward?: string | null;
  badge?: string | null;
  cta?: string | null;
  target?: string | null;
  accent?: string | null;
  imageUrl?: string | null;
  enabled: boolean;
  sortOrder: number;
  /** ISO timestamp of the last change — used by UIs to remount editors. */
  updatedAt?: string;
}

export function cmsKey(entity: CmsEntity, key: string): string {
  return `${entity}:${key}`;
}

/** Index overrides by "entity:key" for O(1) lookups. */
export function indexCmsOverrides(rows: CmsCardOverride[]): Map<string, CmsCardOverride> {
  return new Map(rows.map((r) => [cmsKey(r.entity, r.key), r]));
}

/** Apply a promo override onto a code default. */
export function applyCmsToPromo(promo: TolsPromotion, override?: CmsCardOverride | null): TolsPromotion {
  if (!override) return promo;
  return {
    ...promo,
    title: override.title ?? promo.title,
    tagline: override.tagline ?? promo.tagline,
    reward: override.reward ?? promo.reward,
    badge: override.badge ?? promo.badge,
    cta: override.cta ?? promo.cta,
    target: override.target ?? promo.target,
    accent: override.accent ?? promo.accent,
    image: override.imageUrl ?? promo.image,
  };
}

/** Apply a game override onto a lobby game. */
export function applyCmsToGame(game: LobbyGame, override?: CmsCardOverride | null): LobbyGame {
  if (!override) return game;
  return {
    ...game,
    name: override.title ?? game.name,
    imageUrl: override.imageUrl ?? game.imageUrl,
    thumbnailUrl: override.imageUrl ?? game.thumbnailUrl,
    description: override.tagline ?? game.description,
  };
}
