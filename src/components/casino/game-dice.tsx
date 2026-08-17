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
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { chanceMultiplier } from '@/lib/game-math';

interface Props { onBack: () => void; initialBalance: number; }
type Result = null | { won: boolean; roll: number; payout: number; multiplier: number };

export function DiceGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(1);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [animatedRoll, setAnimatedRoll] = useState(50);
  const [history, setHistory] = useState<number[]>([]);
  const [fairness, setFairness] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const winChance = useMemo(() => (isOver ? 100 - target : target), [target, isOver]);
  // Same helper the server uses, so the quoted multiplier cannot drift from the
  // paid one — the two used to be independent copies of `99 / chance`.
  const multiplier = useMemo(() => chanceMultiplier(winChance), [winChance]);
  const payout = betAmount * multiplier;

  const roll = useCallback(async () => {
    if (rolling || betAmount <= 0 || betAmount > balance) return;
    setRolling(true); setResult(null); setShowResult(false);

    const interval = reduced ? undefined : setInterval(() => setAnimatedRoll(Math.random() * 100), 50);
    if (interval) rollIntervalRef.current = interval;

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'dice', amount: betAmount, payload: { target, isOver } }),
      });
      const data = await res.json();
      if (interval) clearInterval(interval);
      if (data.success) {
        const p = data.data.payload as { roll: number };
        setResult({ won: data.data.won, roll: p.roll, payout: data.data.payout, multiplier: data.data.multiplier });
        setAnimatedRoll(p.roll);
        setBalance(data.data.newBalance);
        setFairness({ serverSeedHash: data.data.serverSeedHash, clientSeed: data.data.clientSeed, nonce: data.data.nonce });
        setHistory((prev) => [data.data.won ? data.data.multiplier : 0, ...prev].slice(0, 10));
        setShowResult(true);
      }
    } catch {
      if (interval) clearInterval(interval);
    }
    setRolling(false);
  }, [rolling, betAmount, balance, target, isOver, reduced]);

  useEffect(() => () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); }, []);

  const winStart = isOver ? target : 0;
  const winWidth = isOver ? 100 - target : target;

  return (
    <GameFrame
      title="Dice"
      subtitle="Roll over or under your target"
      onBack={onBack}
      history={history}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={rolling}
          action={
            <BetButton onClick={roll} disabled={betAmount <= 0 || betAmount > balance} busy={rolling}>
              {rolling ? 'Rolling…' : 'Roll Dice'}
            </BetButton>
          }
        >
          <SegmentedControl
            label="Direction"
            value={isOver ? 'over' : 'under'}
            onChange={(v) => { setIsOver(v === 'over'); setResult(null); setShowResult(false); }}
            disabled={rolling}
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

        <input
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={rolling}
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
