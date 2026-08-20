'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Minus, Plus, Star } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}


const PAYOUT_TABLE: Record<number, number[]> = {
  1: [0, 3.8],
  2: [0, 0, 8.5],
  3: [0, 0, 2.2, 16],
  4: [0, 0, 1.5, 4.5, 35],
  5: [0, 0, 1.2, 2.5, 10, 90],
  6: [0, 0, 1, 1.8, 5, 25, 180],
  7: [0, 0, 0.8, 1.4, 3, 12, 60, 400],
  8: [0, 0, 0.6, 1.1, 2, 6, 20, 100, 700],
  9: [0, 0, 0.5, 0.9, 1.5, 4, 10, 40, 200, 1200],
  10: [0, 0, 0.4, 0.8, 1.2, 3, 7, 25, 100, 500, 2000],
};

function HitRing({ hits, total }: { hits: number; total: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? hits / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg viewBox="0 0 68 68" className="w-16 h-16">
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx="34" cy="34" r={r} fill="none"
        stroke={pct > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.1)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease', filter: pct > 0 ? 'drop-shadow(0 0 6px color-mix(in oklab, var(--color-pending) 40%, transparent))' : 'none' }}
      />
      <text x="34" y="31" textAnchor="middle" fill={pct > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.4)'} fontSize="14" fontWeight="800">{hits}</text>
      <text x="34" y="43" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="500">/{total}</text>
    </svg>
  );
}

function DrawBall({ number, isHit, delay }: { number: number; isHit: boolean; delay: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-xs"
      style={{
        width: 32,
        height: 32,
        background: isHit ? 'linear-gradient(135deg, var(--color-pending), #ca8a04)' : 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))',
        border: isHit ? '1.5px solid color-mix(in oklab, var(--color-pending) 50%, transparent)' : '1px solid rgba(255,255,255,0.1)',
        color: isHit ? 'var(--color-bg)' : 'rgba(255,255,255,0.6)',
        animation: 'keno-ball-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ' + delay + 'ms both',
        boxShadow: isHit ? '0 0 12px color-mix(in oklab, var(--color-pending) 30%, transparent)' : 'none',
      }}
    >
      {number}
    </div>
  );
}

const KENO_STYLES = [
  '@keyframes keno-ball-drop {',
  '  0% { transform: translateY(-30px) scale(0.3); opacity: 0; }',
  '  60% { transform: translateY(3px) scale(1.08); opacity: 1; }',
  '  100% { transform: translateY(0) scale(1); opacity: 1; }',
  '}',
  '@keyframes keno-bounce-ball {',
  '  0%, 100% { transform: translateY(0); }',
  '  30% { transform: translateY(-8px); }',
  '  60% { transform: translateY(-3px); }',
  '}',
  '@keyframes keno-hit-burst {',
  '  0% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-pending) 50%, transparent); }',
  '  50% { transform: scale(1.15); box-shadow: 0 0 20px 4px color-mix(in oklab, var(--color-pending) 30%, transparent); }',
  '  100% { transform: scale(1); box-shadow: 0 0 8px color-mix(in oklab, var(--color-pending) 20%, transparent); }',
  '}',
  '@keyframes keno-select-pulse {',
  '  0% { transform: scale(1); }',
  '  50% { transform: scale(1.1); }',
  '  100% { transform: scale(1); }',
  '}',
  '@keyframes keno-drawn-fadein {',
  '  0% { opacity: 0; transform: scale(0.8); }',
  '  100% { opacity: 1; transform: scale(1); }',
  '}',
  '@keyframes keno-progress-shimmer {',
  '  0% { transform: translateX(-100%); }',
  '  100% { transform: translateX(200%); }',
  '}',
  '.keno-num-hit { animation: keno-hit-burst 0.5s ease-out both; }',
  '.keno-num-selected { animation: keno-select-pulse 0.3s ease-out both; }',
  '.keno-num-drawn { animation: keno-drawn-fadein 0.35s ease-out both; }',
  '.keno-bounce { animation: keno-bounce-ball 0.6s ease-in-out infinite; }',
  '.keno-number-tile:hover:not(:disabled) {',
  '  background: linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 6%, transparent), color-mix(in oklab, var(--color-lime) 2%, transparent)) !important;',
  '  box-shadow: 0 0 12px color-mix(in oklab, var(--color-lime) 10%, transparent);',
  '  transform: translateY(-1px);',
  '  border-color: color-mix(in oklab, var(--color-lime) 20%, transparent) !important;',
  '}',
].join('\n');

