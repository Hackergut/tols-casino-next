'use client';

/* Limbo on the shared Originals frame. */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, NumberField } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, isAutoRunning } from '@/components/casino/useAutoBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { TARGET_RTP, MIN_WIN_MULTIPLIER, MAX_TARGET_MULTIPLIER } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

export function LimboGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ roll: number }>('limbo', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [target, setTarget] = useGameSetting<number>('limbo', 'target', 2);
  const [display, setDisplay] = useState(1);
  const [outcome, setOutcome] = useState<null | { won: boolean; roll: number; profit: number }>(null);
  const raf = useRef<number | undefined>(undefined);
  const verdictTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
  }, []);

  // Win chance is derived from the same edge the server uses, so the quoted
  // number cannot drift from the paid one.
  const winChance = useMemo(() => (target > 0 ? (TARGET_RTP / target) * 100 : 0), [target]);

  const animateTo = useCallback((to: number) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const start = performance.now();
    const from = 1;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      // ease-out: fast first, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  const roll = useCallback(async (): Promise<number | null> => {
    setOutcome(null);
    const data = await place(betAmount, { target });
    if (!data) return null;
    const finalRoll = data.payload.roll;
    const skip = reduced || isAutoRunning('limbo');
    if (skip) setDisplay(finalRoll);
    else animateTo(finalRoll);
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    verdictTimer.current = window.setTimeout(
      () => setOutcome({ won: data.won, roll: finalRoll, profit: data.payout - data.amount }),
      skip ? 0 : 700,
    );
    return Math.round((data.payout - data.amount) * 100) / 100;
  }, [place, betAmount, target, reduced, animateTo]);

  const auto = useAutoBet('limbo', roll);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';
  const locked = busy || auto.running;

  return (
    <GameFrame
      gameId="limbo"
      title="Limbo"
      subtitle="Set a target — the roll must clear it"
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
              onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void roll(); }}
              disabled={auto.running ? false : balance > 0 && (betAmount <= 0 || betAmount > balance)}
              busy={autoMode ? auto.running : busy}
              repeatable
            >
              {autoMode ? (auto.running ? 'Stop Auto' : 'Start Auto') : busy ? 'Rolling…' : 'Roll'}
            </BetButton>
          }
        >
          <div className="tols-field">
            <label htmlFor="limbo-target">Target multiplier</label>
            {/* Below MIN_WIN_MULTIPLIER a "win" would return less than the
                stake, so the input floor is derived rather than guessed. */}
            <NumberField
              id="limbo-target"
              min={MIN_WIN_MULTIPLIER}
              max={MAX_TARGET_MULTIPLIER}
              step={0.1}
              value={target}
              disabled={locked}
              onCommit={(v) => setTarget(v)}
              className="tols-input font-mono"
            />
          </div>
          <div>
            <StatRow label="Win chance" value={`${winChance.toFixed(4)}%`} />
            <StatRow label="Multiplier" value={`${target.toFixed(2)}×`} tone="lime" />
            <StatRow label="Profit on win" value={`$${(betAmount * target - betAmount).toFixed(2)}`} tone="lime" />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="limbo">
        <span
          className="limbo__value font-mono"
          data-state={outcome ? (outcome.won ? 'win' : 'loss') : 'idle'}
        >
          {display.toFixed(2)}×
        </span>
        <p className="limbo__verdict" data-won={outcome?.won || undefined}>
          {outcome
            ? outcome.won
              ? `WIN +$${outcome.profit.toFixed(2)}`
              : `LOSE — needed ${target.toFixed(2)}×`
            : `Target ${target.toFixed(2)}×`}
        </p>
      </div>
    </GameFrame>
  );
}
