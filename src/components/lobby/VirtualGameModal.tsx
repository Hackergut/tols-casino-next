"use client";

// Iframe launcher for a EuroVirtuals virtual game.
// On mount: POST /api/eurovirtuals/launch with the game's id as game_uuid.
// On success: render the returned URL in a fullscreen iframe with a permissive
// sandbox (the provider needs script + form + same-origin to call our
// seamless-wallet callbacks). On error: show the message and a retry button.

import { useEffect, useState } from "react";
import { Loader2, X, AlertTriangle, RotateCcw } from "lucide-react";
import type { LobbyGame } from "./lobby-types";

type Status = "launching" | "playing" | "error";

export function VirtualGameModal({
  game,
  onClose,
}: {
  game: LobbyGame;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("launching");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setError(null);
    try {
      const r = await fetch("/api/eurovirtuals/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_uuid: game.id, device: "web" }),
      });
      const j = await r.json().catch(() => null);
      if (j?.success && j?.data?.url) {
        setUrl(String(j.data.url));
        setStatus("playing");
      } else {
        setError(j?.error || `Launch failed (HTTP ${r.status})`);
        setStatus("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStatus("error");
    }
  }

  useEffect(() => {
    // We launch a provider iframe on mount and on game change. The async
    // launch() function calls setState inside the .then chain (not
    // synchronously), but the lint rule still flags the entry point.

    void launch();
    // launch depends on game.id; we intentionally only fire once per game.

  }, [game.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 bg-surface-elevated/60 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{game.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {game.provider} · EuroVirtuals
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 bg-black">
          {status === "launching" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin text-lime" />
              <p className="text-sm text-white/70">Connecting to provider…</p>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <div className="max-w-md">
                <p className="text-base font-semibold text-white">Could not launch this game</p>
                <p className="mt-1 text-xs text-white/60">{error}</p>
              </div>
              <button
                onClick={launch}
                className="flex items-center gap-2 rounded-lg bg-lime px-4 py-2 text-sm font-bold text-bg transition-opacity hover:opacity-90"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          {status === "playing" && url && (
            <iframe
              key={url}
              src={url}
              title={game.name}
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; payment"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
