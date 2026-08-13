"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";

/*
 * Launcher for a EuroVirtuals game. Unlike the Originals (rendered directly),
 * these run on EuroVirtuals' own servers — we call /api/eurovirtuals/launch for
 * a signed player token + iframe URL, then embed it. Money moves through their
 * seamless-wallet callbacks (POST /api/eurovirtuals/[action]), not this
 * component; on-screen balance updates happen when the player returns to the
 * lobby and it refetches.
 */
interface Props {
  gameUuid: string;
  gameName: string;
  onBack: () => void;
}

export function EuroVirtualsGame({ gameUuid, gameName, onBack }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    fetch("/api/eurovirtuals/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_uuid: gameUuid, device: window.innerWidth < 768 ? "mobile" : "web" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success && j.data?.url) setUrl(j.data.url);
        else setError(j.error || "Could not launch this game");
      })
      .catch(() => { if (!cancelled) setError("Could not reach the game server"); });
    return () => { cancelled = true; };
  }, [gameUuid]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 pb-2">
        <button onClick={onBack} className="game-back-btn btn-press" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">{gameName}</h1>
          <p className="text-xs text-white/40">Powered by EuroVirtuals</p>
        </div>
      </div>

      <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-xl bg-black">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-loss" />
            <p className="text-sm font-semibold text-white/80">{error}</p>
            <button onClick={onBack} className="game-action-btn-secondary mt-2 w-auto px-4">Back to lobby</button>
          </div>
        ) : !url ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime/25 border-t-lime" />
          </div>
        ) : (
          <iframe
            src={url}
            title={gameName}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen; payment"
          />
        )}
      </div>
    </div>
  );
}
