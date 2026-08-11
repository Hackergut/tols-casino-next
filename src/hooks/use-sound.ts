"use client";

import { useCallback, useRef, useState } from "react";

const SOUNDS = {
  win: "/sounds/win.mp3",
  lose: "/sounds/lose.mp3",
  click: "/sounds/click.mp3",
  bet: "/sounds/bet.mp3",
  tick: "/sounds/tick.mp3",
  jackpot: "/sounds/jackpot.mp3",
} as const;

type SoundName = keyof typeof SOUNDS;

function getInitialSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("tols-sound-enabled");
  return stored !== null ? stored === "true" : true;
}

export function useSound() {
  const [enabled, setEnabled] = useState(getInitialSoundEnabled);
  const cache = useRef<Map<string, HTMLAudioElement | null>>(new Map());

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      try {
        let audio = cache.current.get(name);
        if (!audio) {
          audio = new Audio(SOUNDS[name]);
          audio.preload = "auto";
          audio.volume = 0.3;
          cache.current.set(name, audio);
        }
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Silently fail if audio can't play (e.g., autoplay policy)
        });
      } catch {
        // Silently fail
      }
    },
    [enabled]
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("tols-sound-enabled", String(next));
      return next;
    });
  }, []);

  return { enabled, toggle, play };
}
