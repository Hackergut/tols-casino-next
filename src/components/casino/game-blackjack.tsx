'use client';

import { useCallback, useEffect, useState } from "react";
import { GameFrame, BetPanel, BetButton, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import { useGameEngine } from "@/hooks/useGameEngine";
import { PlayingCard } from "@/components/casino/playing-card";
import type { OriginalId } from "@/lib/originals-registry";

type BjCard = { r: number; s: number };

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function CardView({ card, hidden }: { card?: BjCard; hidden?: boolean }) {
  if (hidden || !card) return <PlayingCard hidden />;
  return <PlayingCard rank={RANKS[card.r]} suit={SUITS[card.s]} red={card.s === 1 || card.s === 2} />;
}

export function BlackjackGame({ onBack, initialBalance, onPickGame }: Props) {
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet("blackjack", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);
  const { round, result, pending, placeBet, sendAction, setRound, setResult } = useGameEngine("blackjack");

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
    if (latest?.newBalance != null) {
      // Balance is managed by useBet's shared store
    }
  }, [result, round]);

  const deal = useCallback(() => {
    if (pending || betAmount <= 0 || betAmount > balance) return;
    setResult(null);
    void placeBet(betAmount, {}, "start");
  }, [pending, betAmount, balance, placeBet, setResult]);

  const act = useCallback((type: string) => {
    if (!round?.roundId || pending) return;
    void sendAction(round.roundId, { type });
  }, [round, pending, sendAction]);

  const reset = () => { setRound(null); setResult(null); };

  return (
    <GameFrame
      gameId="blackjack"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={history}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={playing || pending || busy}
          action={
            !playing && !result ? (
              <BetButton onClick={deal} disabled={pending || betAmount <= 0 || betAmount > balance || busy} busy={pending}>
                {pending ? 'Dealing...' : 'Deal'}
              </BetButton>
            ) : result && !playing ? (
              <BetButton onClick={reset}>New Hand</BetButton>
            ) : (
              <div />
            )
          }
        >
          {playing && (
            <div className="grid grid-cols-3 gap-2">
              <BetButton onClick={() => act("hit")} disabled={pending} busy={pending}>Hit</BetButton>
              <BetButton onClick={() => act("stand")} disabled={pending} tone="danger" busy={pending}>Stand</BetButton>
              <BetButton onClick={() => act("double")} disabled={pending || !canDouble || betAmount > balance} busy={pending}>Double</BetButton>
            </div>
          )}
          <StatRow label="Bet" value={`$${betAmount.toFixed(2)}`} />
          <StatRow label="Player" value={playerTotal ? String(playerTotal) : '—'} tone={playerTotal > 0 ? "lime" : "muted"} />
          <StatRow label="Dealer" value={dealerTotal != null ? String(dealerTotal) : '—'} />
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="blackjack">
        {/* Felt watermark */}
        <div className="blackjack__felt-mark">
          BLACKJACK
          <span>TOLS ORIGINALS</span>
        </div>

        {/* Dealer hand */}
        <div className="blackjack__hand">
          <header>
            Dealer {dealerTotal != null ? <b>{dealerTotal}</b> : dealerUp ? <b>?</b> : null}
          </header>
          <div className="blackjack__cards">
            {playing && dealerUp ? (
              <>
                <CardView card={dealerUp} />
                <div className="blackjack__card-slot" />
              </>
            ) : dealer.length ? (
              dealer.map((c, i) => <CardView key={i} card={c} />)
            ) : (
              <div className="blackjack__card-slot" />
            )}
          </div>
        </div>

        {/* Player hand */}
        <div className="blackjack__hand" data-active={playing || undefined}>
          <header>
            You {playerTotal ? <b>{playerTotal}</b> : null}
          </header>
          <div className="blackjack__cards">
            {player.map((c, i) => <CardView key={i} card={c} />)}
          </div>
        </div>

        {/* Message */}
        <div className="blackjack__message">
          {outcome && (
            <>
              <strong className={result?.won || outcome === "push" ? "text-win" : "text-loss"}>
                {outcome.replace("_", " ").toUpperCase()}
              </strong>
              <span className={result?.won || outcome === "push" ? "text-win" : "text-loss"}>
                {result ? (result.won ? `+$${result.payout.toFixed(2)}` : `-$${result.amount.toFixed(2)}`) : ""}
              </span>
            </>
          )}
          {!outcome && !playing && <span>Place your bet and deal</span>}
        </div>
      </div>
    </GameFrame>
  );
}
