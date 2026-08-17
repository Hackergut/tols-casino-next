'use client';

/* Coinflip on the shared Originals frame. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { TARGET_RTP } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const MULTIPLIER = 2 * TARGET_RTP;

export function CoinflipGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ flip: string }>('coinflip', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [face, setFace] = useState<'heads' | 'tails'>('heads');
  const [outcome, setOutcome] = useState<null | { won: boolean; profit: number }>(null);
  const [spinning, setSpinning] = useState(false);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const flip = useCallback(async () => {
    setOutcome(null);
    setSpinning(true);
    const data = await place(betAmount, { choice });
    if (!data) { setSpinning(false); return; }

    const settle = () => {
      setFace(data.payload.flip === 'tails' ? 'tails' : 'heads');
      setOutcome({ won: data.won, profit: data.payout - data.amount });
      setSpinning(false);
    };
    // Let the coin turn before revealing; instant under reduced motion.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (reduced) settle();
    else settleTimer.current = window.setTimeout(settle, 600);
  }, [place, betAmount, choice, reduced]);

  return (
    <GameFrame
      gameId="coinflip"
      title="Coinflip"
      subtitle="Call it in the air"
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
          disabled={busy || spinning}
          action={
            <BetButton onClick={flip} disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy || spinning} repeatable>
              {spinning ? 'Flipping…' : 'Flip Coin'}
            </BetButton>
          }
        >
          <SegmentedControl
            label="Your call"
            value={choice}
            onChange={setChoice}
            disabled={busy || spinning}
            options={[{ value: 'heads', label: 'Heads' }, { value: 'tails', label: 'Tails' }]}
          />
          <div>
            <StatRow label="Win chance" value="50.00%" />
            <StatRow label="Multiplier" value={`${MULTIPLIER.toFixed(4)}×`} tone="lime" />
            <StatRow label="Profit on win" value={`$${(betAmount * MULTIPLIER - betAmount).toFixed(2)}`} tone="lime" />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="coin">
        <div className="coin__disc" data-face={face} data-spinning={spinning || undefined}>
          <span>{face === 'heads' ? 'H' : 'T'}</span>
        </div>
        <p className="coin__verdict" data-won={outcome?.won || undefined}>
          {spinning ? '…' : outcome ? (outcome.won ? `WIN +$${outcome.profit.toFixed(2)}` : 'LOSE') : 'Pick a side'}
        </p>
      </div>
    </GameFrame>
  );
}
