"use client";

import { useEffect, useId, useMemo, useState } from "react";

/*
 * TOLS slot-machine wordmark loader — optimized, pure React/CSS, no assets.
 * Uses the project's brand wordmark font (var(--font-wordmark) = Oswald).
 * Four letter reels roll through ghosted characters with staggered stop timing,
 * resolve crisply to "TOLS", hold, then loop. Fades out when `ready`.
 * Static-rendered as the completed word (SSR / reduced-motion).
 */

const FINAL = ["T", "O", "L", "S"];
const START = ["S", "L", "O", "T"]; // reversed → rolling starts as SLOT, resolves TOLS
const DURATION = 2.2;

export default function VideoLoader({ ready }: { ready: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && minDone) {
      setFading(true);
      const t = setTimeout(() => setGone(true), 500);
      return () => clearTimeout(t);
    }
  }, [ready, minDone]);

  // useId() is stable across server and client — Math.random() here produced a
  // different value in each, so the injected <style> keyframe names mismatched
  // on hydration. Colons from the generated id aren't valid in CSS identifiers.
  const animId = "loader_" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const reels = useMemo(() => {
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const baseLen = 14;
    const targetIdx = 7;
    return FINAL.map((target, i) => {
      const symbols: string[] = [];
      for (let n = 0; n < baseLen; n++) symbols.push(alpha[(n * 5 + i * 3 + 2) % alpha.length]);
      symbols[0] = START[i];
      symbols[targetIdx] = target;
      symbols.push(...symbols.slice(0, 4)); // seam for seamless loop
      return { symbols, targetIdx, loopSteps: baseLen };
    });
  }, []);

  const keyframes = useMemo(
    () =>
      reels
        .map((_, i) => {
          const stop = 42 + i * 6; // staggered stop: 42%, 48%, 54%, 60%
          const hold = stop + 10;
          return `@keyframes ${animId}_${i}{0%,8%{transform:translateY(0)}${stop}%{transform:translateY(calc(-1em*${reels[i].targetIdx}))}${hold}%{transform:translateY(calc(-1em*${reels[i].targetIdx}))}100%{transform:translateY(calc(-1em*${reels[i].loopSteps}))}}`;
        })
        .join(""),
    [animId, reels]
  );

  if (gone) return null;

  const animate = mounted && !reduced;
  const stroke = "var(--color-lime, #ccff00)";

  const letter: React.CSSProperties = {
    fontFamily: "var(--font-wordmark), Oswald, 'Arial Narrow', sans-serif",
    fontSize: "clamp(44px, 16vw, 120px)",
    fontWeight: 700,
    lineHeight: "1em",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    WebkitTextStroke: `1px ${stroke}`,
    textShadow: `0 0 1px ${stroke}aa, 0 0 6px ${stroke}55`,
    userSelect: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg, #0c0e17)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease-out",
        pointerEvents: fading ? "none" : "auto",
      }}
      role="img"
      aria-label="Loading TOLS"
    >
      <style>{keyframes}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "0.015em", paddingLeft: "0.04em" }}>
        {reels.map((reel, i) => (
          <span key={i} style={{ position: "relative", width: "0.6em", height: "1em", overflow: "hidden", ...letter }}>
            {animate ? (
              <>
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: 0.35,
                    animation: `${animId}_${i} ${DURATION}s cubic-bezier(0.22,0.61,0.36,1) infinite`,
                    willChange: "transform",
                  }}
                >
                  {reel.symbols.map((ch, idx) => (
                    <span key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "1em", ...letter }}>
                      {ch}
                    </span>
                  ))}
                </span>
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...letter, opacity: 0 }}>
                  {FINAL[i]}
                </span>
              </>
            ) : (
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...letter }}>
                {FINAL[i]}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
