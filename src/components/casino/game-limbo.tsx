'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useGameSetting, useSkipAnimation } from "@/lib/game-settings";
import { originalsAction, placeOriginalsBet } from "@/lib/originals-client";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface LimboPayload {
  roll: number;
}

const TARGET_PRESETS = [1.5, 2, 3, 5, 10, 50] as const;

export function LimboGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<LimboPayload>("limbo", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);
  const [target, setTarget] = useGameSetting<number>("limbo", "target", 2);
  const reduced = useReducedMotion();

  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; roll: number; payout: number; multiplier: number }>(null);
  const [displayValue, setDisplayValue] = useState(1);

  const animFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(undefined);

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const animateCounter = useCallback((from: number, to: number, duration: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) animFrameRef.current = requestAnimationFrame(tick);
      else { setDisplayValue(to); animFrameRef.current = undefined; }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const roll = useCallback(async () => {
    if (rolling || betAmount <= 0 || target <= 1) return;
    setRolling(true);
    setResult(null);

    let scrambleCount = 0;
    const scrambleInterval = skipAnim ? undefined : setInterval(() => {
      setDisplayValue(1 + Math.random() * 15);
      scrambleCount++;
      if (scrambleCount > 30 && scrambleInterval) clearInterval(scrambleInterval);
    }, 40);

    try {
      const data = await place(betAmount, { target });
      if (scrambleInterval) clearInterval(scrambleInterval);
      if (!data) { setRolling(false); return; }

      const finalRoll = data.payload.roll;
      if (skipAnim) {
        setDisplayValue(finalRoll);
      } else {
        animateCounter(displayValue, finalRoll, 800);
      }

      setTimeout(() => {
        setResult({ won: data.won, roll: finalRoll, payout: data.payout, multiplier: data.multiplier });
        setRolling(false);
      }, skipAnim ? 150 : 900);
    } catch {
      if (scrambleInterval) clearInterval(scrambleInterval);
      setRolling(false);
    }
  }, [rolling, betAmount, target, animateCounter, displayValue, skipAnim, place]);

  const winChance = target > 1 ? ((99 / target) * 100) : 99;

  return (
    <GameFrame
      gameId="limbo"
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
          disabled={rolling || busy}
          action={
            <BetButton
              onClick={roll}
              disabled={rolling || busy || betAmount <= 0 || target <= 1}
              busy={rolling}
            >
              {rolling ? 'Rolling...' : 'Bet'}
            </BetButton>
          }
        >
          {/* Target Multiplier */}
          <SegmentedControl
            label="Target Multiplier"
            options={TARGET_PRESETS.map(v => ({ value: v, label: `${v}×` }))}
            value={target}
            onChange={(v) => !rolling && setTarget(v)}
            disabled={rolling}
          />
          <div className="flex gap-2">
            <button
              onClick={() => !rolling && setTarget(Math.max(1.01, Math.round((target - 0.5) * 100) / 100))}
              className="tols-bet__mult"
              disabled={rolling}
            >−</button>
            <input
              type="number"
              value={target}
              onChange={e => setTarget(Math.max(1.01, Number(e.target.value)))}
              step="0.01"
              className="tols-bet__input font-mono text-center"
              disabled={rolling}
            />
            <button
              onClick={() => !rolling && setTarget(Math.min(1000, target + 0.5))}
              className="tols-bet__mult"
              disabled={rolling}
            >+</button>
          </div>

          {/* Stats */}
          <StatRow label="Win Chance" value={`${winChance.toFixed(1)}%`} />
          <StatRow label="Target" value={`${target.toFixed(2)}×`} tone="lime" />
          <StatRow label="Potential Payout" value={`$${(betAmount * target).toFixed(2)}`} tone="lime" />
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      {/* Canvas */}
      <div className="limbo">
        <p className="limbo__verdict" data-won={result?.won || undefined}>
          {rolling ? 'Rolling' : result ? (result.won ? 'You Won!' : 'Result') : 'Ready'}
        </p>

        <div
          key={result ? 'settled' : 'live'}
          className="limbo__value font-mono"
          data-state={result ? (result.won ? 'win' : 'loss') : undefined}
        >
          {displayValue > 0 ? displayValue.toFixed(2) : '0.00'}
          <span className="text-3xl ml-1 opacity-40">×</span>
        </div>

        {result && (
          <div style={{ animation: skipAnim ? 'none' : 'result-pop 0.4s ease-out' }}>
            <p className={`limbo__verdict ${result.won ? 'text-win' : 'text-loss'}`}>
              {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
            </p>
            <p className="tols-note mt-2 text-center">
              {result.won
                ? `Rolled ${result.roll.toFixed(2)}x ≥ ${target.toFixed(2)}x target`
                : `Rolled ${result.roll.toFixed(2)}x < ${target.toFixed(2)}x target`}
            </p>
          </div>
        )}

        {!result && !rolling && (
          <p className="tols-note text-center">
            Roll must reach <span className="text-lime font-bold">{target.toFixed(2)}×</span> to win
          </p>
        )}

        {/* Win probability bar */}
        <div className="w-full max-w-sm mt-4">
          <div className="tols-stat">
            <span>Win Probability</span>
            <span>{winChance.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, winChance)}%`,
                background: winChance > 50 ? 'var(--win)' : winChance > 20 ? 'var(--color-lime)' : winChance > 5 ? 'var(--pending)' : 'var(--loss)',
              }}
            />
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
