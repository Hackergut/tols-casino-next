/**
 * TOLS Casino Design Tokens — Single source of truth for the neon-glassmorphism design system.
 * 
 * Color palette:
 *   Background:    #0f1015
 *   Surface:       #16161a
 *   Lime accent:   #ccff00 / #cdf32b
 *   Win green:     #00ff66
 *   Loss red:      #ff3366
 *   Pending:       #ffb52e
 *
 * Glassmorphism: backdrop-blur-xl + translucent surfaces + subtle border glow
 * Neon: box-shadow glow on interactive/highlighted elements
 */

import type React from 'react';

// ── Colors ──
export const colors = {
  bg: '#0f1015',
  surface: '#16161a',
  surfaceGlass: 'rgba(22, 22, 26, 0.65)',
  surfaceHover: 'rgba(22, 22, 26, 0.85)',
  lime: '#ccff00',
  limeAlt: '#cdf32b',
  win: '#00ff66',
  loss: '#ff3366',
  pending: '#ffb52e',
  textPrimary: 'rgba(255, 255, 255, 0.95)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  borderDefault: 'rgba(255, 255, 255, 0.06)',
  borderGlow: 'rgba(204, 255, 0, 0.25)',
  borderActive: 'rgba(204, 255, 0, 0.5)',
} as const;

// ── Glassmorphism presets ──
export const glass = {
  panel: 'bg-[rgba(22,22,26,0.65)] backdrop-blur-xl border border-white/[0.06]',
  panelHover: 'hover:bg-[rgba(22,22,26,0.85)] hover:border-[rgba(204,255,0,0.25)]',
  card: 'bg-[rgba(22,22,26,0.55)] backdrop-blur-lg border border-white/[0.08] rounded-2xl',
  cardHover: 'hover:border-[rgba(204,255,0,0.3)] hover:shadow-[0_0_20px_rgba(204,255,0,0.08)]',
  overlay: 'bg-[rgba(15,16,21,0.8)] backdrop-blur-2xl',
} as const;

// ── Neon glow presets (for inline styles) ──
export const neon = {
  lime: '0 0 12px rgba(204, 255, 0, 0.4), 0 0 40px rgba(204, 255, 0, 0.1)',
  limeSubtle: '0 0 8px rgba(204, 255, 0, 0.2)',
  limeBright: '0 0 16px rgba(204, 255, 0, 0.6), 0 0 60px rgba(204, 255, 0, 0.15)',
  win: '0 0 12px rgba(0, 255, 102, 0.4), 0 0 40px rgba(0, 255, 102, 0.1)',
  winBright: '0 0 16px rgba(0, 255, 102, 0.6), 0 0 60px rgba(0, 255, 102, 0.15)',
  loss: '0 0 12px rgba(255, 51, 102, 0.4), 0 0 40px rgba(255, 51, 102, 0.1)',
  lossBright: '0 0 16px rgba(255, 51, 102, 0.6), 0 0 60px rgba(255, 51, 102, 0.15)',
  pending: '0 0 10px rgba(255, 181, 46, 0.3)',
  text: '0 0 8px rgba(204, 255, 0, 0.5)',
  textWin: '0 0 8px rgba(0, 255, 102, 0.5)',
  textLoss: '0 0 8px rgba(255, 51, 102, 0.5)',
} as const;

// ── Animation presets for framer-motion ──
export const motion = {
  fadeInUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  pulseGlow: {
    animate: { boxShadow: ['0 0 8px rgba(204,255,0,0.2)', '0 0 20px rgba(204,255,0,0.4)', '0 0 8px rgba(204,255,0,0.2)'] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
} as const;

// ── Utility class builders ──
export function neonBorder(color: 'lime' | 'win' | 'loss' = 'lime'): string {
  const map = { lime: 'border-[rgba(204,255,0,0.35)]', win: 'border-[rgba(0,255,102,0.35)]', loss: 'border-[rgba(255,51,102,0.35)]' };
  return map[color];
}

export function glowShadow(color: 'lime' | 'win' | 'loss' = 'lime'): React.CSSProperties {
  return { boxShadow: neon[color] };
}

// ── Convenience type re-exports ──
export type DesignColor = keyof typeof colors;
export type NeonPreset = keyof typeof neon;
export type GlassPreset = keyof typeof glass;
