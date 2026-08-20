'use client';

import { useState, useCallback, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RotateCcw, Target } from 'lucide-react';
import { GameBetControls, GameBalance, GameHeader } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}



/* ── SVG Target Component ── */
function TargetSVG({ multiplier, revealed, hit, isResult, won, shooting, index }: {
  multiplier: number;
  revealed: boolean;
  hit: boolean;
  isResult: boolean;
  won: boolean;
  shooting: boolean;
  index: number;
}) {
  const color = multiplier >= 5 ? 'var(--color-lime)' : multiplier >= 2 ? 'var(--color-win)' : multiplier >= 1 ? '#a8a89e' : multiplier > 0 ? 'var(--color-pending)' : 'var(--color-loss)';
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative"
        style={{
          width: '120px',
          height: '120px',
          cursor: !revealed && !shooting ? 'crosshair' : 'default',
          animation: !revealed && !shooting && !reduced ? `targetBob ${2 + index * 0.15}s ease-in-out infinite` : 'none',
        } as React.CSSProperties}
      >
        <svg width="120" height="120" viewBox="0 0 120 120" className="w-full h-full">
          <defs>
            <radialGradient id={`targetGlow-${index}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity={isResult && won ? 0.4 : 0.15} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
            <filter id={`targetFilter-${index}`}>
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Hit animation wrapper */}
          <g style={{
            animation: reduced ? 'none' : hit ? 'targetShatter 0.5s ease-out forwards' : revealed && !hit ? 'targetReveal 0.4s ease-out forwards' : 'none',
          }}>
            {/* Glow */}
            <circle cx="60" cy="60" r="55" fill={`url(#targetGlow-${index})`} />

            {/* Outer ring */}
            <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="2" strokeOpacity={revealed ? 0.6 : 0.2} />
            <circle cx="60" cy="60" r="40" fill={revealed ? `${color}15` : 'rgba(255,255,255,0.03)'} stroke={color} strokeWidth="1.5" strokeOpacity={revealed ? 0.5 : 0.15} />
            <circle cx="60" cy="60" r="28" fill={revealed ? `${color}22` : 'rgba(255,255,255,0.02)'} stroke={color} strokeWidth="1.5" strokeOpacity={revealed ? 0.4 : 0.1} />
            <circle cx="60" cy="60" r="16" fill={revealed ? color : 'rgba(255,255,255,0.05)'} fillOpacity={revealed ? 0.3 : 1} />

            {/* Bullseye center */}
            <circle cx="60" cy="60" r="5" fill={revealed ? color : 'rgba(255,255,255,0.15)'} />

            {/* Crosshair lines */}
            {!revealed && (
              <>
                <line x1="60" y1="5" x2="60" y2="20" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
                <line x1="60" y1="100" x2="60" y2="115" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
                <line x1="5" y1="60" x2="20" y2="60" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
                <line x1="100" y1="60" x2="115" y2="60" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
              </>
            )}

            {/* Multiplier text or "?" */}
            {revealed ? (
              <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
                fill={color} fontSize="18" fontWeight="800" fontFamily="monospace"
                filter={`url(#targetFilter-${index})`}
              >
                {multiplier}x
              </text>
            ) : (
              <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
                fill="rgba(255,255,255,0.35)" fontSize="28" fontWeight="800"
              >
                ?
              </text>
            )}
          </g>
        </svg>

        {/* Impact particles */}
        {isResult && won && revealed && !reduced && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const dist = 60;
              return (
                <div key={i} className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: color,
                    left: '50%', top: '50%',
                    marginLeft: '-4px', marginTop: '-4px',
                    ['--px' as string]: `${Math.cos(angle) * dist}px`,
                    ['--py' as string]: `${Math.sin(angle) * dist}px`,
                    animation: `particleBurst 0.6s ease-out ${i * 0.05}s forwards`,
                    opacity: 0,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Result border glow */}
        {isResult && revealed && (
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `2px solid ${won ? 'var(--color-win)' : 'var(--color-loss)'}`,
              boxShadow: won ? '0 0 30px color-mix(in oklab, var(--color-lime) 40%, transparent), inset 0 0 20px color-mix(in oklab, var(--color-lime) 10%, transparent)' : '0 0 30px color-mix(in oklab, var(--color-loss) 40%, transparent), inset 0 0 20px color-mix(in oklab, var(--color-loss) 10%, transparent)',
              animation: won ? 'winBurst 0.8s ease-out' : 'lossFall 0.8s ease-out',
            }}
          />
        )}
      </div>

      {/* Label below */}
      <span className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: revealed ? color : 'rgba(255,255,255,0.25)' }}>
        {revealed ? `${multiplier}x Multiplier` : `Target ${index + 1}`}
      </span>
    </div>
  );
}

