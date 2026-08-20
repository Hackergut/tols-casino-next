import { BLACKJACK_DECKS, BLACKJACK_MAX_BET, BLACKJACK_MIN_BET, BLACKJACK_RTP } from "@/lib/blackjack";

export async function GET() {
  return Response.json({ success: true, data: {
    name: "Blackjack 1V1", decks: BLACKJACK_DECKS, rtp: BLACKJACK_RTP,
    minBet: BLACKJACK_MIN_BET, maxBet: BLACKJACK_MAX_BET, currency: "USDT",
    dealer: "S17", blackjackPayout: "3:2", insurancePayout: "2:1",
    doubleAnyTwo: true, doubleAfterSplit: true, maxSplits: 1, surrender: false,
  } });
}
