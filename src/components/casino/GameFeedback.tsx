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

import { useEffect, useState } from "react";
import { sfx } from "@/lib/game-audio";
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

      if (method === "POST" && url.includes("/api/bets")) {
        // Read a clone so the game still consumes the body itself.
        res.clone().json().then((j) => {
          // A rejected bet used to be completely silent: every game checks
          // `data.success` with no else branch, so the player tapped BET and
          // nothing happened. Surface the server's reason instead.
          if (!res.ok || !j?.success) {
            const reason = String(j?.error ?? "");
            if (res.status === 429) {
              toast.error("Troppe puntate", { description: "Attendi qualche secondo e riprova." });
            } else if (/insufficient/i.test(reason)) {
              toast.error("Saldo insufficiente", { description: "Riduci la puntata o effettua un deposito." });
            } else {
              toast.error("Puntata non riuscita", { description: reason || "Riprova." });
            }
            return;
          }
          const d = j?.data;
          if (!d) return;
          if (d.won) {
            const big = d.multiplier >= 10;
            if (big) sfx.bigWin();
            else sfx.win();
            haptic(big ? [40, 60, 40, 60, 90] : [30, 50, 30]);
            setWin({ key: Date.now(), payout: d.payout ?? 0, multiplier: d.multiplier ?? 0, big });
          } else {
            sfx.lose();
            haptic(25);
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
