'use client';

/*
 * Crash on the shared Originals frame.
 *
 * BUG FIXED — the player was charged twice per round. The old flow POSTed to
 * /api/bets at round start with `cashOutAt: 0` (to discover the crash point)
 * and POSTed *again* on cash-out. Every POST debits the stake, so a round that
 * was cashed out cost 2× the stake while paying out on 1×. The opening bet was
 * also a guaranteed loss by construction (cashOutAt 0 never wins).
 *
 * On top of that, the two calls resolved against two independent crash points:
 * the curve the player watched came from the first bet, the payout came from
 * the second. The animation was not the round being paid.
 *
 * There is now exactly one POST per round. The cash-out target is committed
 * before the round starts, the server returns the crash point for that single
 * bet, and the curve animates to that number. A true mid-flight manual
 * cash-out cannot be settled honestly through a one-shot endpoint — it needs a
 * stateful round API (open round → cash out), because otherwise the client
 * would be choosing its own multiplier after seeing the outcome.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { TARGET_RTP, MIN_WIN_MULTIPLIER } from '@/lib/game-math';

interface Props { onBack: () => void; initialBalance: number; }

const GROWTH = 0.06; // multiplier = e^(GROWTH * seconds)

export function CrashGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const { balance, busy, error, history, fairness, place } = useBet<{ crashPoint: number }>('crash', initialBalance);
  const [betAmount, setBetAmount] = useState(1);
  const [target, setTarget] = useState(2);
  const [multiplier, setMultiplier] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [outcome, setOutcome] = useState<null | { won: boolean; crashPoint: number; profit: number }>(null);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([{ x: 0, y: 1 }]);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const run = useCallback(async () => {
    setOutcome(null);
    setMultiplier(1);
    setPoints([{ x: 0, y: 1 }]);

    const data = await place(betAmount, { cashOutAt: target });
    if (!data) return;

    const crashPoint = data.payload.crashPoint;
    // The round stops at whichever comes first: the committed cash-out or the
    // crash. Both are already decided server-side.
    const stopAt = data.won ? target : crashPoint;
    const settle = () => {
      setMultiplier(stopAt);
      setPhase('done');
      setOutcome({ won: data.won, crashPoint, profit: data.payout - betAmount });
    };

    if (reduced || stopAt <= 1) {
      setPoints([{ x: 0, y: 1 }, { x: 1, y: stopAt }]);
      settle();
      return;
    }

    setPhase('running');
    const duration = Math.log(stopAt) / GROWTH; // seconds to reach stopAt
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      if (elapsed >= duration) { settle(); return; }
      const m = Math.exp(GROWTH * elapsed);
      setMultiplier(Math.floor(m * 100) / 100);
      setPoints((prev) => (prev.length > 300 ? prev.slice(-300) : prev).concat({ x: elapsed, y: m }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [place, betAmount, target, reduced]);

  // Chart path in a 0..100 viewBox.
  const maxX = Math.max(2, ...points.map((p) => p.x));
  const maxY = Math.max(1.4, ...points.map((p) => p.y));
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x / maxX) * 100} ${100 - (p.y / maxY) * 100}`)
    .join(' ');

  const running = phase === 'running' || busy;

  return (
    <GameFrame
      title="Crash"
      subtitle="Set your cash-out before the curve breaks"
      onBack={onBack}
      history={history}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={running}
          action={
            <BetButton onClick={run} disabled={betAmount <= 0 || betAmount > balance} busy={running}>
              {running ? 'In flight…' : 'Bet'}
            </BetButton>
          }
        >
          <div className="tols-field">
            <label htmlFor="crash-target">Auto cash-out at</label>
            <input
              id="crash-target"
              type="number"
              inputMode="decimal"
              min={MIN_WIN_MULTIPLIER}
              step={0.1}
              value={target}
              disabled={running}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setTarget(Number.isFinite(v) ? Math.max(MIN_WIN_MULTIPLIER, Math.min(1_000_000, v)) : MIN_WIN_MULTIPLIER);
              }}
              className="tols-input font-mono"
            />
          </div>
          <div>
            <StatRow label="Win chance" value={`${((TARGET_RTP / target) * 100).toFixed(2)}%`} />
            <StatRow label="Multiplier" value={`${target.toFixed(2)}×`} tone="lime" />
            <StatRow label="Profit on win" value={`$${(betAmount * target - betAmount).toFixed(2)}`} tone="lime" />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="crash">
        <svg className="crash__chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="crash__readout">
          <span
            className="crash__value font-mono"
            data-state={phase === 'done' ? (outcome?.won ? 'win' : 'loss') : 'idle'}
          >
            {multiplier.toFixed(2)}×
          </span>
          <p className="crash__verdict" data-won={outcome?.won || undefined}>
            {phase === 'running'
              ? 'Climbing…'
              : outcome
                ? outcome.won
                  ? `CASHED OUT +$${outcome.profit.toFixed(2)}`
                  : `CRASHED AT ${outcome.crashPoint.toFixed(2)}×`
                : `Cash out at ${target.toFixed(2)}×`}
          </p>
        </div>
      </div>
    </GameFrame>
  );
}
