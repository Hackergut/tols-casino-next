'use client';

/* Coinflip on the shared Originals frame. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, isAutoRunning } from '@/components/casino/useAutoBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
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
  // The call lasts between sessions — it used to reset to heads on every
  // visit even though the stake and every other game's settings survive.
  const [choice, setChoice] = useGameSetting<'heads' | 'tails'>('coinflip', 'choice', 'heads', ['heads', 'tails']);
  const [face, setFace] = useState<'heads' | 'tails'>('heads');
  const [outcome, setOutcome] = useState<null | { won: boolean; profit: number }>(null);
  const [spinning, setSpinning] = useState(false);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const flip = useCallback(async (): Promise<number | null> => {
    setOutcome(null);
    setSpinning(true);
    const data = await place(betAmount, { choice });
    if (!data) { setSpinning(false); return null; }

    const net = Math.round((data.payout - data.amount) * 100) / 100;
    const settle = () => {
      setFace(data.payload.flip === 'tails' ? 'tails' : 'heads');
      setOutcome({ won: data.won, profit: data.payout - data.amount });
      setSpinning(false);
    };
    // Let the coin turn before revealing; instant under reduced motion or
    // while auto-betting.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const skip = reduced || isAutoRunning('coinflip');
    if (skip) settle();
    else settleTimer.current = window.setTimeout(settle, 600);
    return net;
  }, [place, betAmount, choice, reduced]);

  const auto = useAutoBet('coinflip', flip);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';
  const locked = busy || spinning || auto.running;

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
          disabled={locked}
          action={
            <BetButton
              onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void flip(); }}
              disabled={auto.running ? false : balance > 0 && (betAmount <= 0 || betAmount > balance)}
              busy={autoMode ? auto.running : busy || spinning}
              repeatable
            >
              {autoMode ? (auto.running ? 'Stop Auto' : 'Start Auto') : spinning ? 'Flipping…' : 'Flip Coin'}
            </BetButton>
          }
        >
          <SegmentedControl
            label="Your call"
            value={choice}
            onChange={setChoice}
            disabled={locked}
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
