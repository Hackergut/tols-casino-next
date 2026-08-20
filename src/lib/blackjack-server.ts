import { createHmac } from "crypto";
import { BLACKJACK_DECKS, type BlackjackCard, type Rank, type Suit } from "@/lib/blackjack";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Six-deck CSPRNG shoe, deterministically reproducible from the committed seed tuple. */
export function shuffledShoe(serverSeed: string, clientSeed: string, nonce: number): BlackjackCard[] {
  const cards: BlackjackCard[] = [];
  for (let deck = 0; deck < BLACKJACK_DECKS; deck++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ rank, suit });
  let cursor = 0;
  const random = () => {
    const hex = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:blackjack:${cursor++}`).digest("hex").slice(0, 13);
    return parseInt(hex, 16) / 0x10000000000000;
  };
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.pop();
  return cards;
}
