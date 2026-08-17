'use client';

/*
 * Dice — reference implementation of the shared Originals frame.
 *
 * Everything structural (header, bet panel, recent results, fairness bar) comes
 * from GameFrame, so this file contains only what is actually specific to dice:
 * the target slider, the over/under choice, and the roll readout. That split is
 * the point — the previous version hand-rolled its own header, balance card,
 * history list and provably-fair drawer, which is why no two Originals looked
 * the same.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { chanceMultiplier, MAX_WIN_CHANCE } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}
type Result = null | { won: boolean; roll: number; payout: number; multiplier: number };

export function DiceGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } =
    useBet<{ roll: number }>('dice', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [target, setTarget] = useGameSetting<number>('dice', 'target', 50);
  const [isOver, setIsOver] = useState(true);
  const [result, setResult] = useState<Result>(null);
  const [animatedRoll, setAnimatedRoll] = useState(50);
  const [showResult, setShowResult] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const winChance = useMemo(() => (isOver ? 100 - target : target), [target, isOver]);

  // Flipping the side moves the bound to the other end of the slider, so an
  // otherwise-valid target can fall outside it.
  useEffect(() => {
    const lo = isOver ? Math.ceil(100 - MAX_WIN_CHANCE) : 2;
    const hi = isOver ? 98 : Math.floor(MAX_WIN_CHANCE);
    const clamped = Math.min(hi, Math.max(lo, target));
    if (clamped !== target) setTarget(clamped);
  }, [isOver, target, setTarget]);
  // Same helper the server uses, so the quoted multiplier cannot drift from the
  // paid one — the two used to be independent copies of `99 / chance`.
  const multiplier = useMemo(() => chanceMultiplier(winChance), [winChance]);
  const payout = betAmount * multiplier;

  const roll = useCallback(async () => {
    setResult(null);
    setShowResult(false);

    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    const interval = reduced ? undefined : setInterval(() => setAnimatedRoll(Math.random() * 100), 50);
    if (interval) rollIntervalRef.current = interval;

    const data = await place(betAmount, { target, isOver });
    if (interval) clearInterval(interval);
    if (!data) return;

    setResult({ won: data.won, roll: data.payload.roll, payout: data.payout, multiplier: data.multiplier });
    setAnimatedRoll(data.payload.roll);
    setShowResult(true);
  }, [place, betAmount, target, isOver, reduced]);

  useEffect(() => () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); }, []);

  const winStart = isOver ? target : 0;
  const winWidth = isOver ? 100 - target : target;

  return (
    <GameFrame
      gameId="dice"
      title="Dice"
      subtitle="Roll over or under your target"
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
            <BetButton onClick={roll} disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy} repeatable>
              {busy ? 'Rolling…' : 'Roll Dice'}
            </BetButton>
          }
        >
          <SegmentedControl
            label="Direction"
            value={isOver ? 'over' : 'under'}
            onChange={(v) => { setIsOver(v === 'over'); setResult(null); setShowResult(false); }}
            disabled={busy}
            options={[
              { value: 'over', label: `Over ${target}` },
              { value: 'under', label: `Under ${target}` },
            ]}
          />

          <div>
            <StatRow label="Win chance" value={`${winChance.toFixed(2)}%`} />
            <StatRow label="Multiplier" value={`${multiplier.toFixed(4)}×`} tone="lime" />
            <StatRow label="Profit on win" value={`$${(payout - betAmount).toFixed(2)}`} tone="lime" />
          </div>
        </BetPanel>
      }
    >
      <div className="dice">
        <div className="dice__readout">
          <span
            className="dice__value font-mono"
            data-state={showResult && result ? (result.won ? 'win' : 'loss') : 'idle'}
          >
            {animatedRoll.toFixed(2)}
          </span>
          {showResult && result && (
            <span className="dice__verdict" data-won={result.won || undefined}>
              {result.won ? `WIN +$${(result.payout - betAmount).toFixed(2)}` : 'LOSE'}
            </span>
          )}
        </div>

        <div className="dice__track">
          <div className="dice__win" style={{ left: `${winStart}%`, width: `${winWidth}%` }} />
          {showResult && result && (
            <div
              className="dice__marker"
              data-won={result.won || undefined}
              style={{ left: `${result.roll}%` }}
            />
          )}
        </div>

        {/*
          * Slider bounds are derived from MAX_WIN_CHANCE, not hardcoded. At a
          * 6% edge a 98% win chance pays 0.96x — a "win" that shrinks your
          * balance. The old min/max of 2..98 let the player ask for exactly
          * that; the engine clamps it anyway, so the slider used to promise a
          * chance the server would silently refuse.
          *
          * "Over" wins above the target, so its chance is 100 - target: the
          * bound applies to opposite ends of the slider depending on side.
          */}
        <input
          type="range"
          min={isOver ? Math.ceil(100 - MAX_WIN_CHANCE) : 2}
          max={isOver ? 98 : Math.floor(MAX_WIN_CHANCE)}
          value={target}
          disabled={busy}
          onChange={(e) => { setTarget(Number(e.target.value)); setResult(null); setShowResult(false); }}
          className="dice__slider"
          aria-label="Target"
        />

        <div className="dice__scale font-mono">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>
    </GameFrame>
  );
}
