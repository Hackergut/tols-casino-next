"use client";

// Lobby game detail modal — extracted from page.tsx (Phase 2).
import type { LobbyGame } from "./lobby-types";

export function GameDetailModal({ game, onClose }: { game: LobbyGame; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-lime/10 bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {game.imageUrl && (
          <div className="relative aspect-video">
            <img src={game.imageUrl} alt={game.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          </div>
        )}
        <div className="p-6">
          <h2 className="mb-1 text-xl font-bold text-foreground">{game.name}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{game.provider}</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {game.rtp && (
              <div className="rounded-lg bg-secondary/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RTP</p>
                <p className="font-mono text-sm font-bold tabular-nums text-lime">{game.rtp}%</p>
              </div>
            )}
            {game.volatility && (
              <div className="rounded-lg bg-secondary/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Volatility</p>
                <p className="text-sm font-bold capitalize text-foreground">{game.volatility}</p>
              </div>
            )}
          </div>
          {game.description && (
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{game.description}</p>
          )}
          <div className="flex gap-3">
            <button className="btn-press flex-1 rounded-lg bg-secondary py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground" onClick={onClose}>
              Close
            </button>
            <button className="btn-press flex-1 rounded-lg bg-lime py-2.5 text-sm font-bold text-bg">
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
