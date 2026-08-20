"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Gamepad2, Play } from "lucide-react";
import VideoLoader from "@/components/VideoLoader";
import {
  originalArtCandidates,
  originalToLobbyGame,
  type LobbyGame,
  type OriginalGameDef,
} from "./lobby-types";

export function GameLoading() {
  return <VideoLoader ready={false} />;
}

const TITLE_STYLE: CSSProperties = {
  fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)",
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 6px rgb(0 0 0 / 0.75)",
};
const META_STYLE: CSSProperties = {
  fontSize: "clamp(0.75rem, 0.7rem + 0.24vw, 0.875rem)",
  lineHeight: 1.25,
  textShadow: "0 1px 5px rgb(0 0 0 / 0.7)",
};

const CAT_LABEL: Record<string, string> = {
  original: "TOLS Originals",
  originals: "TOLS Originals",
  external_slot: "Slots",
  live: "Live Casino",
  table: "Table Games",
  external_virtual: "Virtuals",
};

function catLabel(g: LobbyGame): string {
  if (g.gameType === "original" || g.category === "originals") return "TOLS Originals";
  return CAT_LABEL[g.gameType] || g.category || g.provider;
}

function rtpFor(g: LobbyGame): number | null {
  if (g.rtp != null) return g.rtp;
  if (g.gameType === "original") return 99;
  if (g.gameType === "external_slot") return 96;
  if (g.isLive) return 97.3;
  if (g.gameType === "table") return 99.5;
  return null;
}

function artFor(g: LobbyGame): string[] {
  const slug = g.slug || g.id;
  if (g.gameType === "original" || g.category === "originals" || g.provider === "TOLS") {
    return originalArtCandidates(slug, g.imageUrl);
  }
  const u = g.imageUrl || g.thumbnailUrl || "";
  if (!u) return [];
  const jpg = u.replace(/\.(png|svg)$/i, ".jpg");
  return jpg === u ? [u] : [jpg, u];
}

function ArtImage({ candidates }: { candidates: string[] }) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const key = candidates.join("\0");
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [key]);

  const src = candidates[idx];
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0f1015]">
        <Gamepad2 className="h-10 w-10 text-lime/25" />
      </div>
    );
  }

  return (
    <>
      {!loaded && <div className="skeleton-shimmer absolute inset-0" />}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setIdx((i) => (i + 1 < candidates.length ? i + 1 : i));
        }}
        className={`absolute inset-0 h-full w-full select-none object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

function cardBadge(g: LobbyGame): string | null {
  if (g.isLive) return "Live";
  if (g.isNew) return "New";
  if (g.popularity > 70) return "Hot";
  return null;
}

export function LobbyGameCard({ game, onClick }: { game: LobbyGame; onClick: () => void }) {
  const isOriginal = game.gameType === "original" || game.category === "originals";
  const badge = cardBadge(game);
  const rtp = rtpFor(game);
  const candidates = useMemo(() => artFor(game), [game.slug, game.id, game.imageUrl, game.gameType, game.category, game.provider]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play ${game.name}`}
      className="tols-game-card group"
    >
      <ArtImage candidates={candidates} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        {isOriginal && (
          <span className="tols-game-pill tols-game-pill-original">Original</span>
        )}
      </div>
      {badge && (
        <span className={`absolute right-2.5 top-2.5 tols-game-pill ${badge === "Live" ? "tols-game-pill-live" : badge === "New" ? "tols-game-pill-new" : "tols-game-pill-hot"}`}>
          {badge}
        </span>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="tols-game-play">
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-12">
        <div className="min-w-0">
          <p className="truncate font-bold text-white" style={TITLE_STYLE}>{game.name}</p>
          <p className="truncate text-white/60" style={META_STYLE}>{catLabel(game)}</p>
        </div>
        {rtp != null && (
          <span className="shrink-0 font-semibold tabular-nums text-white/70" style={META_STYLE}>
            {rtp.toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  );
}

export function OriginalGameCard({ game, onClick }: { game: OriginalGameDef; onClick: () => void }) {
  return <LobbyGameCard game={originalToLobbyGame(game)} onClick={onClick} />;
}

export function GamesShelfGrid({ children }: { children: ReactNode }) {
  return <div className="tols-games-grid">{children}</div>;
}
