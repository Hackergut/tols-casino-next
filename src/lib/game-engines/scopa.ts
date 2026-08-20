import { fairFloat } from "@/lib/provably-fair";
import type { GameEngine, SettledOutcome } from "@/shared/types";
import { okAmount } from "./common";

export type ScopaCard = { r: number; s: number };

function shuffleDeck(serverSeed: string, clientSeed: string, nonce: number): ScopaCard[] {
  const deck: ScopaCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 10; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(fairFloat(serverSeed, clientSeed, nonce, i) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sameCard(a: ScopaCard, b: ScopaCard) {
  return a.r === b.r && a.s === b.s;
}

function withoutCards(from: ScopaCard[], take: ScopaCard[]) {
  const left = [...from];
  for (const t of take) {
    const i = left.findIndex((c) => sameCard(c, t));
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

function subsetsSumming(table: ScopaCard[], target: number): ScopaCard[][] {
  const out: ScopaCard[][] = [];
  const rec = (i: number, acc: ScopaCard[], sum: number) => {
    if (sum === target && acc.length >= 2) out.push([...acc]);
    if (i >= table.length || sum >= target) return;
    rec(i + 1, acc, sum);
    rec(i + 1, [...acc, table[i]], sum + table[i].r);
  };
  rec(0, [], 0);
  return out;
}

export function bestCapture(table: ScopaCard[], card: ScopaCard): ScopaCard[] | null {
  const equals = table.filter((c) => c.r === card.r);
  if (equals.length) return [equals[0]];
  const sums = subsetsSumming(table, card.r);
  if (!sums.length) return null;
  sums.sort((a, b) => {
    const aScopa = a.length === table.length ? 1 : 0;
    const bScopa = b.length === table.length ? 1 : 0;
    if (bScopa !== aScopa) return bScopa - aScopa;
    if (b.length !== a.length) return b.length - a.length;
    const a7 = a.some((c) => c.r === 7 && c.s === 0) ? 1 : 0;
    const b7 = b.some((c) => c.r === 7 && c.s === 0) ? 1 : 0;
    return b7 - a7;
  });
  return sums[0];
}

function captureScore(table: ScopaCard[], card: ScopaCard): number {
  const cap = bestCapture(table, card);
  if (!cap) return -card.r;
  let s = 10 + cap.length;
  if (cap.length === table.length) s += 50;
  if (cap.some((c) => c.r === 7 && c.s === 0) || (card.r === 7 && card.s === 0)) s += 20;
  return s;
}

export function choosePlay(hand: ScopaCard[], table: ScopaCard[]): number {
  let bestIdx = 0;
  let best = -Infinity;
  hand.forEach((card, i) => {
    const s = captureScore(table, card);
    if (s > best) {
      best = s;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function applyPlay(
  hand: ScopaCard[],
  table: ScopaCard[],
  captured: ScopaCard[],
  scope: number,
  cardIndex: number,
) {
  const card = hand[cardIndex];
  const nextHand = hand.filter((_, i) => i !== cardIndex);
  const cap = bestCapture(table, card);
  if (cap) {
    const nextTable = withoutCards(table, cap);
    const scopa = nextTable.length === 0;
    return {
      hand: nextHand,
      table: nextTable,
      captured: [...captured, card, ...cap],
      scope: scope + (scopa ? 1 : 0),
      scopa,
      capturedNow: cap,
      card,
      took: true,
    };
  }
  return {
    hand: nextHand,
    table: [...table, card],
    captured,
    scope,
    scopa: false,
    capturedNow: [] as ScopaCard[],
    card,
    took: false,
  };
}

function tally(captured: ScopaCard[], scope: number) {
  return {
    cards: captured.length,
    denari: captured.filter((c) => c.s === 0).length,
    settebello: captured.some((c) => c.r === 7 && c.s === 0),
    scope,
  };
}

function comparePoints(
  player: ReturnType<typeof tally>,
  dealer: ReturnType<typeof tally>,
): { playerPts: number; dealerPts: number } {
  let playerPts = player.scope;
  let dealerPts = dealer.scope;
  if (player.settebello) playerPts += 1;
  if (dealer.settebello) dealerPts += 1;
  if (player.cards > dealer.cards) playerPts += 1;
  else if (dealer.cards > player.cards) dealerPts += 1;
  if (player.denari > dealer.denari) playerPts += 1;
  else if (dealer.denari > player.denari) dealerPts += 1;
  return { playerPts, dealerPts };
}

function settleFromPiles(
  amount: number,
  playerCaptured: ScopaCard[],
  dealerCaptured: ScopaCard[],
  playerScope: number,
  dealerScope: number,
): SettledOutcome {
  const pt = tally(playerCaptured, playerScope);
  const dt = tally(dealerCaptured, dealerScope);
  const { playerPts, dealerPts } = comparePoints(pt, dt);
  let result = "lose";
  let multiplier = 0;
  if (playerPts > dealerPts) {
    result = "win";
    multiplier = Math.round((1.9 + Math.min(2, playerScope) * 0.3) * 100) / 100;
  } else if (playerPts === dealerPts) {
    result = "push";
    multiplier = 1;
  }
  const payout = amount * multiplier;
  return {
    multiplier,
    payout,
    profit: payout - amount,
    won: result === "win",
    payload: {
      result,
      playerPts,
      dealerPts,
      playerScope,
      dealerScope,
      playerCaptured,
      dealerCaptured,
      settebello: pt.settebello,
    },
  };
}

type Piles = {
  table: ScopaCard[];
  playerHand: ScopaCard[];
  dealerHand: ScopaCard[];
  playerCaptured: ScopaCard[];
  dealerCaptured: ScopaCard[];
  playerScope: number;
  dealerScope: number;
  lastCapturer: "player" | "dealer" | null;
};

function finishIfDone(piles: Piles, amount: number, extra: Record<string, unknown>) {
  if (piles.playerHand.length > 0 || piles.dealerHand.length > 0) {
    return {
      status: "pending" as const,
      publicState: {
        table: piles.table,
        playerHand: piles.playerHand,
        dealerCount: piles.dealerHand.length,
        playerCaptured: piles.playerCaptured,
        dealerCaptured: piles.dealerCaptured,
        playerScope: piles.playerScope,
        dealerScope: piles.dealerScope,
        ...extra,
      },
    };
  }
  let playerCaptured = piles.playerCaptured;
  let dealerCaptured = piles.dealerCaptured;
  if (piles.table.length) {
    if (piles.lastCapturer === "player") playerCaptured = [...playerCaptured, ...piles.table];
    else dealerCaptured = [...dealerCaptured, ...piles.table];
  }
  const settled = settleFromPiles(amount, playerCaptured, dealerCaptured, piles.playerScope, piles.dealerScope);
  return {
    status: "settled" as const,
    settled,
    publicState: {
      table: [] as ScopaCard[],
      playerHand: [] as ScopaCard[],
      dealerCount: 0,
      playerCaptured,
      dealerCaptured,
      playerScope: piles.playerScope,
      dealerScope: piles.dealerScope,
      playerPts: settled.payload.playerPts,
      dealerPts: settled.payload.dealerPts,
      result: settled.payload.result,
      settebello: settled.payload.settebello,
      ...extra,
    },
  };
}

function playBoth(piles: Piles, playerIndex: number) {
  const p = applyPlay(piles.playerHand, piles.table, piles.playerCaptured, piles.playerScope, playerIndex);
  const afterPlayer: Piles = {
    ...piles,
    playerHand: p.hand,
    table: p.table,
    playerCaptured: p.captured,
    playerScope: p.scope,
    lastCapturer: p.took ? "player" : piles.lastCapturer,
  };
  const playerMove = { who: "player", card: p.card, captured: p.capturedNow, scopa: p.scopa };

  if (afterPlayer.dealerHand.length === 0) {
    return { piles: afterPlayer, playerMove, dealerMove: null };
  }
  const di = choosePlay(afterPlayer.dealerHand, afterPlayer.table);
  const d = applyPlay(afterPlayer.dealerHand, afterPlayer.table, afterPlayer.dealerCaptured, afterPlayer.dealerScope, di);
  return {
    piles: {
      ...afterPlayer,
      dealerHand: d.hand,
      table: d.table,
      dealerCaptured: d.captured,
      dealerScope: d.scope,
      lastCapturer: d.took ? "dealer" : afterPlayer.lastCapturer,
    },
    playerMove,
    dealerMove: { who: "dealer", card: d.card, captured: d.capturedNow, scopa: d.scopa },
  };
}

export const scopaEngine: GameEngine = {
  id: "scopa",
  name: "Scopa",
  kind: "interactive",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const shoe = shuffleDeck(serverSeed, clientSeed, nonce);
    return {
      table: shoe.slice(0, 4),
      playerHand: shoe.slice(4, 7),
      dealerHand: shoe.slice(7, 10),
    };
  },
  settleBet(bet, outcome) {
    const table = (outcome.table as ScopaCard[]) ?? [];
    const playerHand = [...((outcome.playerHand as ScopaCard[]) ?? [])];
    const dealerHand = [...((outcome.dealerHand as ScopaCard[]) ?? [])];
    let piles: Piles = {
      table,
      playerHand,
      dealerHand,
      playerCaptured: [],
      dealerCaptured: [],
      playerScope: 0,
      dealerScope: 0,
      lastCapturer: null,
    };
    while (piles.playerHand.length) {
      const idx = choosePlay(piles.playerHand, piles.table);
      piles = playBoth(piles, idx).piles;
    }
    const done = finishIfDone(piles, bet.amount, {});
    return done.settled ?? settleFromPiles(bet.amount, piles.playerCaptured, piles.dealerCaptured, piles.playerScope, piles.dealerScope);
  },
  handlePlayerAction(action, state) {
    const secretDealer = (state.secret.dealerHand as ScopaCard[]) ?? [];
    const piles: Piles = {
      table: [...((state.publicState.table as ScopaCard[]) ?? (state.secret.table as ScopaCard[]) ?? [])],
      playerHand: [...((state.publicState.playerHand as ScopaCard[]) ?? (state.secret.playerHand as ScopaCard[]) ?? [])],
      dealerHand: [...secretDealer],
      playerCaptured: [...((state.publicState.playerCaptured as ScopaCard[]) ?? [])],
      dealerCaptured: [...((state.publicState.dealerCaptured as ScopaCard[]) ?? [])],
      playerScope: Number(state.publicState.playerScope ?? 0),
      dealerScope: Number(state.publicState.dealerScope ?? 0),
      lastCapturer: (state.secret.lastCapturer as Piles["lastCapturer"]) ?? null,
    };

    if (action.type === "deal-check") {
      return {
        ...state,
        secret: { dealerHand: piles.dealerHand, lastCapturer: null },
        publicState: {
          table: piles.table,
          playerHand: piles.playerHand,
          dealerCount: piles.dealerHand.length,
          playerCaptured: [],
          dealerCaptured: [],
          playerScope: 0,
          dealerScope: 0,
        },
      };
    }

    if (action.type !== "play" || state.status === "settled") return state;
    const idx = Number(action.cardIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= piles.playerHand.length) return state;

    const { piles: next, playerMove, dealerMove } = playBoth(piles, idx);
    const done = finishIfDone(next, state.amount, { lastMove: playerMove, dealerMove });

    if (done.status === "settled" && done.settled) {
      return {
        ...state,
        status: "settled",
        won: done.settled.won,
        multiplier: done.settled.multiplier,
        payout: done.settled.payout,
        secret: { dealerHand: next.dealerHand, lastCapturer: next.lastCapturer },
        publicState: done.publicState,
      };
    }

    return {
      ...state,
      secret: { dealerHand: next.dealerHand, lastCapturer: next.lastCapturer },
      publicState: done.publicState,
    };
  },
  autoResolve(bet, outcome) {
    return this.settleBet(bet, outcome);
  },
};
