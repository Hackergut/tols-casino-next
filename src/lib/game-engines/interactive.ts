import { fairFloat } from "@/lib/provably-fair";
import type { GameEngine, InteractiveRoundState, SettledOutcome } from "@/shared/types";
import { MIN_BET } from "@/shared/constants";

function okAmount(amount: number, balance: number) {
  if (!Number.isFinite(amount) || amount < MIN_BET) return { valid: false, error: "Invalid bet amount" };
  if (amount > balance) return { valid: false, error: "Insufficient balance" };
  return { valid: true };
}

function paid(amount: number, multiplier: number, payload: Record<string, unknown>): SettledOutcome {
  const payout = amount * multiplier;
  return { multiplier, payout, profit: payout - amount, won: multiplier > 0, payload };
}

function crashPointFromSeeds(serverSeed: string, clientSeed: string, nonce: number): number {
  const r = fairFloat(serverSeed, clientSeed, nonce);
  if (r < 0.02) return 1.0;
  return Math.floor(Math.max(1.0, 0.99 / (1 - r)) * 100) / 100;
}

export const crashEngine: GameEngine = {
  id: "crash",
  name: "Crash",
  kind: "interactive",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const cashOutAt = Number(params.cashOutAt ?? 0);
    if (cashOutAt !== 0 && cashOutAt < 1.01) return { valid: false, error: "Auto cashout must be ≥ 1.01" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    return { crashPoint: crashPointFromSeeds(serverSeed, clientSeed, nonce) };
  },
  settleBet(bet, outcome) {
    const cashOutAt = Number(bet.params.cashOutAt ?? 0);
    const point = Number(outcome.crashPoint);
    const won = cashOutAt > 0 && point >= cashOutAt;
    return paid(bet.amount, won ? cashOutAt : 0, { crashPoint: point, cashOutAt });
  },
  handlePlayerAction(action, state) {
    const crashPoint = Number(state.secret.crashPoint);
    const startedAt = Number(state.secret.startedAt ?? Date.now());
    if (action.type === "bust") {
      return {
        ...state,
        status: "settled",
        won: false,
        multiplier: 0,
        payout: 0,
        publicState: { ...state.publicState, crashPoint, cashedAt: 0 },
      };
    }
    if (action.type === "cashout") {
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      const live = Math.floor(Math.exp(0.06 * elapsed) * 100) / 100;
      const requested = Number(action.cashOutAt ?? live);
      const cashedAt = Math.min(Math.max(1.01, requested), live);
      const won = live < crashPoint && cashedAt <= crashPoint;
      const multiplier = won ? cashedAt : 0;
      return {
        ...state,
        status: "settled",
        won,
        multiplier,
        payout: state.amount * multiplier,
        publicState: { ...state.publicState, crashPoint, cashedAt: won ? cashedAt : 0, live },
      };
    }
    return state;
  },
  autoResolve(bet, outcome) {
    return this.settleBet(bet, outcome);
  },
};

