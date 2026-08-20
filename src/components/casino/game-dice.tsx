'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface DicePayload {
  roll: number;
  target: number;
  isOver: boolean;
}

const PIPS: Record<number, [number, number][]> = {
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

const FACE_ROT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};

function facesFromRoll(roll: number): [number, number] {
  const x = Math.floor(Math.max(0, roll) * 100);
  return [1 + (x % 6), 1 + (Math.floor(x / 7) % 6)];
}

function DieFace({ n, uid }: { n: number; uid: string }) {
  const gid = `die-fill-${uid}-${n}`;
  return (
    <svg viewBox="0 0 100 100" className="tols-die-svg" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="32%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#2e2e2a" />
          <stop offset="100%" stopColor="#0c0c0a" />
        </radialGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="16" fill={`url(#${gid})`} stroke="rgba(205,243,43,0.4)" strokeWidth="2.2" />
      {n === 1 ? (
        <text x="50" y="58" textAnchor="middle" fill="#cdf32b" fontSize="17" fontWeight="800" letterSpacing="1.6" fontFamily="system-ui,sans-serif">TOLS</text>
      ) : (
        (PIPS[n] ?? []).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.4" fill="#cdf32b" />)
      )}
    </svg>
  );
}

function TolsDie({ uid, value, rolling, idle }: {
  uid: string; value: number; rolling: boolean; idle: 'left' | 'right';
}) {
  const idlePose = idle === 'left' ? 'rotateX(-18deg) rotateY(-28deg)' : 'rotateX(-12deg) rotateY(22deg)';
  const transform = rolling ? undefined : (value ? FACE_ROT[value] : idlePose);
  return (
    <div className={`tols-die-scene tols-die-${idle}`}>
      <div className={`tols-die-cube${rolling ? ' is-rolling' : ''}`} style={transform ? { transform } : undefined}>
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <div key={n} className={`tols-die-face tols-die-face-${n}`}>
            <DieFace n={n} uid={uid} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiceGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<DicePayload>("dice", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);

  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; roll: number; payout: number; multiplier: number }>(null);
  const [animatedRoll, setAnimatedRoll] = useState(50);
  const [showResult, setShowResult] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => { return () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); }; }, []);

  const winChance = useMemo(() => isOver ? (100 - target).toFixed(2) : target.toFixed(2), [target, isOver]);
  const potentialMultiplier = useMemo(() => winChance !== '0.00' ? (99 / Number(winChance)).toFixed(4) : '∞', [winChance]);
  const potentialPayout = useMemo(() => (betAmount * Number(potentialMultiplier === '∞' ? 0 : potentialMultiplier)).toFixed(2), [betAmount, potentialMultiplier]);
  const faces = useMemo(() => (result ? facesFromRoll(result.roll) : [0, 0]) as [number, number], [result]);

  const rollDice = useCallback(async () => {
    if (rolling || betAmount <= 0 || betAmount > balance) return;
    setRolling(true);
    setResult(null);
    setShowResult(false);
    const interval = skipAnim ? undefined : setInterval(() => setAnimatedRoll(Math.floor(Math.random() * 10000) / 100), 50);
    if (interval) rollIntervalRef.current = interval;
    try {
      const data = await place(betAmount, { target, isOver });
      if (interval) clearInterval(interval);
      if (!data) { setRolling(false); return; }
      const r = { won: data.won, roll: data.payload.roll, payout: data.payout, multiplier: data.multiplier };
      setResult(r);
      setAnimatedRoll(data.payload.roll);
      setTimeout(() => setShowResult(true), 50);
    } catch { if (interval) clearInterval(interval); }
    setTimeout(() => setRolling(false), 400);
  }, [rolling, betAmount, balance, target, isOver, skipAnim, place]);

  const targetPct = target;
  const winZoneStart = isOver ? targetPct : 0;
  const winZoneEnd = isOver ? 100 : targetPct;

  return (
    <GameFrame
      gameId="dice"
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
              onClick={rollDice}
              disabled={rolling || busy || betAmount <= 0}
              busy={rolling}
            >
              {rolling ? 'Rolling...' : 'Roll Dice'}
            </BetButton>
          }
        >
          <StatRow label="Win Chance" value={`${winChance}%`} />
          <StatRow label="Multiplier" value={`${potentialMultiplier}×`} tone="lime" />
          <StatRow label="Payout" value={`$${potentialPayout}`} tone="lime" />
          <StatRow label="Profit on Win" value={`+$${(Number(potentialPayout) - betAmount).toFixed(2)}`} tone="lime" />
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="dice">
        {/* Dice visualisation */}
        <div className={`dice-area ${(showResult && result?.won ? ' win' : '') + (showResult && result && !result.won ? ' loss' : '')}`}>
          <div className="tols-die-pair">
            <TolsDie uid="l" value={faces[0]} rolling={rolling && !skipAnim} idle="left" />
            <TolsDie uid="r" value={faces[1]} rolling={rolling && !skipAnim} idle="right" />
          </div>
          <div className="tols-die-floor" aria-hidden />

          {/* Result readout */}
          <div className="dice__readout">
            <div className={`dice__value ${showResult && result?.won ? 'data-[state=win]' : showResult && result && !result.won ? 'data-[state=loss]' : ''}`}
              data-state={rolling ? undefined : showResult && result?.won ? 'win' : showResult && result && !result.won ? 'loss' : 'idle'}
            >
              {animatedRoll.toFixed(2)}
            </div>
            {showResult && result && (
              <p className="dice__verdict" data-won={result.won || undefined}>
                {result.won ? `WIN +$${result.payout.toFixed(2)}` : 'LOSE'}
              </p>
            )}
            {!result && !rolling && <p className="tols-note">Set target & roll</p>}
          </div>

          {/* Slider + track */}
          <div className="w-full">
            <div className="dice__track">
              <div className="dice__win" style={{ left: winZoneStart + '%', width: (winZoneEnd - winZoneStart) + '%' }} />
              {showResult && result && !rolling && (
                <div className="dice__marker" data-won={result.won || undefined} style={{ left: animatedRoll + '%' }} />
              )}
            </div>
            <input type="range" min={2} max={98} value={target}
              onChange={(e) => { setTarget(Number(e.target.value)); setResult(null); setShowResult(false); }}
              className="dice__slider"
              disabled={rolling}
              style={{ marginTop: '-48px', position: 'relative', zIndex: 20 }}
            />
            <div className="dice__scale">
              <span>0</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Over/Under toggle */}
        <div className="tols-seg">
          <button
            type="button"
            data-active={isOver || undefined}
            onClick={() => { setIsOver(true); setResult(null); setShowResult(false); }}
            disabled={rolling}
          >Roll Over {target}</button>
          <button
            type="button"
            data-active={!isOver || undefined}
            onClick={() => { setIsOver(false); setResult(null); setShowResult(false); }}
            disabled={rolling}
          >Roll Under {target}</button>
        </div>
      </div>
    </GameFrame>
  );
}
