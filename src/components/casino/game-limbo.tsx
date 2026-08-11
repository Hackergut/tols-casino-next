'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";

interface Props {
  onBack: () => void;
  initialBalance: number;
}


const TARGET_PRESETS = [1.5, 2, 3, 5, 10, 50];

// Track markers: label, multiplier value, y-position (0-1 range within track)
const TRACK_MARKERS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
  { label: '50x', value: 50 },
  { label: '100x', value: 100 },
];

// Convert a multiplier value to a vertical position (0=top=100x, 1=bottom=1x) using log scale
function multToY(mult: number, trackHeight: number): number {
  if (mult <= 1) return trackHeight;
  const logMin = 0; // log10(1)
  const logMax = 2; // log10(100)
  const logVal = Math.log10(Math.max(1, mult));
  const normalized = logVal / logMax; // 0 at 1x, 1 at 100x
  return trackHeight * (1 - normalized); // flip: 1x at bottom, 100x at top
}

export function LimboGame({ onBack, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(5);
  const [target, setTarget] = useState(2);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; roll: number; payout: number; multiplier: number }>(null);
  const [displayValue, setDisplayValue] = useState(1);
  const [showWinEffect, setShowWinEffect] = useState(false);
  const [showLoseEffect, setShowLoseEffect] = useState(false);
  const [history, setHistory] = useState<Array<{ roll: number; target: number; result: string; payout: number }>>([]);
  const animFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(undefined);
  const rollStartRef = useRef(0);
  const targetRollRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const reduced = useReducedMotion();

  const winChance = target > 1 ? ((99 / target) * 100) : 99;

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Smooth counter animation
  const animateCounter = useCallback((from: number, to: number, duration: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isAnimatingRef.current = true;
    const start = performance.now();

    const tick = (now: number) => {
      if (!isAnimatingRef.current) return;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(to);
        isAnimatingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const roll = useCallback(async () => {
    if (rolling || betAmount <= 0 || betAmount > balance || target <= 1) return;
    setRolling(true);
    setResult(null);
    setShowWinEffect(false);
    setShowLoseEffect(false);

    // Fast scramble phase (skipped under reduced motion)
    let scrambleCount = 0;
    const scrambleInterval = reduced ? undefined : setInterval(() => {
      setDisplayValue(1 + Math.random() * 15);
      scrambleCount++;
      if (scrambleCount > 30 && scrambleInterval) clearInterval(scrambleInterval);
    }, 40);

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'limbo', amount: betAmount, payload: { target } }),
      });
      const data = await res.json();
      if (scrambleInterval) clearInterval(scrambleInterval);

      if (data.success) {
        const payload = data.data.payload as { roll: number };
        const finalRoll = payload.roll;
        const won = data.data.won;

        // Smooth animation to final value (instant under reduced motion)
        if (reduced) {
          setDisplayValue(finalRoll);
        } else {
          animateCounter(displayValue, finalRoll, 800);
        }

        setTimeout(() => {
          const r = { won, roll: finalRoll, payout: data.data.payout, multiplier: data.data.multiplier };
          setResult(r);
          setBalance(data.data.newBalance);
          setHistory(prev => [{ roll: finalRoll, target, result: won ? 'win' : 'lose', payout: won ? data.data.payout : -betAmount }, ...prev].slice(0, 10));
          setRolling(false);

          if (won) {
            setShowWinEffect(true);
            setTimeout(() => setShowWinEffect(false), 2500);
          } else {
            setShowLoseEffect(true);
            setTimeout(() => setShowLoseEffect(false), 1500);
          }
        }, reduced ? 150 : 900);
      } else {
        if (scrambleInterval) clearInterval(scrambleInterval);
        setRolling(false);
      }
    } catch {
      if (scrambleInterval) clearInterval(scrambleInterval);
      setRolling(false);
    }
  }, [rolling, betAmount, balance, target, animateCounter, displayValue, reduced]);

  // Track SVG dimensions
  const TRACK_W = 120;
  const TRACK_H = 340;
  const PAD_TOP = 20;
  const PAD_BOT = 20;
  const INNER_H = TRACK_H - PAD_TOP - PAD_BOT;

  // Calculate orb position
  const orbY = multToY(rolling ? displayValue : (result ? result.roll : target), INNER_H) + PAD_TOP;
  const targetLineY = multToY(target, INNER_H) + PAD_TOP;
  const resultLineY = result ? multToY(result.roll, INNER_H) + PAD_TOP : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Limbo</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Set your target — how high can you go?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_300px] gap-5 items-start">
        {/* Vertical Track */}
        <div className="rounded-2xl p-5 flex flex-col items-center relative" style={{ background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Multiplier Track</p>
          
          <div className="relative" style={{ width: `${TRACK_W + 60}px`, height: `${TRACK_H + 40}px` }}>
            <svg width={TRACK_W + 60} height={TRACK_H + 40} viewBox={`0 0 ${TRACK_W + 60} ${TRACK_H + 40}`}>
              <defs>
                {/* Track glow gradient */}
                <linearGradient id="track-glow-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="color-mix(in oklab, var(--color-lime) 2%, transparent)" />
                  <stop offset="50%" stopColor="color-mix(in oklab, var(--color-lime) 8%, transparent)" />
                  <stop offset="100%" stopColor="color-mix(in oklab, var(--color-lime) 20%, transparent)" />
                </linearGradient>
                {/* Orb glow */}
                <radialGradient id="orb-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="color-mix(in oklab, var(--color-lime) 60%, transparent)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <radialGradient id="orb-glow-win" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="color-mix(in oklab, var(--color-lime) 80%, transparent)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <radialGradient id="orb-glow-lose" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="color-mix(in oklab, var(--color-loss) 80%, transparent)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                {/* Rail gradient */}
                <linearGradient id="rail-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="color-mix(in oklab, var(--color-lime) 30%, transparent)" />
                  <stop offset="100%" stopColor="color-mix(in oklab, var(--color-lime) 5%, transparent)" />
                </linearGradient>
              </defs>

              {/* Track background */}
              <rect x="20" y={PAD_TOP} width={TRACK_W} height={INNER_H} rx="60" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <rect x="20" y={PAD_TOP} width={TRACK_W} height={INNER_H} rx="60" fill="url(#track-glow-grad)" />

              {/* Center rail */}
              <line x1={20 + TRACK_W / 2} y1={PAD_TOP + 10} x2={20 + TRACK_W / 2} y2={PAD_TOP + INNER_H - 10} stroke="url(#rail-grad)" strokeWidth="2" strokeDasharray="4 6" />

              {/* Scale markers */}
              {TRACK_MARKERS.map(m => {
                const my = multToY(m.value, INNER_H) + PAD_TOP;
                return (
                  <g key={m.label}>
                    <line x1="10" y1={my} x2="20" y2={my} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <line x1={20 + TRACK_W} y1={my} x2={20 + TRACK_W + 10} y2={my} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <text x={20 + TRACK_W + 16} y={my + 3} fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif">{m.label}</text>
                  </g>
                );
              })}

              {/* Target line (dashed) */}
              <line
                x1="25" y1={targetLineY}
                x2={20 + TRACK_W - 5} y2={targetLineY}
                stroke="var(--color-lime)" strokeWidth="2" strokeDasharray="6 4" opacity="0.6"
              />
              <rect x="2" y={targetLineY - 8} width="16" height="16" rx="3" fill="color-mix(in oklab, var(--color-lime) 15%, transparent)" stroke="color-mix(in oklab, var(--color-lime) 40%, transparent)" strokeWidth="1" />
              <text x="10" y={targetLineY + 4} textAnchor="middle" fill="var(--color-lime)" fontSize="8" fontWeight="800" fontFamily="system-ui, sans-serif">T</text>

              {/* Result line (after result) */}
              {resultLineY !== null && (
                <g>
                  <line
                    x1="25" y1={resultLineY}
                    x2={20 + TRACK_W - 5} y2={resultLineY}
                    stroke={result?.won ? 'var(--win)' : 'var(--loss)'}
                    strokeWidth="2" opacity="0.8"
                  />
                  <circle cx={20 + TRACK_W / 2} cy={resultLineY} r="4" fill={result?.won ? 'var(--win)' : 'var(--loss)'} opacity="0.8" />
                </g>
              )}

              {/* Glow behind orb */}
              <circle
                cx={20 + TRACK_W / 2}
                cy={orbY}
                r={showWinEffect ? 35 : showLoseEffect ? 30 : 22}
                fill={showWinEffect ? 'url(#orb-glow-win)' : showLoseEffect ? 'url(#orb-glow-lose)' : 'url(#orb-glow)'}
                style={showWinEffect ? { animation: 'win-pulse 0.5s ease-in-out infinite' } : showLoseEffect ? { animation: 'lose-pulse 0.3s ease-in-out 3' } : {}}
              />

              {/* Orb */}
              <circle
                cx={20 + TRACK_W / 2}
                cy={orbY}
                r="10"
                fill={rolling ? 'var(--color-lime)' : result?.won ? 'var(--win)' : result ? 'var(--loss)' : 'var(--color-lime)'}
                style={rolling ? { animation: 'orb-pulse 0.8s ease-in-out infinite' } : {}}
              />
              <circle
                cx={20 + TRACK_W / 2 - 3}
                cy={orbY - 3}
                r="3"
                fill="rgba(255,255,255,0.4)"
              />

              {/* Win particles */}
              {showWinEffect && (
                <g>
                  {Array.from({ length: 12 }, (_, i) => {
                    const angle = (i / 12) * Math.PI * 2;
                    const dist = 20 + (i % 3) * 10;
                    const px = 20 + TRACK_W / 2 + Math.cos(angle) * dist;
                    const py = orbY + Math.sin(angle) * dist;
                    return (
                      <circle
                        key={i}
                        cx={px} cy={py} r={1.5 + (i % 2)}
                        fill={['var(--color-lime)', 'var(--win)', '#ffffff', '#ffd21a'][i % 4]}
                        style={{ animation: `particle-burst 0.8s ease-out ${i * 0.03}s forwards` }}
                      />
                    );
                  })}
                </g>
              )}

              {/* Lose shake ring */}
              {showLoseEffect && (
                <circle
                  cx={20 + TRACK_W / 2}
                  cy={orbY}
                  r="18"
                  fill="none"
                  stroke="var(--color-loss)"
                  strokeWidth="2"
                  style={{ animation: 'lose-ring 0.6s ease-out forwards' }}
                />
              )}
            </svg>
          </div>
        </div>

        {/* Center: Large Result Display */}
        <div className="rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[420px]" style={{ background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 100%)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          {/* Background glow effect */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
            style={{
              background: result?.won ? 'radial-gradient(circle at center, color-mix(in oklab, var(--color-lime) 6%, transparent) 0%, transparent 60%)' : result ? 'radial-gradient(circle at center, color-mix(in oklab, var(--color-loss) 4%, transparent) 0%, transparent 60%)' : 'radial-gradient(circle at center, color-mix(in oklab, var(--color-lime) 3%, transparent) 0%, transparent 50%)',
              opacity: result ? 1 : 0.5,
            }}
          />

          <p className="text-[10px] uppercase tracking-[0.2em] mb-6 relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {rolling ? 'Rolling' : result ? (result.won ? 'You Won!' : 'Result') : 'Ready'}
          </p>

          {/* Main multiplier display */}
          <div className="relative z-10">
            <div
              key={result ? 'settled' : 'live'}
              className="font-black font-mono tabular-nums leading-none"
                  style={{
                  fontSize: result ? '72px' : '64px',
                  color: result
                    ? (result.won ? 'var(--win)' : 'var(--loss)')
                    : rolling ? 'var(--color-lime)' : 'rgba(255,255,255,0.15)',
                  textShadow: result?.won ? '0 0 40px color-mix(in oklab, var(--color-lime) 40%, transparent)' : result ? '0 0 40px color-mix(in oklab, var(--color-loss) 30%, transparent)' : 'none',
                  transition: 'color 0.3s, text-shadow 0.3s',
                  animation: result && !reduced ? 'limbo-slam 0.45s cubic-bezier(0.16, 1, 0.3, 1)' : rolling && !reduced ? 'number-glow 0.5s ease-in-out infinite' : 'none',
                }}
            >
              {displayValue > 0 ? displayValue.toFixed(2) : '0.00'}
              <span className="text-4xl ml-1" style={{ color: result ? (result.won ? 'color-mix(in oklab, var(--color-lime) 60%, transparent)' : 'color-mix(in oklab, var(--color-loss) 50%, transparent)') : 'rgba(255,255,255,0.1)' }}>x</span>
            </div>
          </div>

          {/* Payout info */}
          {result && (
            <div className="mt-6 relative z-10" style={{ animation: 'result-pop 0.4s ease-out' }}>
              <div className="text-3xl font-black font-mono tabular-nums" style={{ color: result.won ? 'var(--win)' : 'var(--loss)' }}>
                {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
              </div>
              <div className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {result.won ? `Rolled ${result.roll.toFixed(2)}x ≥ ${target}x target` : `Rolled ${result.roll.toFixed(2)}x < ${target}x target`}
              </div>
            </div>
          )}

          {!result && !rolling && (
            <p className="mt-6 text-sm relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Roll must reach <span style={{ color: 'var(--color-lime)' }}>{target.toFixed(2)}x</span> to win
            </p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-10 relative z-10 w-full max-w-sm">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Win Chance</p>
              <p className="text-lg font-bold text-white mt-1">{winChance.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Target</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-lime)' }}>{target.toFixed(2)}x</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Potential</p>
              <p className="text-lg font-bold text-white mt-1">${(betAmount * target).toFixed(2)}</p>
            </div>
          </div>

          {/* Win probability bar */}
          <div className="w-full max-w-sm mt-4 relative z-10">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, winChance)}%`,
                  background: winChance > 50 ? 'var(--win)' : winChance > 20 ? 'var(--color-lime)' : winChance > 5 ? 'var(--pending)' : 'var(--loss)',
                  boxShadow: `0 0 8px ${winChance > 50 ? 'color-mix(in oklab, var(--color-lime) 40%, transparent)' : winChance > 20 ? 'color-mix(in oklab, var(--color-lime) 30%, transparent)' : 'color-mix(in oklab, var(--color-loss) 30%, transparent)'}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Balance */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="text-2xl font-black text-lime" />
          </div>

          {/* Target Multiplier */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Target Multiplier</p>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {TARGET_PRESETS.map(v => (
                <button
                  key={v}
                  onClick={() => !rolling && setTarget(v)}
                  className="py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={
                    target === v
                      ? { background: 'color-mix(in oklab, var(--color-lime) 12%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)', boxShadow: '0 0 12px color-mix(in oklab, var(--color-lime) 8%, transparent)' }
                      : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
                  }
                  disabled={rolling}
                >
                  {v}x
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => !rolling && setTarget(v => Math.max(1.01, Math.round((v - 0.5) * 100) / 100))}
                className="px-3 py-2.5 rounded-lg text-xs font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                disabled={rolling}
              >−</button>
              <input
                type="number"
                value={target}
                onChange={e => setTarget(Math.max(1.01, Number(e.target.value)))}
                step="0.01"
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold text-white text-center outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                disabled={rolling}
              />
              <button
                onClick={() => !rolling && setTarget(v => Math.min(1000, v + 0.5))}
                className="px-3 py-2.5 rounded-lg text-xs font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                disabled={rolling}
              >+</button>
            </div>
          </div>

          {/* Bet Amount */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={rolling} />

{/* Bet Button */}
          <button
            onClick={roll}
            disabled={rolling || betAmount <= 0 || betAmount > balance || target <= 1}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-30 hover:shadow-lg"
            style={{
              background: rolling
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, var(--color-lime) 0%, #c2e600 100%)',
              color: rolling ? 'rgba(255,255,255,0.3)' : 'var(--color-bg)',
              boxShadow: rolling ? 'none' : '0 4px 24px color-mix(in oklab, var(--color-lime) 25%, transparent)',
            }}
          >
            {rolling ? 'Rolling...' : 'Bet'}
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Bet History</h3>
            <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1 transition-colors hover:text-white/60" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-md"
                    style={{
                      background: h.result === 'win' ? 'color-mix(in oklab, var(--color-lime) 10%, transparent)' : 'color-mix(in oklab, var(--color-loss) 8%, transparent)',
                      color: h.result === 'win' ? 'var(--color-lime)' : 'var(--loss)',
                    }}
                  >
                    {h.result.toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Target <span style={{ color: 'rgba(255,255,255,0.6)' }}>{h.target}x</span> → Rolled <span style={{ color: 'rgba(255,255,255,0.6)' }}>{h.roll.toFixed(2)}x</span>
                  </span>
                </div>
                <span className={`text-xs font-black tabular-nums ${h.result === 'win' ? 'text-win' : 'text-loss'}`}>
                  {h.result === 'win' ? '+' : '-'}${Math.abs(h.payout).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
  );
}
