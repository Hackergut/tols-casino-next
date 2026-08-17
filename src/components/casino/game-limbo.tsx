'use client';

/* Limbo on the shared Originals frame. */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { TARGET_RTP, MIN_WIN_MULTIPLIER } from '@/lib/game-math';

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

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  // Win chance is derived from the same edge the server uses, so the quoted
  // number cannot drift from the paid one.
  const winChance = useMemo(() => (target > 0 ? (TARGET_RTP / target) * 100 : 0), [target]);

  const animateTo = useCallback((to: number) => {
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

  const roll = useCallback(async () => {
    setOutcome(null);
    const data = await place(betAmount, { target });
    if (!data) return;
    const finalRoll = data.payload.roll;
    if (reduced) setDisplay(finalRoll);
    else animateTo(finalRoll);
    window.setTimeout(
      () => setOutcome({ won: data.won, roll: finalRoll, profit: data.payout - betAmount }),
      reduced ? 0 : 700,
    );
  }, [place, betAmount, target, reduced, animateTo]);

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
          disabled={busy}
          action={
            <BetButton onClick={roll} disabled={betAmount <= 0 || betAmount > balance} busy={busy}>
              {busy ? 'Rolling…' : 'Roll'}
            </BetButton>
          }
        >
          <div className="tols-field">
            <label htmlFor="limbo-target">Target multiplier</label>
            <input
              id="limbo-target"
              type="number"
              inputMode="decimal"
              min={MIN_WIN_MULTIPLIER}
              step={0.1}
              value={target}
              disabled={busy}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                // Below MIN_WIN_MULTIPLIER a "win" would return less than the
                // stake, so the input floor is derived rather than guessed.
                setTarget(Number.isFinite(v) ? Math.max(MIN_WIN_MULTIPLIER, Math.min(1_000_000, v)) : MIN_WIN_MULTIPLIER);
              }}
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
