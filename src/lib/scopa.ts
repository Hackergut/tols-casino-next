/*
 * Scopa Siciliana — Fast Bet engine.
 *
 * A deterministic, provably-fair "auto game" of Sicilian Scopa. The human
 * player does NOT play Scopa: they bet on the outcome of a fully automatic
 * round played between two virtual hands ("Player" and "Bank") under a fixed,
 * published strategy (see strategy notes on `chooseCapture` below).
 *
 * This module is dependency-free on purpose: the Next.js bet engine imports it
 * through the `@/lib/scopa` alias, while the Monte Carlo simulator
 * (`scripts/scopa-sim.mjs`) loads the same file directly with Node's type
 * stripping (`node --experimental-strip-types scripts/scopa-sim.mjs`). Keeping
 * the exact same code path for both the real-money engine and the RTP
 * simulation is what makes the published probabilities auditable.
 *
 * Provably fair: the deck is shuffled with Fisher-Yates where each swap reads
 * one value from the platform's fair stream
 * (HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`) / 2^52). The
 * full round is then a pure function of that deck, so a player who is shown
 * the revealed server seed can replay the entire round and reproduce the
 * result bit-for-bit.
 */

/* ── Deck & values ─────────────────────────────────────────────────────── */

/** Sicilian suits, in the canonical order used for tie-breaks. */
export const SUITS = ["Denari", "Coppe", "Spade", "Bastoni"] as const;

/** Face cards are stored as 8 (Donna), 9 (Cavallo), 10 (Re). */
export const FACE_NAMES: Record<number, string> = {
  8: "Donna",
  9: "Cavallo",
  10: "Re",
};

/** Primiera values (historical Scopa scoring). */
export const PRIMIERA_VALUES: Record<number, number> = {
  1: 16,
  2: 12,
  3: 13,
  4: 14,
  5: 15,
  6: 18,
  7: 21,
  8: 10,
  9: 10,
  10: 10,
};

/** A Sicilian card: suit 0..3 (SUITS order), value 1..10. */
export interface Card {
  suit: number;
  value: number;
}

export function cardLabel(card: Card): string {
  return `${card.value === 8 ? "Donna" : card.value === 9 ? "Cavallo" : card.value === 10 ? "Re" : card.value} di ${SUITS[card.suit]}`;
}

