"use client";

import { useEffect, useId, useMemo, useState } from "react";

/*
 * TOLS slot-machine wordmark loader — pure React/CSS, no assets.
 *
 * The reels animate through CSS keyframes, NOT a JS `mounted` flag: the animated
 * markup is identical on server and client (keyframe names come from useId, so
 * they match on hydration), so the animation runs immediately and can't get
 * stuck in a static state if an effect is flaky. Reduced motion is honoured with
 * a media query that freezes the reels on the payline.
 *
 * Dismissal is fail-safe: the overlay fades out when the app is `ready` (after a
 * short minimum), OR after a hard cap — a loading screen must never trap the app
 * if the readiness signal never arrives.
 */

const FINAL = ["T", "O", "L", "S"];
const START = ["S", "L", "O", "T"]; // reels start on SLOT, resolve to TOLS
const DURATION = 2.2;
const MIN_MS = 1100;   // minimum on-screen time (avoids a flash)
const CAP_MS = 3500;   // hard cap — always gone by now

export default function VideoLoader({ ready }: { ready: boolean }) {
  const [minDone, setMinDone] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Fail-safe: dismiss even if `ready` never becomes true.
  useEffect(() => {
    const t = setTimeout(() => setCapReached(true), CAP_MS);
    return () => clearTimeout(t);
  }, []);

  const done = (ready && minDone) || capReached;
  useEffect(() => {
    if (!done) return;
    setFading(true);
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [done]);

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
      symbols.push(...symbols.slice(0, 4)); // seam for a seamless loop
      return { symbols, targetIdx, loopSteps: baseLen };
    });
  }, []);

  const css = useMemo(() => {
    const frames = reels
      .map((r, i) => {
        const stop = 42 + i * 6; // staggered stop 42/48/54/60%
        const hold = stop + 10;
        return `@keyframes ${animId}_${i}{0%,8%{transform:translateY(0)}${stop}%{transform:translateY(calc(-1em*${r.targetIdx}))}${hold}%{transform:translateY(calc(-1em*${r.targetIdx}))}100%{transform:translateY(calc(-1em*${r.loopSteps}))}}`;
      })
      .join("");
    // Reduced motion: freeze every reel on its payline (needs !important to beat
    // the inline animation shorthand).
    const rm = `@media (prefers-reduced-motion: reduce){.${animId}-strip{animation:none !important;transform:translateY(calc(-1em*7))}}`;
    // Pure-CSS fail-safe: hide the overlay after the cap even if React never
    // hydrates (slow network, hydration hiccup) — the app must never stay
    // trapped behind the loader. An animation overrides the inline opacity.
    const autohide = `@keyframes ${animId}-hide{to{opacity:0;visibility:hidden;pointer-events:none}}.${animId}-overlay{animation:${animId}-hide 0.45s ease-out ${CAP_MS}ms forwards}`;
    return frames + rm + autohide;
  }, [animId, reels]);

  if (gone) return null;

  const stroke = "var(--color-lime, #cdf32b)";
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
        background: "var(--color-bg, #0f1015)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease-out",
        pointerEvents: fading ? "none" : "auto",
      }}
      role="img"
      aria-label="Loading TOLS"
      className={`${animId}-overlay`}
    >
      <style>{css}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "0.015em", paddingLeft: "0.04em" }}>
        {reels.map((reel, i) => (
          <span key={i} style={{ position: "relative", width: "0.6em", height: "1em", overflow: "hidden", ...letter }}>
            <span
              className={`${animId}-strip`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
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
          </span>
        ))}
      </div>
    </div>
  );
}
