'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RotateCcw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { GameBetControls, GameBalance, GameHeader } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props { onBack: () => void; initialBalance: number; }
type Result = null | { won: boolean; roll: number; payout: number; multiplier: number };

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
        <text x="50" y="58" textAnchor="middle" fill="#cdf32b" fontSize="17" fontWeight="800" letterSpacing="1.6" fontFamily="system-ui,sans-serif">
          TOLS
        </text>
      ) : (
        (PIPS[n] ?? []).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="8.4" fill="#cdf32b" />
        ))
      )}
    </svg>
  );
}

function TolsDie({
  uid,
  value,
  rolling,
  idle,
}: {
  uid: string;
  value: number;
  rolling: boolean;
  idle: 'left' | 'right';
}) {
  const idlePose = idle === 'left'
    ? 'rotateX(-18deg) rotateY(-28deg)'
    : 'rotateX(-12deg) rotateY(22deg)';
  const transform = rolling ? undefined : (value ? FACE_ROT[value] : idlePose);

  return (
    <div className={`tols-die-scene tols-die-${idle}`}>
      <div
        className={`tols-die-cube${rolling ? ' is-rolling' : ''}`}
        style={transform ? { transform } : undefined}
      >
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <div key={n} className={`tols-die-face tols-die-face-${n}`}>
            <DieFace n={n} uid={uid} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiceGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [betAmount, setBetAmount] = useState(5);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const { balance, setBalance } = useOriginalsSession("dice", { target, isOver }, betAmount, initialBalance);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [animatedRoll, setAnimatedRoll] = useState(50);
  const [history, setHistory] = useState<Array<{ roll: number; target: number; isOver: boolean; result: string; payout: number }>>([]);
  const [showPF, setShowPF] = useState(false);
  const [pfData, setPfData] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const winChance = useMemo(() => isOver ? (100 - target).toFixed(2) : target.toFixed(2), [target, isOver]);
  const potentialMultiplier = useMemo(() => winChance !== '0.00' ? (99 / Number(winChance)).toFixed(4) : '\u221e', [winChance]);
  const potentialPayout = useMemo(() => (betAmount * Number(potentialMultiplier === '\u221e' ? 0 : potentialMultiplier)).toFixed(2), [betAmount, potentialMultiplier]);
  const faces = useMemo(
    () => (result ? facesFromRoll(result.roll) : [0, 0]) as [number, number],
    [result],
  );

  const rollDice = useCallback(async () => {
    if (rolling || betAmount <= 0 || betAmount > balance) return;
    setRolling(true); setResult(null); setShowResult(false);
    const interval = reduced ? undefined : setInterval(() => setAnimatedRoll(Math.floor(Math.random() * 10000) / 100), 50);
    if (interval) rollIntervalRef.current = interval;
    try {
      const data = await placeOriginalsBet("dice", betAmount, { target, isOver });
      if (interval) clearInterval(interval);
      const payload = data.payload as { roll: number; target: number; isOver: boolean };
      const r = { won: data.won, roll: payload.roll, payout: data.payout, multiplier: data.multiplier };
      setResult(r); setAnimatedRoll(payload.roll); setBalance(data.availableBalance ?? data.newBalance);
      setPfData({ serverSeedHash: data.serverSeedHash, clientSeed: data.clientSeed, nonce: data.nonce });
      setHistory(prev => [{ roll: payload.roll, target, isOver, result: r.won ? 'win' : 'lose', payout: r.payout }, ...prev].slice(0, 15));
      setTimeout(() => setShowResult(true), 50);
    } catch { if (interval) clearInterval(interval); }
    setTimeout(() => setRolling(false), 400);
  }, [rolling, betAmount, balance, target, isOver, reduced]);

  useEffect(() => { return () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); }; }, []);

  const targetPct = target;
  const rollPct = animatedRoll;
  const winZoneStart = isOver ? targetPct : 0;
  const winZoneEnd = isOver ? 100 : targetPct;
  const spinning = rolling && !reduced;

  return (
    <div className="game-wrapper compact-game">
      <GameHeader title="Dice" subtitle="Roll over or under your target" onBack={onBack} />

      <div className="game-grid">
        <div className="space-y-2">
          <div className={'dice-area ' + (showResult && result?.won ? 'win' : '') + (showResult && result && !result.won ? ' loss' : '')}>
            <div className="tols-die-pair">
              <TolsDie uid="l" value={faces[0]} rolling={spinning} idle="left" />
              <TolsDie uid="r" value={faces[1]} rolling={spinning} idle="right" />
            </div>
            <div className="tols-die-floor" aria-hidden />

            <div className="mb-3 text-center">
              <div className={'dice-result ' + (rolling ? '' : showResult && result?.won ? 'win' : showResult && result && !result.won ? 'loss' : 'idle') + (showResult && result && !reduced ? ' dice-slam' : '')}>
                {animatedRoll.toFixed(2)}
              </div>
              {showResult && result && (
                <div className="mt-1">
                  <span className={'text-xs font-bold ' + (result.won ? 'text-win' : 'text-loss')}>{result.won ? 'WIN' : 'LOSE'}</span>
                  {result.won && !reduced && (
                    <span className="dice-float-win absolute left-1/2 -translate-x-1/2 text-win text-sm font-bold whitespace-nowrap">+{result.payout.toFixed(2)}</span>
                  )}
                </div>
              )}
              {!result && !rolling && <p className="text-xs mt-1" style={{ color: 'var(--g-text-3)' }}>Set target & roll</p>}
            </div>

            <div className="w-full">
              <div className="dice-bar">
                <div className="dice-bar-win" style={{ left: winZoneStart + '%', width: (winZoneEnd - winZoneStart) + '%' }} />
                <div className="dice-bar-lose" style={{ left: (isOver ? 0 : targetPct) + '%', width: (isOver ? targetPct : 100 - targetPct) + '%' }} />
                {showResult && result && !rolling && (
                  <div className="absolute top-0 bottom-0 z-10" style={{ left: rollPct + '%', transform: 'translateX(-50%)' }}>
                    <div className={'w-0.5 h-full ' + (result.won ? 'bg-win' : 'bg-loss')} />
                  </div>
                )}
              </div>
              <input type="range" min={2} max={98} value={target}
                onChange={(e) => { setTarget(Number(e.target.value)); setResult(null); setShowResult(false); }}
                className="dice-slider" disabled={rolling}
                style={{ marginTop: '-48px', position: 'relative', zIndex: 20 }} />
              <div className="flex justify-between mt-1 px-0.5">
                <span className="text-[10px]" style={{ color: 'var(--g-text-3)', fontFamily: 'var(--g-mono)' }}>0</span>
                <span className="text-[10px]" style={{ color: 'var(--g-text-3)', fontFamily: 'var(--g-mono)' }}>100</span>
              </div>
            </div>
          </div>

          <div className="g-panel p-2">
            <div className="flex gap-2">
              <button onClick={() => { setIsOver(true); setResult(null); setShowResult(false); }} disabled={rolling}
                className={'g-btn g-btn-toggle ' + (isOver ? 'active' : 'inactive')}>Roll Over {target}</button>
              <button onClick={() => { setIsOver(false); setResult(null); setShowResult(false); }} disabled={rolling}
                className={'g-btn g-btn-toggle ' + (!isOver ? 'active' : 'inactive')}>Roll Under {target}</button>
            </div>
          </div>

          <div className="g-stats">
            <div className="g-stat"><p className="g-stat-label">Win Chance</p><p className="g-stat-value">{winChance}%</p></div>
            <div className="g-stat"><p className="g-stat-label">Multiplier</p><p className="g-stat-value lime">{potentialMultiplier}×</p></div>
            <div className="g-stat"><p className="g-stat-label">Payout</p><p className="g-stat-value">{'$' + potentialPayout}</p></div>
          </div>

          {history.length > 0 && (
            <div className="g-history">
              <div className="g-history-head">
                <h3 className="g-history-title">Recent Rolls</h3>
                <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1" style={{ color: 'var(--g-text-3)' }}><RotateCcw className="w-3 h-3" />Clear</button>
              </div>
              <div className="g-history-list">
                {history.map((h, i) => (
                  <div key={i} className="g-history-item">
                    <div className="flex items-center gap-2">
                      <span className={'g-history-badge ' + (h.result === 'win' ? 'win' : 'loss')}>{h.result}</span>
                      <span className="text-[11px]" style={{ color: 'var(--g-text-2)' }}>{h.isOver ? 'Over' : 'Under'} {h.target} → <span className="font-semibold" style={{ color: 'var(--g-text)', fontFamily: 'var(--g-mono)' }}>{h.roll.toFixed(2)}</span></span>
                    </div>
                    <span className={'text-[11px] font-bold tabular-nums ' + (h.result === 'win' ? 'text-win' : 'text-loss')} style={{ fontFamily: 'var(--g-mono)' }}>{h.result === 'win' ? '+' : '-'}{'$' + h.payout.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="g-pf">
            <button onClick={() => setShowPF(v => !v)} className="g-pf-toggle w-full">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: 'var(--g-green)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--g-text-2)' }}>Provably Fair</span>
              </div>
              {showPF ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} />}
            </button>
            {showPF && (
              <div className="g-pf-body">
                <div className="g-pf-row"><span className="g-pf-label">Server Seed Hash</span><span className="g-pf-val">{pfData ? pfData.serverSeedHash.slice(0, 20) + '...' : '\u2014'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Client Seed</span><span className="g-pf-val">{pfData ? pfData.clientSeed : '\u2014'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Nonce</span><span className="g-pf-val">{pfData ? pfData.nonce : '\u2014'}</span></div>
                <button className="g-pf-verify">Verify</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <GameBalance value={balance} />
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={rolling} />
          <div className="g-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--g-text-3)' }}>Profit on Win</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--g-green)', fontFamily: 'var(--g-mono)' }}>+{(Number(potentialPayout) - betAmount).toFixed(2)}</span>
            </div>
          </div>
          <button onClick={rollDice} disabled={rolling || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
            {rolling ? 'Rolling...' : 'Roll Dice'}
          </button>
        </div>
      </div>
    </div>
  );
}
