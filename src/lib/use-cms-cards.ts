"use client";

/*
 * Card CMS — client data layer.
 *
 * Fetches the operator's card overrides once per session (module-level cache)
 * and exposes merge helpers so every card surface reads the same source:
 *
 *   useCmsOverrides()            → Map<"entity:key", override>
 *   useEffectivePromotions()     → ALL_PROMOTIONS with CMS overrides applied
 *   useEffectiveGames(games)     → lobby games with CMS overrides applied
 *   useEffectiveOriginalGames()  → static Originals registry + overrides
 *
 * If the CMS is unreachable the platform silently falls back to the built-in
 * defaults — content management must never break the lobby.
 */

import { useEffect, useMemo, useState } from "react";
import { ALL_PROMOTIONS, type TolsPromotion } from "@/components/lobby/promotions";
import { ORIGINAL_GAMES, type LobbyGame, type OriginalGameDef } from "@/components/lobby/lobby-types";
import { applyCmsToGame, applyCmsToPromo, cmsKey, indexCmsOverrides, type CmsCardOverride } from "./cms-cards";

let cached: Promise<CmsCardOverride[]> | null = null;
const listeners = new Set<() => void>();

function fetchOverrides(): Promise<CmsCardOverride[]> {
  if (!cached) {
    cached = fetch("/api/cms/cards")
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
      .then((j) => (Array.isArray(j.data) ? (j.data as CmsCardOverride[]) : []))
      .catch(() => []);
  }
  return cached;
}

/** Called by the Card CMS after a save/reset so every surface re-reads. */
export function refreshCmsCards(): void {
  cached = null;
  void fetchOverrides();
  listeners.forEach((l) => l());
}

/** All CMS overrides, indexed by "entity:key". Refreshes on refreshCmsCards(). */
export function useCmsOverrides(): Map<string, CmsCardOverride> {
  const [rows, setRows] = useState<CmsCardOverride[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchOverrides().then((r) => {
        if (alive) setRows(r);
      });
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  // Identity-stable across re-renders. Returning a fresh Map every call
  // used to retrigger the lobby games effect (which listed `cmsOverrides` as
  // a dependency), abort in-flight /api/bets/history reads, and toast
  // "Connection lost" on /games/recent in a loop.
  return useMemo(() => indexCmsOverrides(rows), [rows]);
}

/** Promo cards with CMS overrides applied — the single source for all promo UI. */
export function useEffectivePromotions(): TolsPromotion[] {
  const overrides = useCmsOverrides();
  return ALL_PROMOTIONS.map((promo) => applyCmsToPromo(promo, overrides.get(cmsKey("promo", promo.id))));
}

/** Lobby game cards with CMS overrides applied. */
export function useEffectiveGames(games: LobbyGame[]): LobbyGame[] {
  const overrides = useCmsOverrides();
  return games.map((g) => applyCmsToGame(g, overrides.get(cmsKey("game", g.slug || g.id))));
}

/** Static Originals registry with CMS overrides applied (OriginalsView). */
export function useEffectiveOriginalGames(): OriginalGameDef[] {
  const overrides = useCmsOverrides();
  return ORIGINAL_GAMES.map((g) => {
    const o = overrides.get(cmsKey("game", g.id));
    if (!o) return g;
    return {
      ...g,
      name: o.title ?? g.name,
      desc: o.tagline ?? g.desc,
      color: o.accent ?? g.color,
    };
  });
}