export function KenoGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { balance, setBalance } = useOriginalsSession("keno", { picks: Array.from(selected), risk: "classic" }, betAmount, initialBalance);
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [drawnOrder, setDrawnOrder] = useState<number[]>([]);
  const [phase, setPhase] = useState<'betting' | 'drawing' | 'done'>('betting');
  const [result, setResult] = useState<null | { won: boolean; payout: number; hits: number }>(null);
  const [history, setHistory] = useState<Array<{ result: string; picks: number; hits: number; payout: number }>>([]);
  const [currentDrawBall, setCurrentDrawBall] = useState<number | null>(null);
  const drawCountRef = useRef(0);
  const reduced = useReducedMotion();

  const hits = useMemo(() => {
    if (drawn.size === 0) return 0;
    let count = 0;
    selected.forEach(n => { if (drawn.has(n)) count++; });
    return count;
  }, [selected, drawn]);

  const potentialMultiplier = useMemo(() => {
    const table = PAYOUT_TABLE[selected.size];
    if (!table || selected.size === 0) return 0;
    return table[Math.min(hits, table.length - 1)] || 0;
  }, [selected.size, hits]);

  const toggleNumber = useCallback((n: number) => {
    if (phase !== 'betting') return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < 10) next.add(n);
      return next;
    });
  }, [phase]);

  const play = useCallback(async () => {
    if (selected.size < 1 || betAmount <= 0 || betAmount > balance) return;
    setPhase('drawing');
    setResult(null);
    setDrawn(new Set());
    setDrawnOrder([]);
    drawCountRef.current = 0;

    try {
      const data = await placeOriginalsBet("keno", betAmount, {
        picks: Array.from(selected),
        risk: "classic",
      });
      const arr = ((data.payload as { drawn?: number[] }).drawn ?? []).slice(0, 10);
      if (reduced) {
        setDrawn(new Set(arr));
        setDrawnOrder(arr);
        drawCountRef.current = arr.length;
      } else {
        for (let i = 0; i < arr.length; i++) {
          setCurrentDrawBall(arr[i]);
          await new Promise(r => setTimeout(r, 120));
          setDrawn(prev => new Set([...prev, arr[i]]));
          setDrawnOrder(prev => [...prev, arr[i]]);
          drawCountRef.current = i + 1;
        }
      }
      setCurrentDrawBall(null);
      const hitCount = Number((data.payload as { hits?: number }).hits ?? 0);
      setPhase('done');
      setResult({ won: data.won, payout: data.payout, hits: hitCount });
      setBalance(data.newBalance);
      setHistory(prev => [{ result: data.won ? 'win' : 'lose', picks: selected.size, hits: hitCount, payout: data.payout }, ...prev].slice(0, 10));
    } catch {
      setPhase('betting');
    }
  }, [selected, betAmount, balance, reduced]);

  const reset = useCallback(() => {
    setPhase('betting');
    setSelected(new Set());
    setDrawn(new Set());
    setDrawnOrder([]);
    setResult(null);
    setCurrentDrawBall(null);
  }, []);

  const currentPayoutRow = result ? hits : -1;

  return (
    <div className="keno-game-wrapper">
      <style dangerouslySetInnerHTML={{ __html: KENO_STYLES }} />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl transition-all duration-200 hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--vip) 20%, transparent), color-mix(in srgb, var(--vip) 5%, transparent))',
              border: '1px solid color-mix(in srgb, var(--vip) 20%, transparent)',
            }}
          >
            <Star className="w-5 h-5" style={{ color: 'var(--vip)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Keno</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick 1-10 numbers from 40 — 10 drawn, provably fair</p>
          </div>
        </div>
      </div>

      {(phase === 'drawing' || (phase === 'done' && drawnOrder.length > 0)) && (
        <div
          className="mb-5 rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))',
            border: '1px solid color-mix(in oklab, var(--color-pending) 10%, transparent)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {phase === 'drawing' && currentDrawBall && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm keno-bounce"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-pending), #ca8a04)',
                    color: 'var(--color-bg)',
                    boxShadow: '0 0 20px color-mix(in oklab, var(--color-pending) 40%, transparent), 0 0 40px color-mix(in oklab, var(--color-pending) 15%, transparent)',
                  }}
                >
                  {currentDrawBall}
                </div>
              )}
              <span className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {phase === 'drawing'
                  ? 'Drawing ' + drawnOrder.length + '/10...'
                  : 'Drawn ' + drawnOrder.length + '/10'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Hits:</span>
              <span className="text-sm font-bold" style={{ color: hits > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.3)' }}>
                {hits}/{selected.size}
              </span>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden relative mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out relative"
              style={{
                width: (drawnOrder.length / 10) * 100 + '%',
                background: 'linear-gradient(90deg, var(--color-pending), var(--color-pending))',
                boxShadow: '0 0 8px color-mix(in oklab, var(--color-pending) 30%, transparent)',
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
            {drawnOrder.map((n, i) => (
              <DrawBall key={n} number={n} isHit={selected.has(n)} delay={i * 15} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl p-4 sm:p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)',
              border: '1px solid color-mix(in oklab, var(--color-lime) 6%, transparent)',
              boxShadow: '0 0 60px color-mix(in oklab, var(--color-lime) 2%, transparent), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            {result && (
              <div
                className="text-center mb-4 py-3 rounded-xl text-sm font-bold tracking-wide"
                style={result.won
                  ? { background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-pending) 15%, transparent), color-mix(in oklab, var(--color-pending) 5%, transparent))', border: '1px solid color-mix(in oklab, var(--color-pending) 30%, transparent)', color: 'var(--color-pending)' }
                  : { background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-loss) 12%, transparent), color-mix(in oklab, var(--color-loss) 4%, transparent))', border: '1px solid color-mix(in oklab, var(--color-loss) 20%, transparent)', color: 'var(--color-loss)' }
                }
              >
                {result.won
                  ? 'Won $' + result.payout.toFixed(2) + '! (' + result.hits + ' hits)'
                  : 'No luck - ' + result.hits + ' hit' + (result.hits !== 1 ? 's' : '')}
              </div>
            )}

            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 sm:gap-2">
              {Array.from({ length: 40 }, (_, i) => i + 1).map(n => {
                const isSelected = selected.has(n);
                const isDrawn = drawn.has(n);
                const isHit = isSelected && isDrawn;
                const isDrawnNotSelected = isDrawn && !isSelected;

                let tileStyle: React.CSSProperties;
                let tileClass = '';

                if (isHit) {
                  tileStyle = {
                    background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-pending) 30%, transparent), color-mix(in oklab, var(--color-pending) 12%, transparent))',
                    border: '1.5px solid color-mix(in oklab, var(--color-pending) 50%, transparent)',
                    color: 'var(--color-pending)',
                    boxShadow: '0 0 15px color-mix(in oklab, var(--color-pending) 20%, transparent), inset 0 0 8px color-mix(in oklab, var(--color-pending) 10%, transparent)',
                  };
                  tileClass = 'keno-num-hit';
                } else if (isDrawnNotSelected) {
                  tileStyle = {
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.6)',
                  };
                  tileClass = 'keno-num-drawn';
                } else if (isSelected) {
                  tileStyle = {
                    background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 18%, transparent), color-mix(in oklab, var(--color-lime) 6%, transparent))',
                    border: '1.5px solid color-mix(in oklab, var(--color-lime) 40%, transparent)',
                    color: 'var(--color-lime)',
                    boxShadow: '0 0 10px color-mix(in oklab, var(--color-lime) 10%, transparent)',
                  };
                  tileClass = 'keno-num-selected';
                } else {
                  tileStyle = {
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.35)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                  };
                }

                return (
                  <button
                    key={n}
                    onClick={() => toggleNumber(n)}
                    disabled={phase !== 'betting'}
                    className={
                      'aspect-square rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-200 ' +
                      tileClass + ' ' +
                      (phase === 'betting' ? 'keno-number-tile cursor-pointer' : 'cursor-default')
                    }
                    style={tileStyle}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))',
              border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)',
            }}
          >
            <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="mt-1 text-2xl font-bold text-lime" />
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))',
              border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Selected</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {selected.size}<span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>/10</span>
                </p>
              </div>
              {(phase === 'drawing' || phase === 'done') && (
                <HitRing hits={hits} total={selected.size} />
              )}
            </div>
            {phase === 'drawing' && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-pending)' }}>Drawing... {drawnOrder.length}/20</p>
            )}
            {phase === 'done' && (
              <div className="mt-2">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {hits} hit{hits !== 1 ? 's' : ''}
                  <span style={{ color: potentialMultiplier > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.3)' }}>
                    {potentialMultiplier > 0 ? ' ' + potentialMultiplier + 'x' : ' No payout'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {phase === 'betting' && (
            <>
              <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={phase !== 'betting'} />
              <button
                onClick={play}
                disabled={selected.size < 1 || betAmount <= 0 || betAmount > balance}
                className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--color-lime), #a8d600)',
                  color: 'var(--color-bg)',
                  boxShadow: '0 0 20px color-mix(in oklab, var(--color-lime) 20%, transparent), 0 4px 15px color-mix(in oklab, var(--color-lime) 15%, transparent)',
                }}
              >
                Play Keno
              </button>
            </>
          )}

          {phase === 'drawing' && (
            <div
              className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest text-center relative overflow-hidden"
              style={{ background: 'color-mix(in oklab, var(--color-pending) 6%, transparent)', color: 'var(--color-pending)', border: '1px solid color-mix(in oklab, var(--color-pending) 15%, transparent)' }}
            >
              <span className="keno-bounce inline-block">Drawing Numbers...</span>
            </div>
          )}

          {phase === 'done' && (
            <button
              onClick={reset}
              className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Play Again
            </button>
          )}

          {selected.size > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))', border: '1px solid color-mix(in oklab, var(--color-lime) 6%, transparent)' }}>
              <p className="text-xs font-medium tracking-wider uppercase mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Payout Table{' '}
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>
                  ({selected.size} pick{selected.size !== 1 ? 's' : ''})
                </span>
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                {Array.from({ length: selected.size + 1 }, (_, i) => i).map(h => {
                  const table = PAYOUT_TABLE[selected.size];
                  const m = table ? table[h] || 0 : 0;
                  const isHighlighted = phase === 'done' && h === currentPayoutRow;
                  return (
                    <div
                      key={h}
                      className="flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-200"
                      style={isHighlighted
                        ? {
                            background: m > 0
                              ? 'linear-gradient(135deg, color-mix(in oklab, var(--color-pending) 12%, transparent), color-mix(in oklab, var(--color-pending) 4%, transparent))'
                              : 'linear-gradient(135deg, color-mix(in oklab, var(--color-loss) 10%, transparent), color-mix(in oklab, var(--color-loss) 3%, transparent))',
                            border: m > 0
                              ? '1px solid color-mix(in oklab, var(--color-pending) 20%, transparent)'
                              : '1px solid color-mix(in oklab, var(--color-loss) 15%, transparent)',
                          }
                        : { background: 'rgba(255,255,255,0.01)' }
                      }
                    >
                      <span className="text-xs font-medium" style={{ color: isHighlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                        {h} hit{h !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: m > 0 ? (isHighlighted ? 'var(--color-pending)' : 'var(--color-lime)') : 'rgba(255,255,255,0.15)' }}>
                        {m > 0 ? m + 'x' : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))', border: '1px solid color-mix(in oklab, var(--color-lime) 6%, transparent)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Bet History</h3>
            <button
              onClick={() => setHistory([])}
              className="text-xs flex items-center gap-1 transition-colors hover:text-white/50"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      'text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider ' +
                      (h.result === 'win' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss')
                    }
                  >
                    {h.result.toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {h.picks} picks, {h.hits} hits
                  </span>
                </div>
                <span
                  className={
                    'text-xs font-bold tabular-nums ' +
                    (h.result === 'win' ? 'text-win' : 'text-loss')
                  }
                >
                  {h.result === 'win' ? '+' : '-'}${h.payout.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