export function ShootGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const [targetMult, setTargetMult] = useState(2);
  const { balance, setBalance } = useOriginalsSession("shoot", { target: targetMult }, betAmount, initialBalance);
  const [gameState, setGameState] = useState<'idle' | 'ready' | 'shooting' | 'result'>('idle');
  const [targets, setTargets] = useState<number[]>([]);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [result, setResult] = useState<null | { won: boolean; multiplier: number; payout: number }>(null);
  const [history, setHistory] = useState<Array<{ result: string; target: number; mult: number; payout: number }>>([]);
  const [flash, setFlash] = useState(false);
  const reduced = useReducedMotion();

  const potentialWin = useMemo(() => betAmount * 25, [betAmount]);

  const startRound = useCallback(() => {
    if (betAmount <= 0 || betAmount > balance) return;
    setTargets([0, 0, 0, 0, 0]);
    setChosenIdx(null);
    setResult(null);
    setGameState('ready');
  }, [betAmount, balance]);

  const shootTarget = useCallback(async (idx: number) => {
    if (gameState !== 'ready') return;
    setGameState('shooting');
    setChosenIdx(idx);
    if (!reduced) {
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }
    try {
      const data = await placeOriginalsBet("shoot", betAmount, {});
      const mult = Number((data.payload as { mult?: number }).mult ?? data.multiplier);
      const shown = [0, 1.5, 2.2, 4, 9];
      shown[idx] = mult;
      setTargets(shown);
      setResult({ won: data.won, multiplier: mult, payout: data.payout });
      setBalance(data.newBalance);
      setGameState('result');
      setHistory(prev => [{
        result: data.won ? 'win' : 'lose',
        target: targetMult,
        mult,
        payout: data.won ? data.payout : -betAmount,
      }, ...prev].slice(0, 10));
    } catch {
      setGameState('ready');
    }
  }, [gameState, betAmount, targetMult, reduced]);

  const resetRound = useCallback(() => {
    setGameState('idle');
    setTargets([]);
    setChosenIdx(null);
    setResult(null);
  }, []);

  const targetOptions = [1, 2, 3, 5, 7, 10];

  return (
    <div className="space-y-6">
      <GameHeader title="Target Shoot" subtitle="Hit a multiplier ≥ your target — you win the revealed payout" onBack={onBack} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Game Area */}
        <div className="lg:col-span-3">
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)',
              animation: gameState === 'shooting' && !reduced ? 'shootRecoil 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            {/* Muzzle flash */}
            {flash && !reduced && (
              <div
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.4), color-mix(in oklab, var(--color-lime) 18%, transparent) 30%, transparent 60%)',
                  animation: 'muzzleFlash 0.18s ease-out forwards',
                }}
              />
            )}
            {/* Target Display */}
            <div className="py-8 px-4">
              {gameState === 'idle' ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: 'color-mix(in oklab, var(--color-lime) 8%, transparent)',
                      border: '2px solid color-mix(in oklab, var(--color-lime) 20%, transparent)',
                    }}
                  >
                    <Target className="w-10 h-10" style={{ color: 'color-mix(in oklab, var(--color-lime) 50%, transparent)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Set your target and press Start to begin
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Shoot a target — find {targetMult}x or higher to win!
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
                    {targets.map((mult, i) => (
                      <button
                        key={i}
                        onClick={() => shootTarget(i)}
                        disabled={gameState !== 'ready'}
                        className="transition-transform hover:scale-105 active:scale-95"
                        style={{ opacity: gameState === 'shooting' && chosenIdx !== i ? 0.3 : 1 }}
                      >
                        <TargetSVG
                          multiplier={mult}
                          revealed={gameState === 'shooting' || gameState === 'result'}
                          hit={gameState === 'shooting' && chosenIdx === i}
                          isResult={gameState === 'result' && chosenIdx === i}
                          won={gameState === 'result' ? (result?.won ?? false) : false}
                          shooting={gameState === 'shooting'}
                          index={i}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Result banner */}
                  {gameState === 'result' && result && (
                    <div className="mt-6 text-center" style={{ animation: 'winBurst 0.5s ease-out' }}>
                      <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl"
                        style={{
                          background: result.won
                            ? 'linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 15%, transparent), color-mix(in oklab, var(--color-lime) 10%, transparent))'
                            : 'linear-gradient(135deg, color-mix(in oklab, var(--color-loss) 15%, transparent), color-mix(in oklab, var(--color-loss) 5%, transparent))',
                          border: `1px solid ${result.won ? 'color-mix(in oklab, var(--color-lime) 30%, transparent)' : 'color-mix(in oklab, var(--color-loss) 30%, transparent)'}`,
                        }}
                      >
                        <span className={`text-2xl font-black tabular-nums ${result.won ? 'text-lime' : 'text-loss'}`}>
                          {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Hit {result.multiplier}x — needed {targetMult}x
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom bar: target mult selector */}
            <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Target Multiplier</span>
                  <div className="flex gap-1.5">
                    {targetOptions.map(opt => (
                      <button key={opt} onClick={() => setTargetMult(opt)}
                        disabled={gameState !== 'idle'}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={targetMult === opt
                          ? { background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)', boxShadow: '0 0 10px color-mix(in oklab, var(--color-lime) 10%, transparent)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {opt}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {gameState === 'result' && (
                    <button onClick={resetRound}
                    className="g-btn g-btn-secondary"
                    >
                      New Round
                    </button>
                  )}
                  <button onClick={gameState === 'idle' ? startRound : resetRound}
                    disabled={(gameState !== 'idle' && gameState !== 'result') || betAmount <= 0 || betAmount > balance}
                    className="g-btn g-btn-play"
                  >
                    {gameState === 'idle' ? 'Start Round' : 'New Round'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Balance */}
          <GameBalance value={balance} />

          {/* Bet Amount */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={gameState === 'shooting' || gameState === 'result'} />

{/* Game Info */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Game Info</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Target Multiplier</span>
                <span className="text-xs font-bold" style={{ color: 'var(--color-lime)' }}>{targetMult}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Potential Win</span>
                <span className="text-xs font-bold text-win">${potentialWin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Targets</span>
                <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>5</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Min Win</span>
                <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>0x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Max Win</span>
                <span className="text-xs font-bold" style={{ color: 'var(--color-lime)' }}>25x</span>
              </div>
            </div>
          </div>

          {/* How to play */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>How to Play</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{ background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)' }}>1</span>
                <span className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>Choose a target multiplier</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{ background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)' }}>2</span>
                <span className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>Start the round — 5 targets appear</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{ background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)' }}>3</span>
                <span className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>Shoot one target — if the hit is ≥ your target, you win that multiplier</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Bet History</h3>
            <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in oklab, var(--color-lime) 20%, transparent) transparent' }}>
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${h.result === 'win' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                    {h.result.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Target {h.target}x → hit <span style={{ color: h.mult >= 5 ? 'var(--color-lime)' : h.mult >= 2 ? 'var(--color-win)' : h.mult > 0 ? 'var(--color-pending)' : 'var(--color-loss)' }}>{h.mult}x</span>
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${h.result === 'win' ? 'text-win' : 'text-loss'}`}>
                  {h.payout >= 0 ? '+' : ''}{h.payout.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
