"use client";

/*
 * Cross-cutting game feel.
 *
 * Every game settles through POST /api/bets, so instead of editing eleven
 * components (and having the next one forget), this wraps fetch once and
 * reacts to the settled bet: audio cue, haptic pulse, and a win celebration
 * scaled to how big the win was. Games keep their own board animations; this
 * adds the layer none of them had — nine of eleven had no win feedback at all,
 * and two had no animation whatsoever.
 */

import { useEffect, useState, useCallback } from "react";
import { sfx, isSoundEnabled, setSoundEnabled } from "@/lib/game-audio";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface Win {
  key: number;
  payout: number;
  multiplier: number;
  big: boolean;
}

/** Short pulse on settle; ignored on hardware without a vibrator. */
function haptic(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function GameFeedback() {
  const [win, setWin] = useState<Win | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);

  useEffect(() => {
    const onBet = (e: Event) => {
      const d = (e as CustomEvent).detail as { pending?: boolean; won?: boolean; payout?: number; multiplier?: number } | undefined;
      if (!d || d.pending) return;
      if (d.won) {
        const big = (d.multiplier ?? 0) >= 10;
        big ? sfx.bigWin() : sfx.win();
        haptic(big ? [40, 60, 40, 60, 90] : [30, 50, 30]);
        setWin({ key: Date.now(), payout: d.payout ?? 0, multiplier: d.multiplier ?? 0, big });
      } else {
        sfx.lose();
        haptic(25);
      }
    };
    window.addEventListener("tols:bet", onBet);
    return () => window.removeEventListener("tols:bet", onBet);
  }, []);

  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      let res: Response;
      try {
        res = await original(...args);
      } catch (e) {
        const u = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
        if (u.includes("/api/bets")) {
          toast.error("Connessione persa", { description: "La puntata non è stata inviata." });
        }
        throw e;
      }
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
      const method = (args[1]?.method ?? (args[0] as Request)?.method ?? "GET").toUpperCase();

      const isOriginalsPost =
        method === "POST" &&
        (url.includes("/api/bets") || /\/api\/games\/[^/]+\/(action|auto-bet)/.test(url));
      if (isOriginalsPost) {
        res.clone().json().then((j) => {
          if (!res.ok || !j?.success) {
            const reason = String(j?.error ?? "");
            if (res.status === 429) {
              toast.error("Troppe puntate", { description: "Attendi qualche secondo e riprova." });
            } else if (/insufficient/i.test(reason)) {
              toast.error("Saldo insufficiente", { description: "Riduci la puntata o effettua un deposito." });
            } else {
              toast.error("Puntata non riuscita", { description: reason || "Riprova." });
            }
          }
        }).catch(() => {});
      }
      return res;
    };

    return () => { window.fetch = original; };
  }, []);

  // Celebration clears itself; a big win lingers a beat longer.
  useEffect(() => {
    if (!win) return;
    const t = setTimeout(() => setWin(null), win.big ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [win]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) sfx.click();
  }, [soundOn]);

  return (
    <>
      <style>{`
        @keyframes tolsWinPop {
          0%   { transform: scale(0.7) translateY(14px); opacity: 0 }
          45%  { transform: scale(1.06) translateY(0);   opacity: 1 }
          70%  { transform: scale(1) }
          100% { transform: scale(1) translateY(-6px);   opacity: 0 }
        }
        @keyframes tolsSpark {
          0%   { transform: translate(0,0) scale(1); opacity: 1 }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0 }
        }
        @keyframes tolsFlash { 0% { opacity: 0.35 } 100% { opacity: 0 } }
      `}</style>

      {/* Sound switch — audio must always be one tap from off. */}
      <button
        onClick={toggleSound}
        aria-label={soundOn ? "Disattiva audio" : "Attiva audio"}
        className="fixed bottom-[5.5rem] left-3 z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface/90 text-white/70 backdrop-blur-sm transition-colors hover:text-lime lg:bottom-4"
      >
        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>

      {win && (
        <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center">
          {win.big && (
            <div
              className="absolute inset-0 bg-lime"
              style={{ animation: "tolsFlash 0.5s ease-out forwards" }}
            />
          )}

          <div
            key={win.key}
            className="relative flex flex-col items-center"
            style={{ animation: `tolsWinPop ${win.big ? 2.6 : 1.7}s ease-out forwards` }}
          >
            <span
              className="font-display text-5xl text-lime sm:text-6xl"
              style={{ textShadow: "0 0 28px color-mix(in oklab, var(--color-lime) 55%, transparent)" }}
            >
              +${win.payout.toFixed(2)}
            </span>
            <span className="mt-1 text-sm font-bold tracking-widest text-white/70">
              {win.multiplier.toFixed(2)}× {win.big ? "· BIG WIN" : ""}
            </span>

            {/* Radial spark burst, heavier on a big win. */}
            {Array.from({ length: win.big ? 18 : 10 }).map((_, i, arr) => {
              const a = (i / arr.length) * Math.PI * 2;
              const dist = win.big ? 170 : 110;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-lime"
                  style={{
                    // @ts-expect-error custom properties drive the keyframe
                    "--dx": `${Math.cos(a) * dist}px`,
                    "--dy": `${Math.sin(a) * dist}px`,
                    animation: `tolsSpark ${win.big ? 1.1 : 0.8}s ease-out forwards`,
                    animationDelay: `${i * 0.02}s`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
