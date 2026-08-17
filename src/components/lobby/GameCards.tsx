"use client";

// Game cards + loading skeleton for the lobby shell — extracted from page.tsx (Phase 2).
import { Gamepad2 } from "lucide-react";
import VideoLoader from "@/components/VideoLoader";
import type { LobbyGame, OriginalGameDef } from "./lobby-types";

// Game-load fallback. Reuses the exact TOLS slot loader shown at app startup
// (the SLOT→TOLS letter reels in VideoLoader) instead of a separate spinner, so
// the wait looks the same everywhere. `ready={false}` keeps the reels rolling
// until the game chunk loads and React swaps this fallback for the game.
export function GameLoading() {
  return <VideoLoader ready={false} />;
}


/* Card typography scales with the viewport instead of stepping between fixed
   sizes: a shelf card can be 150px wide on a phone and 320px on desktop, and a
   single `text-sm` is either cramped at one end or undersized at the other. */
const TITLE_STYLE: React.CSSProperties = {
  fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)",
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 6px rgb(0 0 0 / 0.75)",
};
const META_STYLE: React.CSSProperties = {
  fontSize: "clamp(0.75rem, 0.7rem + 0.24vw, 0.875rem)",
  lineHeight: 1.25,
  textShadow: "0 1px 5px rgb(0 0 0 / 0.7)",
};

const CAT_LABEL: Record<string, string> = {
  original: "TOLS Originals",
  external_slot: "Slots",
  live: "Live Casino",
  table: "Table Games",
};
function catLabel(g: LobbyGame): string {
  return CAT_LABEL[g.gameType] || g.category || g.provider;
}
function rtpFor(g: LobbyGame): number {
  if (g.rtp != null) return g.rtp;
  if (g.gameType === "external_slot") return 96.0;
  if (g.isLive) return 97.3;
  if (g.gameType === "table") return 99.5;
  return 99.0;
}

// TOLS lobby card — full-bleed art, badge, title + category + RTP%.
export function LobbyGameCard({ game, onClick }: { game: LobbyGame; onClick: () => void }) {
  const badge = game.isLive ? "Live" : game.isNew ? "New" : game.popularity > 70 ? "Hot" : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play ${game.name}`}
      className="casino-game-card group relative block w-full aspect-[16/11] cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-[#0f1015] text-left transition-all duration-200 hover:-translate-y-1 hover:border-lime/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {game.imageUrl ? (
        /* Prefer the studio render; the catalogue's imageUrl (PNG/SVG) is the
           fallback, so games without a render still show their tile. */
        <img
          src={game.imageUrl.replace(/\.(png|svg)$/, ".jpg")}
          alt={game.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={(e) => { if (e.currentTarget.src !== game.imageUrl) e.currentTarget.src = game.imageUrl; }}
          className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center"><Gamepad2 className="h-10 w-10 text-lime/25" /></div>
      )}
      {badge && (
        <span className="absolute right-2.5 top-2.5 rounded-full border border-lime/60 bg-black/70 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-lime backdrop-blur-sm">
          {badge}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black via-black/75 to-transparent p-3 pt-10">
        <div className="min-w-0">
          <p className="truncate font-bold text-white" style={TITLE_STYLE}>{game.name}</p>
          <p className="truncate text-white/60" style={META_STYLE}>{catLabel(game)}</p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-white/70" style={META_STYLE}>{rtpFor(game).toFixed(1)}%</span>
      </div>
    </button>
  );
}

// Uniform Originals card — the artwork carries the shared TOLS title system,
// so the UI adds only an interaction affordance instead of printing a second
// title over the designed cover.
export function OriginalGameCard({ game, onClick }: { game: OriginalGameDef; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play ${game.name}`}
      className="casino-game-card group relative block w-full aspect-[16/11] cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-[#0f1015] text-left transition-all duration-200 hover:-translate-y-1 hover:border-lime/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {/* Prefer the studio render, then the generated PNG, then the SVG. */}
      <img
        src={`/games/originals/${game.id}.jpg`}
        alt={game.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => {
          const el = e.currentTarget;
          el.src = el.src.endsWith(".jpg")
            ? `/games/originals/${game.id}.png`
            : `/games/originals/${game.id}.svg`;
        }}
        className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>
      <span className="absolute right-2.5 top-2.5 shrink-0 translate-y-1 rounded-full border border-black/20 bg-lime px-2.5 py-1 text-[10px] font-black uppercase text-bg opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        Play
      </span>
    </button>
  );
}
