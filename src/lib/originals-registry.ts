/*
 * The Originals registry — one description of every in-house game.
 *
 * Game metadata used to be scattered: the title lived in each game component,
 * the subtitle in a second copy inside the same file, the lobby card had its
 * own name and artwork, and the hero carousel had a third. Renaming a game
 * meant finding four places, and the RTP shown on a lobby card had no
 * connection to the RTP the game actually paid.
 *
 * Everything a game needs to describe itself now lives here, and the RTP is
 * derived from game-math rather than typed, so a card cannot advertise a
 * return the engine does not pay.
 */

import { TARGET_RTP, ROULETTE_RTP, SLOTS_RTP } from "@/lib/game-math";
import { POOL_RUSH_RTP } from "@/lib/pool-rush";

export type OriginalId =
  | "dice"
  | "crash"
  | "limbo"
  | "coinflip"
  | "plinko"
  | "mines"
  | "wheel"
  | "keno"
  | "shoot"
  | "poolrush"
  | "slots"
  | "roulette";

export interface OriginalMeta {
  id: OriginalId;
  /** Display name in the frame header and lobby cards. */
  name: string;
  /** One line under the title — what the player does. */
  tagline: string;
  /** Prose for the info block below the canvas. */
  description: string;
  /** Return to player, derived — never hand-typed. */
  rtp: number;
  /** Lobby artwork. */
  image: string;
  /** Rough volatility, for the info block. */
  volatility: "low" | "medium" | "high" | "variable";
}

/** Every Original, in lobby order. */
export const ORIGINALS: OriginalMeta[] = [
  {
    id: "dice",
    name: "Dice",
    tagline: "Pick a number, roll over or under",
    description:
      "Set your win chance anywhere on the slider and the payout adjusts to match it. The roll is a 52-bit uniform drawn from the committed server seed, so every result can be replayed and verified after the fact.",
    rtp: TARGET_RTP,
    image: "/games/originals/dice.jpg",
    volatility: "variable",
  },
  {
    id: "crash",
    name: "Crash",
    tagline: "Set your cash-out before the curve breaks",
    description:
      "The multiplier climbs from 1.00x until it busts. Commit your cash-out before the round runs and you are paid if the curve reaches it. The crash point is decided by the server before the first frame is drawn.",
    rtp: TARGET_RTP,
    image: "/games/originals/crash.jpg",
    volatility: "high",
  },
  {
    id: "limbo",
    name: "Limbo",
    tagline: "Set a target — the roll must clear it",
    description:
      "Choose any target multiplier and the win chance is derived from it exactly. Low targets hit often for little; high targets almost never hit, and pay accordingly. Same curve as Crash, without the wait.",
    rtp: TARGET_RTP,
    image: "/games/originals/limbo.png",
    volatility: "variable",
  },
  {
    id: "coinflip",
    name: "Coinflip",
    tagline: "Call it in the air",
    description:
      "The simplest bet on the site: heads or tails, one flip, even money less the house edge. Nothing to configure and nothing hidden.",
    rtp: TARGET_RTP,
    image: "/games/originals/coinflip.jpg",
    volatility: "low",
  },
  {
    id: "plinko",
    name: "Plinko",
    tagline: "Drop the ball and follow it down",
    description:
      "The ball bounces through 8, 12 or 16 rows of pins into a multiplier bin. Every bin pays something. Higher risk widens the gap between the edges and the centre without changing the return.",
    rtp: TARGET_RTP,
    image: "/games/originals/plinko.jpg",
    volatility: "variable",
  },
  {
    id: "mines",
    name: "Mines",
    tagline: "Pick safe tiles, avoid the mines",
    description:
      "Choose how many mines are buried in the 25-tile grid, then pick your tiles. More mines and more picks means a bigger multiplier and a smaller chance of surviving. The layout is committed before you pick.",
    rtp: TARGET_RTP,
    image: "/games/originals/mines.png",
    volatility: "variable",
  },
  {
    id: "wheel",
    name: "Wheel",
    tagline: "Spin for the multiplier under the pointer",
    description:
      "Twenty segments, three risk settings. Low risk pays small and often, high risk concentrates the return into a few large wedges. Risk changes the volatility only — never the house edge.",
    rtp: TARGET_RTP,
    image: "/games/originals/wheel.jpg",
    volatility: "variable",
  },
  {
    id: "keno",
    name: "Keno",
    tagline: "Pick up to 10 — ten of forty are drawn",
    description:
      "Select your numbers and the server draws ten from a pool of forty. Payouts are solved against the true hypergeometric odds for each pick count, so no combination is quietly worse than another.",
    rtp: TARGET_RTP,
    image: "/games/originals/keno.png",
    volatility: "medium",
  },
  {
    id: "shoot",
    name: "Shoot",
    tagline: "Pick a target and take the shot",
    description:
      "Five targets, one shot. The payout band is drawn from the committed seed the moment you fire. Most shots return a small multiplier; a few return a great deal more.",
    rtp: TARGET_RTP,
    image: "/games/originals/shoot.png",
    volatility: "high",
  },
  {
    id: "poolrush",
    name: "Pool Rush",
    tagline: "Choose the break — sink up to seven balls",
    description:
      "Fast Break turns the opening pool shot into a three-second provably-fair game. Choose one of four difficulty profiles: hit frequency falls as the top multiplier rises from 10× to 500×, while every profile stays fixed at 96% RTP. The server commits the result before the cue moves; the client reveals it only after the table animation finishes.",
    rtp: POOL_RUSH_RTP,
    image: "/games/originals/poolrush.png",
    volatility: "variable",
  },
  {
    id: "slots",
    name: "Neon Sevens",
    tagline: "Three reels, one payline",
    description:
      "A three-by-three grid with the centre row paying. SYM1 is wild and completes any combination. Reel weights and the paytable are normalised together so the return is exact.",
    rtp: SLOTS_RTP,
    image: "/games/originals/slots.jpg",
    volatility: "high",
  },
  {
    id: "roulette",
    name: "Roulette",
    tagline: "European single zero",
    description:
      "A real single-zero wheel: 37 pockets, straight-up pays 35 to 1. The maths is the genuine casino game rather than a scaled imitation, which makes it the best return on the site.",
    rtp: ROULETTE_RTP,
    image: "/games/originals/roulette.jpg",
    volatility: "medium",
  },
];

const BY_ID = new Map(ORIGINALS.map((g) => [g.id, g]));

export function getOriginal(id: OriginalId): OriginalMeta | undefined {
  return BY_ID.get(id);
}

/** Sibling games for the "More from TOLS Originals" rail. */
export function otherOriginals(id: OriginalId, limit = 8): OriginalMeta[] {
  return ORIGINALS.filter((g) => g.id !== id).slice(0, limit);
}
