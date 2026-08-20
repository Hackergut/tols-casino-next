"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PostedAmount } from "@/casino/components/casino/PostedAmount";
import { GameBetControls } from "@/components/casino/game-shared";
import { useGameEngine } from "@/hooks/useGameEngine";
import { useOriginalsSession } from "@/lib/originals-client";
import { PlayingCard } from "@/components/casino/playing-card";

type BjCard = { r: number; s: number };

interface Props {
  onBack: () => void;
  initialBalance: number;
}

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function CardView({ card, hidden }: { card?: BjCard; hidden?: boolean }) {
  if (hidden || !card) return <PlayingCard hidden />;
  return (
    <PlayingCard
      rank={RANKS[card.r]}
      suit={SUITS[card.s]}
      red={card.s === 1 || card.s === 2}
    />
  );
}

export function BlackjackGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const { balance, setBalance } = useOriginalsSession("blackjack", { strategy: "basic" }, betAmount, initialBalance);
  const { round, result, pending, error, placeBet, sendAction, setRound, setResult } = useGameEngine("blackjack");

  const playing = Boolean(round?.pending);
  const payload = (playing ? round?.payload : result?.payload) ?? {};
  const player = (payload.player as BjCard[]) ?? [];
  const dealerUp = payload.dealerUp as BjCard | undefined;
  const dealer = (payload.dealer as BjCard[]) ?? (dealerUp ? [dealerUp] : []);
  const playerTotal = Number(payload.playerTotal ?? 0);
  const dealerTotal = payload.dealerTotal as number | undefined;
  const canDouble = Boolean(payload.canDouble);
  const outcome = payload.result as string | undefined;

  useEffect(() => {
    const latest = result ?? round;
    if (latest?.newBalance != null) setBalance(latest.availableBalance ?? latest.newBalance);
  }, [result, round]);

  const deal = useCallback(() => {
    if (pending || betAmount <= 0 || betAmount > balance) return;
    setResult(null);
    void placeBet(betAmount, {}, "start");
  }, [pending, betAmount, balance, placeBet, setResult]);

  const act = useCallback(
    (type: string) => {
      if (!round?.roundId || pending) return;
      void sendAction(round.roundId, { type });
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
          <h1>Blackjack</h1>
          <p>Beat the dealer to 21 — blackjack pays 3:2</p>
        </div>
      </div>

      <div className="game-grid">
        <div className="bj-table">
          <div className="bj-hand">
            <p className="bj-hand-label">Dealer {dealerTotal != null ? `· ${dealerTotal}` : dealerUp ? "· ?" : ""}</p>
            <div className="bj-cards">
              {playing && dealerUp ? (
                <>
                  <CardView card={dealerUp} />
                  <CardView hidden />
                </>
              ) : dealer.length ? (
                dealer.map((c, i) => <CardView key={i} card={c} />)
              ) : (
                <p className="text-sm text-white/30">Waiting for deal</p>
              )}
            </div>
          </div>

          <div className="bj-hand">
            <p className="bj-hand-label">You {playerTotal ? `· ${playerTotal}` : ""}</p>
            <div className="bj-cards">
              {player.map((c, i) => (
                <CardView key={i} card={c} />
              ))}
            </div>
          </div>

          {outcome && (
            <div className={`bj-banner ${result?.won || outcome === "push" ? "win" : "loss"}`}>
              {outcome.replace("_", " ").toUpperCase()}{" "}
              {result ? (result.won ? `+$${result.payout.toFixed(2)}` : `-$${result.amount.toFixed(2)}`) : ""}
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
              {pending ? "Dealing…" : "Deal"}
            </button>
          )}
          {playing && (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => act("hit")} disabled={pending} className="g-btn g-btn-play">
                Hit
              </button>
              <button onClick={() => act("stand")} disabled={pending} className="g-btn g-btn-secondary">
                Stand
              </button>
              <button onClick={() => act("double")} disabled={pending || !canDouble || betAmount > balance} className="g-btn g-btn-secondary">
                Double
              </button>
            </div>
          )}
          {result && !playing && (
            <button onClick={reset} className="g-btn g-btn-secondary">
              New hand
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
