"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PostedAmount } from "@/casino/components/casino/PostedAmount";
import { GameBetControls } from "@/components/casino/game-shared";
import { useGameEngine } from "@/hooks/useGameEngine";
import { useOriginalsSession } from "@/lib/originals-client";
import { PlayingCard } from "@/components/casino/playing-card";

type ScopaCard = { r: number; s: number };

interface Props {
  onBack: () => void;
  initialBalance: number;
}

const SUITS = ["♦", "♥", "♣", "♠"];
const SUIT_NAME = ["Coins", "Cups", "Clubs", "Swords"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "F", "C", "R"];

function ScopaCardView({ card, onClick, disabled }: { card: ScopaCard; onClick?: () => void; disabled?: boolean }) {
  return (
    <PlayingCard
      rank={RANKS[card.r]}
      suit={SUITS[card.s]}
      red={card.s === 0 || card.s === 1}
      onClick={onClick}
      disabled={disabled || !onClick}
      title={SUIT_NAME[card.s]}
    />
  );
}

export function ScopaGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const { balance, setBalance } = useOriginalsSession("scopa", { strategy: "greedy" }, betAmount, initialBalance);
  const { round, result, pending, error, placeBet, sendAction, setRound, setResult } = useGameEngine("scopa");

  const playing = Boolean(round?.pending);
  const payload = (playing ? round?.payload : result?.payload) ?? {};
  const table = (payload.table as ScopaCard[]) ?? [];
  const playerHand = (payload.playerHand as ScopaCard[]) ?? [];
  const playerCaptured = (payload.playerCaptured as ScopaCard[]) ?? [];
  const dealerCaptured = (payload.dealerCaptured as ScopaCard[]) ?? [];
  const playerScope = Number(payload.playerScope ?? 0);
  const dealerScope = Number(payload.dealerScope ?? 0);
  const outcome = payload.result as string | undefined;
  const playerPts = payload.playerPts as number | undefined;
  const dealerPts = payload.dealerPts as number | undefined;
  const lastMove = payload.lastMove as { card?: ScopaCard; scopa?: boolean } | undefined;

  useEffect(() => {
    const latest = result ?? round;
    if (latest?.newBalance != null) setBalance(latest.availableBalance ?? latest.newBalance);
  }, [result, round, setBalance]);

  const deal = useCallback(() => {
    if (pending || betAmount <= 0 || betAmount > balance) return;
    setResult(null);
    void placeBet(betAmount, {}, "start");
  }, [pending, betAmount, balance, placeBet, setResult]);

  const play = useCallback(
    (cardIndex: number) => {
      if (!round?.roundId || pending) return;
      void sendAction(round.roundId, { type: "play", cardIndex });
    },
    [round, pending, sendAction],
  );

  const reset = () => {
    setRound(null);
    setResult(null);
  };

  return (
    <div className="game-wrapper compact-game">
      <div className="g-header">
        <button onClick={onBack} className="g-back" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1>Scopa</h1>
          <p>A quick hand against the bank — match pairs or sums to sweep. Most points wins.</p>
        </div>
      </div>

      <div className="game-grid">
        <div className="bj-table scopa-table">
          <div className="bj-hand">
            <p className="bj-hand-label">
              Bank · {dealerCaptured.length} cards · {dealerScope} sweeps
              {dealerPts != null ? ` · ${dealerPts} pt` : ""}
            </p>
            <div className="bj-cards">
              {dealerCaptured.slice(-4).map((c, i) => (
                <ScopaCardView key={`d-${i}`} card={c} />
              ))}
              {!dealerCaptured.length && <p className="text-sm text-white/30">No captures</p>}
            </div>
          </div>

          <div className="bj-hand">
            <p className="bj-hand-label">Table</p>
            <div className="bj-cards">
              {table.length ? table.map((c, i) => <ScopaCardView key={`t-${i}`} card={c} />) : <p className="text-sm text-white/30">Empty table</p>}
            </div>
          </div>

          <div className="bj-hand">
            <p className="bj-hand-label">
              You · {playerCaptured.length} cards · {playerScope} sweeps
              {playerPts != null ? ` · ${playerPts} pt` : ""}
            </p>
            <div className="bj-cards">
              {playing
                ? playerHand.map((c, i) => (
                    <ScopaCardView key={`p-${i}`} card={c} onClick={() => play(i)} disabled={pending} />
                  ))
                : playerCaptured.slice(-4).map((c, i) => <ScopaCardView key={`pc-${i}`} card={c} />)}
              {playing && !playerHand.length && <p className="text-sm text-white/30">Waiting for the bank…</p>}
            </div>
          </div>

          {lastMove?.scopa && playing && <div className="bj-banner win">SCOPA!</div>}
          {outcome && (
            <div className={`bj-banner ${result?.won || outcome === "push" ? "win" : "loss"}`}>
              {outcome.toUpperCase()} {playerPts ?? "—"}–{dealerPts ?? "—"}{" "}
              {result ? (result.won ? `+$${result.payout.toFixed(2)}` : outcome === "push" ? "push" : `-$${result.amount.toFixed(2)}`) : ""}
            </div>
          )}
          {error && <p className="text-center text-sm text-loss">{error}</p>}
        </div>

        <div className="space-y-2">
          <div className="g-balance">
            <p className="g-balance-label">Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="g-balance-value" />
          </div>
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={playing || pending} />
          {!playing && !result && (
            <button onClick={deal} disabled={pending || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
              {pending ? "Dealing…" : "Deal cards"}
            </button>
          )}
          {playing && <p className="text-center text-xs text-white/40">Play a card from your hand</p>}
          {result && !playing && (
            <button onClick={reset} className="g-btn g-btn-secondary">
              New hand
            </button>
          )}
          <p className="text-[10px] leading-relaxed text-white/35">
            Capture by matching a card or summing to its value. Clearing the table is a sweep. Most cards, most coins, the seven of coins and the sweeps win 1.90x (+0.30x per sweep).
          </p>
        </div>
      </div>
    </div>
  );
}
