/*
 * TOLS design tokens — calibrated to Apple Human Interface Guidelines.
 *
 * Reference points (iOS/iPadOS HIG):
 *  · 8pt base grid — all spacing is a multiple of 4/8
 *  · 44×44pt minimum hit target for any control
 *  · Layout margins 16pt (compact) / 20pt (regular)
 *  · Continuous corner radius ~16–20pt for content cards
 *  · App Store shelf cards: small 160 / medium 240 / large 320pt wide,
 *    with the next card "peeking" to signal horizontal scroll
 */

/** 8pt grid. Use these instead of arbitrary pixel values. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,   // compact layout margin
  lg: 20,     // regular layout margin
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Minimum comfortable hit target (HIG: 44×44pt). */
export const HIT_TARGET = 44;

/** Continuous-corner radii for cards and controls. */
export const RADIUS = {
  control: 12,
  card: 20,
  sheet: 28,
} as const;

/**
 * Card widths, App Store shelf scale. `peek` leaves part of the next card
 * visible so the shelf reads as scrollable without any affordance.
 */
export const CARD_W = {
  small: 180,
  medium: 260,
  large: 320,
  hero: 420,
} as const;

export type CardSize = keyof typeof CARD_W;

/** Game tile art is 16:11 — matches the generated 1280×880 assets. */
export const CARD_ASPECT = "16 / 11";

/** Responsive card width: clamps between a floor and the HIG shelf size. */
export function cardWidth(size: CardSize): string {
  const w = CARD_W[size];
  // Never below 44pt-friendly touch width; grows to the shelf size.
  return `clamp(150px, ${Math.round(w * 0.62)}px + 12vw, ${w}px)`;
}
