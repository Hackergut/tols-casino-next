"use client";

/*
 * VirtualGameCard — EuroVirtuals catalogue card, TOLS-styled.
 *
 * Shares the same portrait 3/4 silhouette and hover language as LobbyGameCard
 * (shimmer sweep, spring play button, gradient scrim), but carries
 * virtual-specific chrome: a category icon chip and the EuroVirtuals provider
 * brand, so virtual titles read as a distinct, first-class rail rather than a
 * generic "slots" clone. Thumbnails come straight from the EuroVirtuals API
 * and are portrait-native, so the portrait crop never letterboxes.
 */

import { useMemo, type CSSProperties } from "react";
import { Play, Rocket, Trophy, Layers, Gamepad2, Sparkles, type LucideIcon } from "lucide-react";
import type { LobbyGame } from "./lobby-types";

const TITLE_STYLE: CSSProperties = {
  fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)",
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 6px rgb(0 0 0 / 0.75)",
};
const META_STYLE: CSSProperties = {
  fontSize: "clamp(0.72rem, 0.68rem + 0.22vw, 0.8125rem)",
  lineHeight: 1.25,
  textShadow: "0 1px 5px rgb(0 0 0 / 0.7)",
};

export const VIRTUAL_CATEGORY_META: { match: string; label: string; icon: LucideIcon }[] = [
  { match: "crash", label: "Crash Games", icon: Rocket },
  { match: "virtual", label: "Virtual Sport", icon: Trophy },
  { match: "slot", label: "Slots", icon: Layers },
  { match: "arcade", label: "Arcade", icon: Gamepad2 },
  { match: "jackpot", label: "Jackpot Games", icon: Sparkles },
];

export function virtualCategoryMeta(category: string): { label: string; icon: LucideIcon } {
  const c = category.toLowerCase();
  const found = VIRTUAL_CATEGORY_META.find((m) => c.includes(m.match));
  return found ? { label: found.label, icon: found.icon } : { label: category || "Virtual", icon: Gamepad2 };
}

export function VirtualGameCard({ game, onClick }: { game: LobbyGame; onClick: () => void }) {
  const { label, icon: Icon } = useMemo(() => virtualCategoryMeta(game.category), [game.category]);
  const src = game.imageUrl || game.thumbnailUrl || "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play ${game.name}`}
      className="tols-game-card group"
    >
      {/* Artwork (portrait-native EuroVirtuals thumbnail). */}
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#0f1015]">
          <Icon className="h-12 w-12 text-lime/25" />
        </div>
      )}

      {/* Shimmer sweep on hover. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      {/* Category icon chip (top-left) — the virtual rail's signature mark. */}
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85 backdrop-blur-md">
        <Icon className="h-3.5 w-3.5 text-lime" />
        {label}
      </span>

      {/* Provider brand pill (top-right). */}
      <span className="absolute right-2.5 top-2.5 rounded-full border border-lime/30 bg-black/55 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-lime backdrop-blur-md">
        {game.provider}
      </span>

      {/* Hover play button. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="tols-game-play">
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>

      {/* Bottom scrim: title + provider. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-14">
        <p className="truncate font-bold text-white" style={TITLE_STYLE}>{game.name}</p>
        <p className="truncate text-white/55" style={META_STYLE}>
          {game.provider} · {label}
        </p>
      </div>
    </button>
  );
}
