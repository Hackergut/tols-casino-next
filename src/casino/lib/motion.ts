// GoldenX motion language — see DESIGN.md. Springs are the default; durations
// mirror the CSS tokens (--dur-fast/base/slow) for the few tween cases.
import type { Transition } from "framer-motion";

export const springs = {
  /** default for interactive elements: buttons, tiles, chips */
  snappy: { type: "spring", stiffness: 500, damping: 32 } as Transition,
  /** layout shifts, sidebar, modals */
  soft: { type: "spring", stiffness: 300, damping: 28 } as Transition,
  /** landings: coins, balls, the wheel settle */
  bounce: { type: "spring", stiffness: 600, damping: 18 } as Transition,
};

export const DUR = { fast: 0.12, base: 0.24, slow: 0.48 };

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
