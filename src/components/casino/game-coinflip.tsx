'use client';

/* Coinflip on the shared Originals frame. */

import { useCallback, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { TARGET_RTP } from '@/lib/game-math';

interface Props { onBack: () => void; initialBalance: number; }

const MULTIPLIER = 2 * TARGET_RTP;

export function CoinflipGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const { balance, busy, error, history, fairness, place } = useBet<{ flip: string }>('coinflip', initialBalance);
  const [betAmount, setBetAmount] = useState(1);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [face, setFace] = useState<'heads' | 'tails'>('heads');
  const [outcome, setOutcome] = useState<null | { won: boolean; profit: number }>(null);
  const [spinning, setSpinning] = useState(false);

  const flip = useCallback(async () => {
    setOutcome(null);
    setSpinning(true);
    const data = await place(betAmount, { choice });
    if (!data) { setSpinning(false); return; }

    const settle = () => {
      setFace(data.payload.flip === 'tails' ? 'tails' : 'heads');
      setOutcome({ won: data.won, profit: data.payout - betAmount });
      setSpinning(false);
    };
    // Let the coin turn before revealing; instant under reduced motion.
    if (reduced) settle();
    else window.setTimeout(settle, 600);
  }, [place, betAmount, choice, reduced]);

  return (
    <GameFrame
      title="Coinflip"
      subtitle="Call it in the air"
      onBack={onBack}
      history={history}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={busy || spinning}
          action={
            <BetButton onClick={flip} disabled={betAmount <= 0 || betAmount > balance} busy={busy || spinning}>
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
