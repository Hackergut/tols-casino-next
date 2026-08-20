export const BLACKJACK_RTP = 0.9952;
export const BLACKJACK_MIN_BET = 0.1;
export const BLACKJACK_MAX_BET = 500;
export const BLACKJACK_DECKS = 6;

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export interface BlackjackCard { rank: Rank; suit: Suit }
export type HandStatus = "active" | "stood" | "bust" | "blackjack";
export interface BlackjackHand { cards: BlackjackCard[]; bet: number; status: HandStatus }
export interface BlackjackState {
  version: 1;
  deck: BlackjackCard[];
  dealer: BlackjackCard[];
  hands: BlackjackHand[];
  activeHand: number;
  originalBet: number;
  insurance: number;
  insuranceResolved: boolean;
  splitUsed: boolean;
  phase: "player" | "settled";
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
}
export type BlackjackAction = "hit" | "stand" | "double" | "split" | "insurance";

export function cardValue(rank: Rank): number { return rank === "A" ? 11 : ["K", "Q", "J"].includes(rank) ? 10 : Number(rank); }
export function handValue(cards: BlackjackCard[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (total > 21 && aces-- > 0) total -= 10;
  return { total, soft: cards.some((card) => card.rank === "A") && total <= 21 && cards.reduce((s, c) => s + cardValue(c.rank), 0) === total };
}
export function isBlackjack(cards: BlackjackCard[]): boolean { return cards.length === 2 && handValue(cards).total === 21; }
export function canSplit(hand: BlackjackHand): boolean { return hand.cards.length === 2 && cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank); }
export function dealerShouldHit(cards: BlackjackCard[]): boolean { return handValue(cards).total < 17; }

export function draw(state: BlackjackState): BlackjackCard { const card = state.deck.pop(); if (!card) throw new Error("Shoe exhausted"); return card; }
export function availableActions(state: BlackjackState, balance = Infinity): BlackjackAction[] {
  if (state.phase !== "player") return [];
  const hand = state.hands[state.activeHand];
  if (!hand || hand.status !== "active") return [];
  const actions: BlackjackAction[] = ["hit", "stand"];
  if (hand.cards.length === 2 && balance >= hand.bet) actions.push("double");
  if (!state.splitUsed && canSplit(hand) && balance >= hand.bet) actions.push("split");
  if (!state.insuranceResolved && state.dealer[1]?.rank === "A" && balance >= state.originalBet / 2) actions.push("insurance");
  return actions;
}

export function publicState(state: BlackjackState, id: string, balance: number, reveal = state.phase === "settled") {
  const dealerCards = state.dealer.map((card, index) => index === 0 && !reveal ? null : card);
  return {
    hand_id: id,
    player_hands: state.hands.map((hand) => ({ ...hand, total: handValue(hand.cards).total })),
    active_hand: state.activeHand,
    dealer_hand: dealerCards,
    dealer_total: reveal ? handValue(state.dealer).total : handValue([state.dealer[1]]).total,
    bet: state.originalBet,
    insurance: state.insurance,
    balance,
    phase: state.phase,
    actions_available: availableActions(state, balance),
    cards_remaining: state.deck.length,
    server_seed_hash: state.serverSeedHash,
    client_seed: state.clientSeed,
    nonce: state.nonce,
  };
}

export function playDealer(state: BlackjackState): void { while (dealerShouldHit(state.dealer)) state.dealer.push(draw(state)); }

export function settle(state: BlackjackState): { payout: number; result: "win" | "lose" | "push"; summary: string } {
  state.phase = "settled";
  const dealerTotal = handValue(state.dealer).total;
  const dealerBj = isBlackjack(state.dealer);
  let payout = state.insurance > 0 && dealerBj ? state.insurance * 3 : 0;
  let wins = 0, pushes = 0;
  for (const hand of state.hands) {
    const total = handValue(hand.cards).total;
    if (hand.status === "bust") continue;
    const playerBj = state.hands.length === 1 && isBlackjack(hand.cards);
    if (playerBj && !dealerBj) { payout += hand.bet * 2.5; wins++; }
    else if (dealerBj && !playerBj) { /* loss */ }
    else if (dealerTotal > 21 || total > dealerTotal) { payout += hand.bet * 2; wins++; }
    else if (total === dealerTotal) { payout += hand.bet; pushes++; }
  }
  const totalStake = state.hands.reduce((s, h) => s + h.bet, 0) + state.insurance;
  const result = payout > totalStake ? "win" : payout === totalStake ? "push" : "lose";
  return { payout: Math.round(payout * 100) / 100, result, summary: wins ? `${wins} hand${wins > 1 ? "s" : ""} won` : pushes ? "Push" : "Dealer wins" };
}