function minesLayout(serverSeed: string, clientSeed: string, nonce: number, mines: number, tiles = 25): boolean[] {
  const arr = new Array(tiles).fill(false);
  const indices = Array.from({ length: tiles }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(fairFloat(serverSeed, clientSeed, nonce, i) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let k = 0; k < mines; k++) arr[indices[k]] = true;
  return arr;
}

function nextMineMultiplier(picks: number, mines: number, tiles = 25): number {
  let m = 1;
  for (let i = 0; i < picks; i++) m *= (tiles - i) / (tiles - mines - i);
  return Math.max(1, m * 0.99);
}

export const minesEngine: GameEngine = {
  id: "mines",
  name: "Mines",
  kind: "interactive",
  validateBet(params, balance, amount) {
    const base = okAmount(amount, balance);
    if (!base.valid) return base;
    const mines = Number(params.mines ?? 3);
    if (mines < 1 || mines > 24) return { valid: false, error: "Mines must be between 1 and 24" };
    return { valid: true };
  },
  generateOutcome(serverSeed, clientSeed, nonce, params) {
    const mines = Math.min(24, Math.max(1, Number(params.mines ?? 3)));
    return { layout: minesLayout(serverSeed, clientSeed, nonce, mines), mines };
  },
  settleBet(bet, outcome) {
    const minesCount = Math.min(24, Math.max(1, Number(bet.params.mines ?? outcome.mines ?? 3)));
    const picks = Array.isArray(bet.params.picks) ? (bet.params.picks as number[]) : [];
    const layout = outcome.layout as boolean[];
    const hitMine = picks.some((p) => layout[p]);
    const multiplier = hitMine ? 0 : nextMineMultiplier(picks.length, minesCount);
    const won = !hitMine && picks.length > 0;
    return paid(bet.amount, won ? multiplier : 0, { mines: minesCount, picks, layout });
  },
  handlePlayerAction(action, state) {
    const layout = state.secret.layout as boolean[];
    const minesCount = Number(state.secret.mines ?? 3);
    const picks = Array.isArray(state.publicState.picks) ? ([...state.publicState.picks] as number[]) : [];

    if (action.type === "reveal") {
      const cell = Number(action.cellIndex);
      if (!Number.isInteger(cell) || cell < 0 || cell > 24 || picks.includes(cell)) return state;
      picks.push(cell);
      if (layout[cell]) {
        return {
          ...state,
          status: "settled",
          won: false,
          multiplier: 0,
          payout: 0,
          publicState: { picks, hit: cell, layout, mines: minesCount },
        };
      }
      const gemsTotal = 25 - minesCount;
      const multiplier = nextMineMultiplier(picks.length, minesCount);
      if (picks.length >= gemsTotal) {
        return {
          ...state,
          status: "settled",
          won: true,
          multiplier,
          payout: state.amount * multiplier,
          publicState: { picks, layout, mines: minesCount, cleared: true },
        };
      }
      return {
        ...state,
        multiplier,
        publicState: { picks, mines: minesCount, multiplier },
      };
    }

    if (action.type === "cashout") {
      if (picks.length === 0) return state;
      const multiplier = nextMineMultiplier(picks.length, minesCount);
      return {
        ...state,
        status: "settled",
        won: true,
        multiplier,
        payout: state.amount * multiplier,
        publicState: { picks, layout, mines: minesCount },
      };
    }
    return state;
  },
  autoResolve(bet, outcome) {
    const layout = outcome.layout as boolean[];
    const want = Math.max(1, Number(bet.params.tilesToReveal ?? 3));
    const picks: number[] = [];
    for (let i = 0; i < 25 && picks.length < want; i++) {
      picks.push(i);
      if (layout[i]) break;
    }
    return this.settleBet({ amount: bet.amount, params: { ...bet.params, picks } }, outcome);
  },
};

export type BjCard = { r: number; s: number };

function shuffleShoe(serverSeed: string, clientSeed: string, nonce: number): BjCard[] {
  const deck: BjCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(fairFloat(serverSeed, clientSeed, nonce, i) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function bjHandValue(cards: BjCard[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 1) {
      aces++;
      total += 11;
    } else total += Math.min(10, c.r);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

function isBlackjack(cards: BjCard[]): boolean {
  return cards.length === 2 && bjHandValue(cards).total === 21;
}

function dealerPlay(dealer: BjCard[], shoe: BjCard[], cursor: number): { dealer: BjCard[]; cursor: number } {
  const next = [...dealer];
  let c = cursor;
  while (bjHandValue(next).total < 17) {
    next.push(shoe[c++]);
  }
  return { dealer: next, cursor: c };
}

function bjPayout(amount: number, player: BjCard[], dealer: BjCard[], doubled: boolean): SettledOutcome {
  const p = bjHandValue(player).total;
  const d = bjHandValue(dealer).total;
  const stake = doubled ? amount * 2 : amount;
  const playerBj = isBlackjack(player) && !doubled;
  const dealerBj = isBlackjack(dealer);

  let multiplier = 0;
  let result = "lose";
  if (p > 21) {
    multiplier = 0;
    result = "bust";
  } else if (playerBj && !dealerBj) {
    multiplier = 2.5;
    result = "blackjack";
  } else if (dealerBj && !playerBj) {
    multiplier = 0;
    result = "dealer_bj";
  } else if (d > 21) {
    multiplier = 2;
    result = "dealer_bust";
  } else if (p > d) {
    multiplier = 2;
    result = "win";
  } else if (p === d) {
    multiplier = 1;
    result = "push";
  } else {
    multiplier = 0;
    result = "lose";
  }

  // Double: stake is 2x, multiplier is still 0 / 1 / 2 against the doubled stake.
  const payout = (doubled ? amount * 2 : amount) * (multiplier === 2.5 ? 2.5 : multiplier === 2 ? 2 : multiplier === 1 ? 1 : 0);
  // Express multiplier vs original amount so wallet math stays amount * multiplier.
  const vsOriginal = payout / amount;
  return {
    multiplier: vsOriginal,
    payout,
    profit: payout - stake,
    won: payout > 0,
    payload: { player, dealer, result, doubled, playerTotal: p, dealerTotal: d },
  };
}

export const blackjackEngine: GameEngine = {
  id: "blackjack",
  name: "Blackjack",
  kind: "interactive",
  validateBet(_p, balance, amount) {
    return okAmount(amount, balance);
  },
  generateOutcome(serverSeed, clientSeed, nonce) {
    const shoe = shuffleShoe(serverSeed, clientSeed, nonce);
    const player = [shoe[0], shoe[2]];
    const dealer = [shoe[1], shoe[3]];
    return { shoe, player, dealer, cursor: 4 };
  },
  settleBet(bet, outcome) {
    const player = outcome.player as BjCard[];
    const dealer = outcome.dealer as BjCard[];
    return bjPayout(bet.amount, player, dealer, false);
  },
  handlePlayerAction(action, state) {
    const shoe = state.secret.shoe as BjCard[];
    let cursor = Number(state.secret.cursor ?? 4);
    const player = [...((state.publicState.player as BjCard[] | undefined) ?? (state.secret.player as BjCard[]))];
    const dealer = [...(state.secret.dealer as BjCard[])];
    const doubled = Boolean(state.secret.doubled);

    const reveal = (nextPlayer: BjCard[], nextDealer: BjCard[], extraDebit = 0, isDouble = doubled) => {
      const settled = bjPayout(state.amount, nextPlayer, nextDealer, isDouble);
      return {
        ...state,
        status: "settled" as const,
        won: settled.won,
        multiplier: settled.multiplier,
        payout: settled.payout,
        extraDebit,
        secret: { ...state.secret, dealer: nextDealer, cursor, doubled: isDouble },
        publicState: {
          player: nextPlayer,
          dealer: nextDealer,
          dealerUp: nextDealer[0],
          playerTotal: bjHandValue(nextPlayer).total,
          dealerTotal: bjHandValue(nextDealer).total,
          result: settled.payload.result,
        },
      };
    };

    if (action.type === "deal-check") {
      if (isBlackjack(player) || isBlackjack(dealer)) return reveal(player, dealer);
      return {
        ...state,
        publicState: {
          player,
          dealerUp: dealer[0],
          playerTotal: bjHandValue(player).total,
          canDouble: player.length === 2,
        },
      };
    }

    if (action.type === "hit") {
      player.push(shoe[cursor++]);
      const total = bjHandValue(player).total;
      if (total > 21) return reveal(player, dealer);
      return {
        ...state,
        secret: { ...state.secret, cursor },
        publicState: {
          player,
          dealerUp: dealer[0],
          playerTotal: total,
          canDouble: false,
        },
      };
    }

    if (action.type === "stand") {
      const played = dealerPlay(dealer, shoe, cursor);
      cursor = played.cursor;
      return reveal(player, played.dealer);
    }

    if (action.type === "double") {
      if (player.length !== 2) return state;
      player.push(shoe[cursor++]);
      const played = dealerPlay(dealer, shoe, cursor);
      return reveal(player, played.dealer, state.amount, true);
    }

    return state;
  },
  autoResolve(bet, outcome) {
    const shoe = outcome.shoe as BjCard[];
    let cursor = Number(outcome.cursor ?? 4);
    const player = [...(outcome.player as BjCard[])];
    let dealer = [...(outcome.dealer as BjCard[])];
    if (isBlackjack(player) || isBlackjack(dealer)) return bjPayout(bet.amount, player, dealer, false);
    while (bjHandValue(player).total < 17) {
      player.push(shoe[cursor++]);
      if (bjHandValue(player).total > 21) return bjPayout(bet.amount, player, dealer, false);
    }
    const played = dealerPlay(dealer, shoe, cursor);
    dealer = played.dealer;
    return bjPayout(bet.amount, player, dealer, false);
  },
};