/** Deterministic float source in [0,1). One `cursor` → one independent value. */
export type Rand = (cursor: number) => number;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let value = 1; value <= 10; value++) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle driven by the fair stream (one float per swap). */
export function shuffleDeck(rand: Rand): Card[] {
  const deck = createDeck();
  let cursor = 0;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand(cursor++) * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/* ── Strategy ──────────────────────────────────────────────────────────── */

/**
 * All index-combinations of `table` whose card values sum to `target`.
 * Enumerated in ascending index order, so the whole engine is deterministic.
 */
function captureCombinations(table: Card[], target: number): number[][] {
  const res: number[][] = [];
  const n = table.length;
  const dfs = (start: number, sum: number, cur: number[]): void => {
    if (sum === target) {
      res.push(cur.slice());
      return;
    }
    if (sum > target) return;
    for (let i = start; i < n; i++) {
      if (sum + table[i].value > target) continue;
      cur.push(i);
      dfs(i + 1, sum + table[i].value, cur);
      cur.pop();
    }
  };
  dfs(0, 0, []);
  return res;
}

interface CaptureCandidate {
  cardIndex: number;
  tableIndices: number[];
  played: Card;
  scopa: boolean;
  settebello: boolean;
  denari: number;
  value: number;
}

function lexCompare(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Fixed, published capture strategy (spec §1.2):
 *   1. Scopa      — capture every card on the table, if possible;
 *   2. Settebello — otherwise capture the 7 of Denari, if possible;
 *   3. otherwise, among all legal captures, take the one that captures the
 *      most Denari, then (tie) the highest total captured value;
 *   4. fully deterministic tie-breaks: lower played card value, then lower
 *      suit, then fewer table cards, then lexicographic table indices.
 * Returns null when no capture is possible (the caller must discard).
 */
function chooseCapture(hand: Card[], table: Card[]): { cardIndex: number; tableIndices: number[] } | null {
  const cands: CaptureCandidate[] = [];
  for (let ci = 0; ci < hand.length; ci++) {
    const card = hand[ci];
    for (const combo of captureCombinations(table, card.value)) {
      const taken = [card, ...combo.map((i) => table[i])];
      cands.push({
        cardIndex: ci,
        tableIndices: combo,
        played: card,
        scopa: combo.length === table.length && table.length > 0,
        settebello: taken.some((c) => c.suit === 0 && c.value === 7),
        denari: taken.filter((c) => c.suit === 0).length,
        value: taken.reduce((s, c) => s + c.value, 0),
      });
    }
  }
  if (cands.length === 0) return null;

  cands.sort((a, b) => {
    return (
      (b.scopa ? 1 : 0) - (a.scopa ? 1 : 0) ||
      (b.settebello ? 1 : 0) - (a.settebello ? 1 : 0) ||
      b.denari - a.denari ||
      b.value - a.value ||
      a.played.value - b.played.value ||
      a.played.suit - b.played.suit ||
      a.tableIndices.length - b.tableIndices.length ||
      lexCompare(a.tableIndices, b.tableIndices)
    );
  });

  const best = cands[0];
  return { cardIndex: best.cardIndex, tableIndices: best.tableIndices };
}

/* ── Scoring ───────────────────────────────────────────────────────────── */

function primiera(cards: Card[]): number {
  const best: Record<number, number> = {};
  for (const c of cards) {
    const v = PRIMIERA_VALUES[c.value];
    if (best[c.suit] === undefined || v > best[c.suit]) best[c.suit] = v;
  }
  let sum = 0;
  for (let s = 0; s < 4; s++) sum += best[s] ?? 0;
  return sum;
}

/* ── Round ─────────────────────────────────────────────────────────────── */

export interface ScopaMove {
  player: 0 | 1;
  /** Card played from the hand. Absent only for the final table sweep. */
  played: Card | null;
  /** Cards taken this move (played card + captured table cards). */
  captured: Card[];
  /** True when the move captured every card on the table (a Scopa). */
  scopa: boolean;
  /** True when the move was a discard (no capture available). */
  discarded: boolean;
  /** True when the move is the end-of-round sweep of leftover table cards. */
  sweep: boolean;
}

/**
 * Chronological replay events, superset of `moves`: deal events (initial deal
 * and re-deals) are interleaved with the moves so the client can animate the
 * entire round without reimplementing the strategy.
 */
export interface ScopaDealEvent {
  kind: "deal";
  card: Card;
  to: 0 | 1 | "table";
}

export interface ScopaMoveEvent {
  kind: "move";
  player: 0 | 1;
  played: Card | null;
  captured: Card[];
  scopa: boolean;
  discarded: boolean;
  sweep: boolean;
}

export type ScopaEvent = ScopaDealEvent | ScopaMoveEvent;

export interface ScopaRoundResult {
  deck: Card[];
  moves: ScopaMove[];
  /** Full chronological replay (deals + moves) for the animated client. */
  timeline: ScopaEvent[];
  playerCards: Card[];
  bankCards: Card[];
  playerPoints: number;
  bankPoints: number;
  playerScopa: number;
  bankScopa: number;
  playerSettebello: boolean;
  bankSettebello: boolean;
  playerDenari: number;
  bankDenari: number;
  playerPrimiera: number;
  bankPrimiera: number;
  totalPoints: number;
  outcome: "player" | "bank" | "draw";
}

export function playScopaRound(rand: Rand): ScopaRoundResult {
  const deck = shuffleDeck(rand);
  const hands: Card[][] = [[], []];
  const table: Card[] = [];
  const timeline: ScopaEvent[] = [];
  let di = 0;

  // Deal: 3 cards to each hand, then 4 to the table.
  for (let i = 0; i < 3; i++) {
    const c0 = deck[di++];
    hands[0].push(c0);
    timeline.push({ kind: "deal", card: c0, to: 0 });
    const c1 = deck[di++];
    hands[1].push(c1);
    timeline.push({ kind: "deal", card: c1, to: 1 });
  }
  for (let i = 0; i < 4; i++) {
    const c = deck[di++];
    table.push(c);
    timeline.push({ kind: "deal", card: c, to: "table" });
  }

  const captured: Card[][] = [[], []];
  const scopaCount = [0, 0];
  const moves: ScopaMove[] = [];
  let turn = 0;
  let lastCapture: 0 | 1 | null = null;

  for (;;) {
    // Re-deal 3 cards each when both hands are empty and cards remain.
    if (hands[0].length === 0 && hands[1].length === 0 && di < deck.length) {
      for (let i = 0; i < 3; i++) {
        if (di < deck.length) {
          const card = deck[di++];
          hands[0].push(card);
          timeline.push({ kind: "deal", card, to: 0 });
        }
        if (di < deck.length) {
          const card = deck[di++];
          hands[1].push(card);
          timeline.push({ kind: "deal", card, to: 1 });
        }
      }
      continue;
    }
    if (hands[0].length === 0 && hands[1].length === 0) break;

    const player = (turn % 2) as 0 | 1;
    const hand = hands[player];
    if (hand.length === 0) {
      turn++;
      continue;
    }

    const choice = chooseCapture(hand, table);
    if (choice) {
      const [played] = hand.splice(choice.cardIndex, 1);
      const tableSizeBefore = table.length;
      const taken = [played, ...choice.tableIndices.map((i) => table[i])];
      for (const i of [...choice.tableIndices].sort((a, b) => b - a)) table.splice(i, 1);
      captured[player].push(...taken);
      const isScopa = tableSizeBefore > 0 && choice.tableIndices.length === tableSizeBefore;
      if (isScopa) scopaCount[player]++;
      lastCapture = player;
      moves.push({ player, played, captured: taken, scopa: isScopa, discarded: false, sweep: false });
      timeline.push({ kind: "move", player, played, captured: taken, scopa: isScopa, discarded: false, sweep: false });
    } else {
      // Discard the lowest card (value asc, then suit asc).
      let lowest = hand[0];
      for (const c of hand) {
        if (c.value < lowest.value || (c.value === lowest.value && c.suit < lowest.suit)) lowest = c;
      }
      const idx = hand.indexOf(lowest);
      hand.splice(idx, 1);
      table.push(lowest);
      moves.push({ player, played: lowest, captured: [], scopa: false, discarded: true, sweep: false });
      timeline.push({ kind: "move", player, played: lowest, captured: [], scopa: false, discarded: true, sweep: false });
    }
    turn++;
  }

  // Standard Scopa rule: the player who made the last capture takes the
  // remaining table cards. (Without this, cards — possibly the Settebello —
  // would stay uncaptured and the card/denari/settebello/primiera categories
  // would be ill-defined.)
  if (table.length > 0) {
    const taker: 0 | 1 = lastCapture ?? 1; // fallback: dealer keeps them if nobody ever captured
    captured[taker].push(...table);
    moves.push({ player: taker, played: null, captured: table.slice(), scopa: false, discarded: false, sweep: true });
    timeline.push({ kind: "move", player: taker, played: null, captured: table.slice(), scopa: false, discarded: false, sweep: true });
    table.length = 0;
  }

  // Score (§1.3): cards, denari, settebello, primiera, +1 per scopa.
  let p0 = 0;
  let p1 = 0;

  if (captured[0].length > captured[1].length) p0++;
  else if (captured[1].length > captured[0].length) p1++;

  const den0 = captured[0].filter((c) => c.suit === 0).length;
  const den1 = captured[1].filter((c) => c.suit === 0).length;
  if (den0 > den1) p0++;
  else if (den1 > den0) p1++;

  const sett0 = captured[0].some((c) => c.suit === 0 && c.value === 7);
  const sett1 = captured[1].some((c) => c.suit === 0 && c.value === 7);
  if (sett0) p0++;
  else if (sett1) p1++;

  const prim0 = primiera(captured[0]);
  const prim1 = primiera(captured[1]);
  if (prim0 > prim1) p0++;
  else if (prim1 > prim0) p1++;

  p0 += scopaCount[0];
  p1 += scopaCount[1];

  const outcome: ScopaRoundResult["outcome"] = p0 > p1 ? "player" : p1 > p0 ? "bank" : "draw";

  return {
    deck,
    moves,
    timeline,
    playerCards: captured[0],
    bankCards: captured[1],
    playerPoints: p0,
    bankPoints: p1,
    playerScopa: scopaCount[0],
    bankScopa: scopaCount[1],
    playerSettebello: sett0,
    bankSettebello: sett1,
    playerDenari: den0,
    bankDenari: den1,
    playerPrimiera: prim0,
    bankPrimiera: prim1,
    totalPoints: p0 + p1,
    outcome,
  };
}

/* ── Bet markets ───────────────────────────────────────────────────────── */

export type ScopaMarket =
  | "player" // 1 — Player wins
  | "bank" // 2 — Bank wins
  | "draw" // X — draw
  | "over" // total points > 4.5
  | "under" // total points ≤ 4.5
  | "settebello_player" // Player captures the 7 of Denari
  | "settebello_bank" // Bank captures the 7 of Denari
  | "scopa_over"; // at least one Scopa in the round (total > 0)

export const SCOPA_MARKETS: {
  id: ScopaMarket;
  label: string;
  description: string;
}[] = [
  { id: "player", label: "1 · Giocatore", description: "Il Giocatore vince il round" },
  { id: "bank", label: "2 · Banco", description: "Il Banco vince il round" },
  { id: "draw", label: "X · Pareggio", description: "Il round termina in parità" },
  { id: "over", label: "Over 4.5", description: "Somma punti totali > 4.5" },
  { id: "under", label: "Under 4.5", description: "Somma punti totali ≤ 4.5" },
  { id: "settebello_player", label: "Settebello · Giocatore", description: "Il Giocatore cattura il 7 di Denari" },
  { id: "settebello_bank", label: "Settebello · Banco", description: "Il Banco cattura il 7 di Denari" },
  { id: "scopa_over", label: "Scopa Over 0.5", description: "Almeno una Scopa nel round" },
];

/**
 * Decimal payout odds per market (stake × odds on a win).
 *
 * Calibrated from the Monte Carlo simulation in `scripts/scopa-sim.ts`
 * (N = 10,000,000 rounds):
 *
 *   market            p        odds (floor 2dp)
 *   player            0.41702  2.30
 *   bank              0.47778  2.00
 *   draw              0.10520  9.10
 *   over              0.69811  1.37
 *   under             0.30189  3.17
 *   settebello_player 0.51110  1.87
 *   settebello_bank   0.48890  1.96
 *   scopa_over        0.78485  1.22
 *
 * odds = floor(0.96 / p_upper) where p_upper is the 95% confidence interval's
 * UPPER bound (p̂ + 1.96·SE, SE ≈ 0.00015). Using the upper bound guarantees
 * that realised RTP = p_true × odds ≤ p_upper × odds ≤ 0.96, i.e. the house
 * keeps its margin even when sampling error is considered. (The spec's §3
 * suggested the lower bound, but that is the player-favourable direction —
 * it would let RTP exceed the target. The lower-bound table differs by 1 cent
 * on bank/draw/under only: bank 2.01, draw 9.14, under 3.18.)
 */
export const SCOPA_ODDS: Record<ScopaMarket, number> = {
  player: 2.3,
  bank: 2.0,
  draw: 9.1,
  over: 1.37,
  under: 3.17,
  settebello_player: 1.87,
  settebello_bank: 1.96,
  scopa_over: 1.22,
};

/**
 * Target return for Scopa Fast Bet. The odds above are floored from
 * `SCOPA_RTP / p_upper` (95% CI upper bound on the Monte-Carlo probability),
 * so the realised return can never exceed this value. Matches Pool Rush's
 * 96% "fast bet" tier.
 */
export const SCOPA_RTP = 0.96;

export function resolveScopaMarket(market: ScopaMarket, r: ScopaRoundResult): boolean {
  switch (market) {
    case "player":
      return r.outcome === "player";
    case "bank":
      return r.outcome === "bank";
    case "draw":
      return r.outcome === "draw";
    case "over":
      return r.totalPoints > 4.5;
    case "under":
      return r.totalPoints <= 4.5;
    case "settebello_player":
      return r.playerSettebello;
    case "settebello_bank":
      return r.bankSettebello;
    case "scopa_over":
      return r.playerScopa + r.bankScopa > 0;
  }
}
