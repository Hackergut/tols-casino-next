'use client';

/*
 * Sicilian playing card — authentic Sicilian deck styling ("carte siciliane").
 *
 * Drawn as pure SVG so both casino surfaces (public + admin) render the exact
 * same artwork, readable at every size. The deck follows the traditional
 * Sicilian suits and their classic colours:
 *   Denari (gold rosette coins), Coppe (tall red chalices),
 *   Spade (curved blue scimitars), Bastoni (green knotty batons).
 * Number cards (Asso..7) show the pips in a standard playing-card layout with
 * corner indices; court cards (Donna=8, Cavallo=9, Re=10) show full standing
 * figures in a framed panel, as in the real Sicilian deck.
 */

import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Card } from '@/lib/scopa';
import { SCOPA_SUIT_COLOR } from '@/lib/scopa-playback';

/* Corner index: Asso, 2..7, Donna, Cavallo, Re. */
const CORNER_LABEL: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: 'D',
  9: 'C',
  10: 'R',
};

/* ── Suit glyphs (drawn at origin, ~±10 units, scaled via `s`) ─────────── */

function SuitGlyph({ suit, x, y, s }: { suit: number; x: number; y: number; s: number }) {
  const c = SCOPA_SUIT_COLOR[suit];
  if (suit === 0) {
    // Denari — a coin with a radial rosette (the classic Sicilian "moneta").
    const petals = [0, 60, 120, 180, 240, 300].map((a) => {
      const rad = (a * Math.PI) / 180;
      return { cx: 4.4 * Math.cos(rad), cy: 4.4 * Math.sin(rad) };
    });
    return (
      <g transform={`translate(${x} ${y}) scale(${s / 10})`}>
        <circle r="8.6" fill="none" stroke={c} strokeWidth="1.6" />
        <circle r="6.6" fill="none" stroke={c} strokeWidth="0.7" opacity="0.55" />
        {petals.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="1.35" fill={c} />
        ))}
        <circle r="1.5" fill={c} />
      </g>
    );
  }
  if (suit === 1) {
    // Coppe — a tall, narrow chalice: deep bowl, thin stem, wide foot.
    return (
      <g transform={`translate(${x} ${y}) scale(${s / 10})`}>
        <path d="M -4.6 -8.4 Q 0 -10.6 4.6 -8.4 L 4.1 -1.6 Q 0 3.4 -4.1 -1.6 Z" fill={c} />
        <path d="M -1 3.8 h 2 v 2.4 h -2 z" fill={c} />
        <path d="M -4.6 6.2 h 9.2 v 1.6 h -9.2 z" fill={c} />
      </g>
    );
  }
  if (suit === 2) {
    // Spade — a curved scimitar: crescent blade, crossguard, grip, pommel.
    return (
      <g transform={`translate(${x} ${y}) scale(${s / 10})`}>
        <path d="M -3.2 6.2 C -6.4 1.2 -4.4 -5 0 -8.2 C 2.4 -5.2 2.2 -2 1.2 1 Z" fill={c} />
        <path d="M -4.2 1.6 H 3.2 V 3 H -4.2 Z" fill={c} />
        <path d="M -0.9 3 h 1.8 v 2.3 h -1.8 z" fill={c} />
        <circle cx="0" cy="6.4" r="1.35" fill={c} />
      </g>
    );
  }
  // Bastoni — a knotty baton: rounded head, shaft, and a couple of knots.
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 10})`}>
      <path d="M -1.25 -8.4 h 2.5 v 14.4 a 1.25 1.25 0 0 1 -2.5 0 Z" fill={c} />
      <path d="M -2.5 -11.2 h 5 v 2.9 a 2.5 2.5 0 0 1 -5 0 Z" fill={c} />
      <path d="M -1.6 -4 h 3.2 v 1.6 h -3.2 z" fill={c} />
      <path d="M -1.6 1.6 h 3.2 v 1.6 h -3.2 z" fill={c} />
    </g>
  );
}

/* ── Pip arrangements (1..7) ───────────────────────────────────────────── */

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 74]],
  2: [[50, 44], [50, 104]],
  3: [[50, 40], [50, 74], [50, 108]],
  4: [[34, 47], [66, 47], [34, 101], [66, 101]],
  5: [[34, 47], [66, 47], [50, 74], [34, 101], [66, 101]],
  6: [[34, 45], [66, 45], [34, 74], [66, 74], [34, 103], [66, 103]],
  7: [[34, 45], [66, 45], [34, 74], [66, 74], [34, 103], [66, 103], [50, 74]],
};

function NumberFace({ suit, value }: { suit: number; value: number }) {
  const pips = PIP_LAYOUT[value] ?? [[50, 74]];
  return (
    <g>
      {pips.map(([x, y], i) => (
        <SuitGlyph key={i} suit={suit} x={x} y={y} s={11} />
      ))}
      <g opacity="0.06" transform="translate(50 74)">
        <SuitGlyph suit={suit} x={0} y={0} s={52} />
      </g>
    </g>
  );
}

/* ── Court figures: Donna, Cavallo, Re (full standing) ─────────────────── */

const GOLD = '#d7a10f';

function ReFigure({ color }: { color: string }) {
  return (
    <g>
      {/* crown */}
      <path d="M -8 -33 L -8 -36.5 L -4 -33.5 L 0 -38.5 L 4 -33.5 L 8 -36.5 L 8 -33 Z" fill={GOLD} />
      <rect x="-8.4" y="-33" width="16.8" height="2.8" rx="1.3" fill={GOLD} />
      {/* head + beard */}
      <circle cx="0" cy="-24" r="5.4" fill={color} />
      <path d="M -4.8 -20.5 Q 0 -12 4.8 -20.5 Z" fill={color} />
      {/* robe */}
      <path d="M -9.5 -13.5 L 9.5 -13.5 L 12.5 21 L -12.5 21 Z" fill={color} />
      <path d="M -3 -13.5 L 3 -13.5 L 4.8 21 L -4.8 21 Z" fill="#000000" opacity="0.28" />
      {/* mantle */}
      <path d="M -9.5 -13.5 L -2 -13.5 L -4.5 21 L -12.5 21 Z" fill="#000000" opacity="0.18" />
      {/* sword */}
      <rect x="10" y="-30" width="2.2" height="44" rx="1.1" fill={GOLD} />
      <rect x="8.1" y="-18" width="6" height="1.7" rx="0.85" fill={GOLD} />
      <circle cx="11.1" cy="-31" r="2" fill={GOLD} />
    </g>
  );
}

function DonnaFigure({ color }: { color: string }) {
  return (
    <g>
      {/* hair */}
      <path d="M -5.2 -25 C -8 -20 -8.6 -12 -6.4 -5.5 L -3.6 -5.5 C -4.6 -10 -4.6 -17 -3.8 -23 Z" fill={color} />
      <path d="M 5.2 -25 C 8 -20 8.6 -12 6.4 -5.5 L 3.6 -5.5 C 4.6 -10 4.6 -17 3.8 -23 Z" fill={color} />
      {/* head */}
      <circle cx="0" cy="-23" r="5.2" fill={color} />
      {/* necklace */}
      <circle cx="0" cy="-15.6" r="1" fill="none" stroke={GOLD} strokeWidth="0.9" />
      {/* dress */}
      <path d="M -8.5 -14 L 8.5 -14 L 14 21 L -14 21 Z" fill={color} />
      <path d="M -3 -14 L 3 -14 L 5 21 L -5 21 Z" fill="#000000" opacity="0.26" />
      <path d="M -8.5 -14 L -3 -14 L -5 21 L -14 21 Z" fill="#000000" opacity="0.16" />
    </g>
  );
}

function CavalloFigure({ color }: { color: string }) {
  return (
    <g fill={color}>
      {/* horse legs */}
      <rect x="-10.4" y="15" width="2" height="7.4" rx="0.9" />
      <rect x="-6.2" y="15" width="2" height="7.4" rx="0.9" />
      <rect x="4.4" y="15" width="2" height="7.4" rx="0.9" />
      <rect x="8.4" y="15" width="2" height="7.4" rx="0.9" />
      {/* body */}
      <path d="M -13 15 Q -14 7.5 -4 7.5 L 9 7.5 Q 14 7.5 12.6 15 Z" />
      {/* neck + head */}
      <path d="M 9.5 11 L 13.5 4.5 L 15.4 5.6 L 14.6 0.4 L 12.4 0.4 L 11.4 3.6 L 8.2 6.4 Z" />
      <path d="M 12.6 0.4 L 13.6 -2.8 L 14.8 0.4 Z" />
      {/* tail */}
      <path d="M -13 12.5 Q -17 12.5 -15.8 6.5 Q -14.8 9.5 -11.6 9.5 Z" />
      {/* rider torso + head + arm */}
      <path d="M -3.4 7.5 L 3.2 7.5 L 2.2 -0.5 L -2.2 -0.5 Z" />
      <circle cx="0" cy="-3.6" r="2.7" />
      <path d="M -2.8 1 L -5.4 4.2 L -2.8 5.2 Z" />
    </g>
  );
}

function FaceCard({ suit, value }: { suit: number; value: number }) {
  const c = SCOPA_SUIT_COLOR[suit];
  return (
    <g>
      <rect x="13" y="28" width="74" height="88" rx="6" fill="none" stroke={c} strokeOpacity="0.45" strokeWidth="1.2" />
      <rect x="17" y="32" width="66" height="80" rx="4" fill={c} fillOpacity="0.05" />
      <g transform="translate(50 74)">
        {value === 10 ? (
          <ReFigure color={c} />
        ) : value === 9 ? (
          <CavalloFigure color={c} />
        ) : (
          <DonnaFigure color={c} />
        )}
      </g>
      <SuitGlyph suit={suit} x={50} y={110} s={6} />
    </g>
  );
}

/* ── The card ──────────────────────────────────────────────────────────── */

function CornerIndices({ suit, value }: { suit: number; value: number }) {
  const c = SCOPA_SUIT_COLOR[suit];
  const label = CORNER_LABEL[value];
  return (
    <g>
      <text x="8" y="14" fontSize="12.5" fontWeight="800" fill={c} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        {label}
      </text>
      <SuitGlyph suit={suit} x={10} y={21} s={6} />
      <g transform="rotate(180 50 70)">
        <text x="8" y="14" fontSize="12.5" fontWeight="800" fill={c} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          {label}
        </text>
        <SuitGlyph suit={suit} x={10} y={21} s={6} />
      </g>
    </g>
  );
}

export function SicilianCard({ card, style }: { card: Card; style?: CSSProperties }) {
  const c = SCOPA_SUIT_COLOR[card.suit];
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 100 140"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={style}
      aria-label={`${CORNER_LABEL[card.value]} di ${['Denari', 'Coppe', 'Spade', 'Bastoni'][card.suit]}`}
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf7ec" />
          <stop offset="1" stopColor="#e8e1cc" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="99" height="139" rx="8" fill={`url(#${gradId})`} stroke="#00000022" />
      <rect x="3.5" y="3.5" width="93" height="133" rx="6" fill="none" stroke={c} strokeOpacity="0.22" />
      <CornerIndices suit={card.suit} value={card.value} />
      {card.value >= 8 ? (
        <FaceCard suit={card.suit} value={card.value} />
      ) : (
        <NumberFace suit={card.suit} value={card.value} />
      )}
    </svg>
  );
}

export function SicilianCardBack({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={style} aria-hidden>
      <rect x="0.5" y="0.5" width="99" height="139" rx="8" fill="#15233c" stroke="#00000033" />
      <rect x="5" y="5" width="90" height="130" rx="5" fill="none" stroke="#ffffff22" strokeWidth="1" />
      <g stroke="#ffffff0d" strokeWidth="1.6">
        <path d="M 5 5 L 95 135 M 95 5 L 5 135" />
        <path d="M 5 70 L 95 70 M 50 5 L 50 135" />
      </g>
      <circle cx="50" cy="70" r="19" fill="none" stroke="#ccff00" strokeWidth="1.4" />
      <circle cx="50" cy="70" r="12" fill="none" stroke="#ccff00" strokeOpacity="0.5" strokeWidth="1" />
      <text x="50" y="74" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ccff00" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        TOLS
      </text>
    </svg>
  );
}

export default SicilianCard;
