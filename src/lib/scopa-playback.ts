/*
 * Scopa Siciliana — client-side replay helpers.
 *
 * The server returns the full chronological `timeline` (deal + move events,
 * see `src/lib/scopa.ts`). These pure helpers let the animated table rebuild
 * the board state event-by-event WITHOUT reimplementing the strategy: the
 * strategy was already applied server-side, so the client just replays the
 * result. `applyEventTo` is a pure reducer (never mutates its input), so it is
 * safe to use inside React functional state updates and to fast-forward.
 */

import type { Card, ScopaEvent } from "./scopa";

/* ── Suit presentation (shared by both casino surfaces) ────────────────── */

export const SCOPA_SUIT_SYMBOL: Record<number, string> = {
  0: "◆",
  1: "♥",
  2: "♠",
  3: "♣",
};

export const SCOPA_SUIT_NAME: Record<number, string> = {
  0: "Denari",
  1: "Coppe",
  2: "Spade",
  3: "Bastoni",
};

// Traditional Sicilian deck colours: Denari gold, Coppe red, Spade deep blue,
// Bastoni green — the classic regional card palette.
export const SCOPA_SUIT_COLOR: Record<number, string> = {
  0: "#d7a10f", // denari — gold
  1: "#c3311c", // coppe — red
  2: "#274a8f", // spade — deep blue
  3: "#2f7a3a", // bastoni — green
};

/** Unique per-card key — a 40-card deck has exactly one of each (suit, value). */
export function scopaCardKey(card: Card): string {
  return `${card.suit}:${card.value}`;
}

/** Compact face label, e.g. "7◆", "D♥" (Donna), "C♠" (Cavallo), "R♣" (Re). */
export function scopaShort(card: Card): string {
  const v = card.value <= 7 ? String(card.value) : card.value === 8 ? "D" : card.value === 9 ? "C" : "R";
  return `${v}${SCOPA_SUIT_SYMBOL[card.suit]}`;
}

/* ── Board state ───────────────────────────────────────────────────────── */

export interface ScopaBoard {
  /** Hands, still face-up: [Giocatore, Banco]. */
  hands: [Card[], Card[]];
  /** Cards currently on the table (tavolo). */
  table: Card[];
  /** Captured piles: [Giocatore, Banco]. */
  piles: [Card[], Card[]];
}

export function emptyBoard(): ScopaBoard {
  return { hands: [[], []], table: [], piles: [[], []] };
}

/**
 * Pure reducer: apply one replay event to a board and return a new board.
 * `played` is always the first element of `captured` for a capture move.
 */
export function applyEventTo(ev: ScopaEvent, board: ScopaBoard): ScopaBoard {
  const hands: [Card[], Card[]] = [board.hands[0].slice(), board.hands[1].slice()];
  const table = board.table.slice();
  const piles: [Card[], Card[]] = [board.piles[0].slice(), board.piles[1].slice()];

  if (ev.kind === "deal") {
    if (ev.to === "table") table.push(ev.card);
    else hands[ev.to].push(ev.card);
    return { hands, table, piles };
  }

  if (ev.sweep) {
    // Last capture takes everything left on the table.
    piles[ev.player] = piles[ev.player].concat(table);
    return { hands, table: [], piles };
  }

  if (ev.discarded) {
    const key = scopaCardKey(ev.played as Card);
    hands[ev.player] = hands[ev.player].filter((c) => scopaCardKey(c) !== key);
    table.push(ev.played as Card);
    return { hands, table, piles };
  }

  // Capture: the played card leaves the hand, captured table cards leave the
  // table, and the whole taken set (played first) lands in the player's pile.
  const playedKey = scopaCardKey(ev.played as Card);
  hands[ev.player] = hands[ev.player].filter((c) => scopaCardKey(c) !== playedKey);
  const taken = new Set(ev.captured.map(scopaCardKey));
  const rest = table.filter((c) => !taken.has(scopaCardKey(c)));
  piles[ev.player] = piles[ev.player].concat(ev.captured);
  return { hands, table: rest, piles };
}

/** Fast-forward a whole timeline to the final board (used for skip / reduced motion). */
export function finalBoard(timeline: ScopaEvent[]): ScopaBoard {
  let board = emptyBoard();
  for (const ev of timeline) board = applyEventTo(ev, board);
  return board;
}

/** Cards left to draw at a given point in the replay. */
export function remainingDeck(timeline: ScopaEvent[], appliedCount: number): number {
  let dealt = 0;
  for (let i = 0; i < Math.min(appliedCount, timeline.length); i++) {
    if (timeline[i].kind === "deal") dealt++;
  }
  return Math.max(0, 40 - dealt);
}
