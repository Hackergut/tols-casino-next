/** Shared contracts for TOLS Originals — engines, bets, auto-bet, PF. */

export const ORIGINAL_GAME_IDS = [
  "dice",
  "limbo",
  "crash",
  "plinko",
  "mines",
  "coinflip",
  "wheel",
  "keno",
  "shoot",
  "slots",
  "roulette",
  "blackjack",
] as const;

export type OriginalGameId = (typeof ORIGINAL_GAME_IDS)[number];

export type EngineKind = "instant" | "interactive";

export interface BetValidation {
  valid: boolean;
  error?: string;
}

export interface SettledOutcome {
  multiplier: number;
  payout: number;
  profit: number;
  won: boolean;
  payload: Record<string, unknown>;
}

export interface GameEngine {
  id: OriginalGameId;
  name: string;
  kind: EngineKind;
  validateBet(params: Record<string, unknown>, userBalance: number, amount: number): BetValidation;
  generateOutcome(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    params: Record<string, unknown>,
  ): Record<string, unknown>;
  settleBet(
    bet: { amount: number; params: Record<string, unknown> },
    outcome: Record<string, unknown>,
  ): SettledOutcome;
  /** Optional: mutate an in-progress interactive round. */
  handlePlayerAction?(
    action: { type: string } & Record<string, unknown>,
    state: InteractiveRoundState,
  ): InteractiveRoundState;
  /** Resolve one full auto-bet tick without a client animation. */
  autoResolve?(
    bet: { amount: number; params: Record<string, unknown> },
    outcome: Record<string, unknown>,
  ): SettledOutcome;
}

export interface InteractiveRoundState {
  status: "pending" | "settled";
  amount: number;
  publicState: Record<string, unknown>;
  secret: Record<string, unknown>;
  multiplier: number;
  payout: number;
  won: boolean;
  extraDebit?: number;
}

export type AutoAdjustMode = "reset" | "increase" | "decrease" | "fixed";

export interface AutoBetParams {
  rounds: number;
  baseBet: number;
  onWin: AutoAdjustMode;
  onLoss: AutoAdjustMode;
  onWinPercent: number;
  onLossPercent: number;
  stopLoss: number;
  takeProfit: number;
  gameParams: Record<string, unknown>;
}

export interface AutoBetStatus {
  id: string;
  gameId: string;
  status: "running" | "stopped" | "completed" | "failed";
  roundsPlayed: number;
  currentBet: number;
  currentProfit: number;
  lastError: string;
  params: AutoBetParams;
}

export interface FairCommitment {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface BetResponse {
  betId: string;
  roundId?: string;
  game: string;
  amount: number;
  multiplier: number;
  payout: number;
  won: boolean;
  payload: Record<string, unknown>;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  newBalance: number;
  controlApplied: string | null;
  pending?: boolean;
}
