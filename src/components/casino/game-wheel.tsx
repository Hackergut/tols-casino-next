'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}



const SEGMENT_DEFS = {
  low: [
    { mult: 1.2, color: '#23301a', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.2, color: '#23301a', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.8, color: '#4a4a0a', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.2, color: '#23301a', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 2.0, color: 'var(--color-lime)', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.2, color: '#23301a', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.2, color: '#23301a', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
  ],
  medium: [
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 2.0, color: 'var(--color-lime)', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 3.0, color: '#ff9e1b', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 2.0, color: 'var(--color-lime)', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 3.0, color: '#ff9e1b', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 2.0, color: 'var(--color-lime)', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 1.5, color: '#2b3a15', accent: false },
  ],
  high: [
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 9.9, color: '#ff4a33', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 4.5, color: '#ff9e1b', accent: true },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 0, color: 'var(--color-surface-raised)', accent: false },
    { mult: 2.0, color: 'var(--color-lime)', accent: true },
  ],
} as const;

const SEGMENTS = 20;
const SEG_ANGLE = 360 / SEGMENTS;
const RADIUS = 130;
const CENTER = 140;
const SIZE = CENTER * 2;
const SPIN_MS = 4400; // 3.8s decel + spring-settle overshoot

export function WheelGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const { balance, setBalance } = useOriginalsSession("wheel", { risk, segments: 20 }, betAmount, initialBalance);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<null | { won: boolean; segment: number; multiplier: number; payout: number }>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winningSegment, setWinningSegment] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ result: string; multiplier: number; payout: number }>>([]);
  const [blurred, setBlurred] = useState(false);
  const reduced = useReducedMotion();

  const segmentDefs = SEGMENT_DEFS[risk];

  const wheelPaths = useMemo(() => {
    return segmentDefs.map((seg, i) => {
      const startAngle = (i * SEG_ANGLE - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * SEG_ANGLE - 90) * (Math.PI / 180);
      const x1 = CENTER + RADIUS * Math.cos(startAngle);
      const y1 = CENTER + RADIUS * Math.sin(startAngle);
      const x2 = CENTER + RADIUS * Math.cos(endAngle);
      const y2 = CENTER + RADIUS * Math.sin(endAngle);
      const largeArc = SEG_ANGLE > 180 ? 1 : 0;
      const d = `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const midAngle = (startAngle + endAngle) / 2;
      const textR = RADIUS * 0.72;
      const tx = CENTER + textR * Math.cos(midAngle);
      const ty = CENTER + textR * Math.sin(midAngle);
      const textRotation = (i * SEG_ANGLE + SEG_ANGLE / 2);
      return { ...seg, d, tx, ty, textRotation, index: i };
    });
  }, [segmentDefs]);

  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return;
    setSpinning(true);
    setResult(null);
    setWinningSegment(null);
    setShowConfetti(false);
    if (!reduced) {
      setBlurred(true);
      setTimeout(() => setBlurred(false), 2600);
    }

    try {
      const data = await placeOriginalsBet("wheel", betAmount, { segments: 20, risk });
      if (data) {
        const payload = data.payload as { segment: number; mult: number };
        const seg = payload.segment;
        // pointer is at top (12 o'clock = 0deg). Segment i spans from i*18 to (i+1)*18.
        // We want the middle of segment i to align with 0deg (top).
        // The wheel is rotated, so we need: -rotation mod 360 = seg*18 + 9 (center of segment)
        // => rotation = 360 - (seg*18 + 9) + fullSpins*360
        const targetAngle = seg * SEG_ANGLE + SEG_ANGLE / 2;
        const fullSpins = 5 + Math.floor(Math.random() * 3);
        const targetRotation = fullSpins * 360 + (360 - targetAngle);
        setRotation(prev => prev + targetRotation);

        setTimeout(() => {
          const r = { won: data.won, segment: payload.segment, multiplier: data.multiplier, payout: data.payout };
          setResult(r);
          setWinningSegment(seg);
          setBalance(data.newBalance);
          setHistory(prev => [{ result: r.won ? 'win' : 'lose', multiplier: r.multiplier, payout: r.payout }, ...prev].slice(0, 10));
          setSpinning(false);
          if (r.won) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          }
        }, SPIN_MS);
      } else {
        setSpinning(false);
      }
    } catch {
      setSpinning(false);
    }
  }, [spinning, betAmount, balance, risk, reduced]);

  const confettiParticles = useMemo(() => {
    if (!showConfetti) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      size: 4 + Math.random() * 6,
      color: ['var(--color-lime)', '#ff9e1b', '#ff4a33', '#d4f000', '#ffffff', '#ffd21a'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
    }));
  }, [showConfetti]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Wheel</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Spin the wheel — win up to 9.9x!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Wheel Area */}
        <div className="rounded-2xl p-6 flex flex-col items-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 100%)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          {/* Background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-lime) 15%, transparent) 0%, transparent 70%)' }} />

          {/* Confetti */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {confettiParticles.map(p => (
                <div
                  key={p.id}
                  className="absolute"
                  style={{
                    left: `${p.x}%`,
                    top: '-10px',
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: p.color,
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    transform: `rotate(${p.rotation}deg)`,
                    animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Pointer — tick deflection while segments pass, decelerating with the wheel */}
          <motion.div
            className="relative z-20 mb-[-8px]"
            style={{ transformOrigin: '50% 20%' }}
            animate={spinning && !reduced ? { rotate: [0, -13, 0, -13, 0, -12, 0, -11, 0, -9, 0, -7, 0, -4, 0, -2, 0] } : { rotate: 0 }}
            transition={spinning && !reduced ? { duration: SPIN_MS / 1000, times: [0, 0.04, 0.08, 0.13, 0.18, 0.24, 0.3, 0.37, 0.44, 0.52, 0.6, 0.69, 0.78, 0.86, 0.92, 0.97, 1], ease: 'easeOut' } : { type: 'spring', stiffness: 600, damping: 18 }}
          >
            <svg width="36" height="32" viewBox="0 0 36 32">
              <defs>
                <filter id="pointer-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="pointer-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffd21a" />
                  <stop offset="100%" stopColor="var(--color-lime)" />
                </linearGradient>
              </defs>
              <polygon points="18,28 4,4 32,4" fill="url(#pointer-grad)" stroke="var(--color-bg)" strokeWidth="2" filter="url(#pointer-glow)" />
            </svg>
          </motion.div>

          {/* SVG Wheel — motion blur at speed, spring-settle overshoot at the end */}
          <div className="relative z-10" style={{ width: `${SIZE}px`, height: `${SIZE}px`, filter: blurred ? 'blur(1.6px)' : 'none', transition: 'filter 500ms ease' }}>
            <motion.svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ transformOrigin: '50% 50%' }}
              animate={reduced ? { rotate: rotation } : { rotate: [null, rotation + 9, rotation] }}
              transition={
                reduced
                  ? { duration: 0.4, ease: 'easeOut' }
                  : { duration: SPIN_MS / 1000, times: [0, 0.86, 1], ease: [[0.17, 0.67, 0.12, 0.99], [0.34, 1.56, 0.64, 1]] }
              }
            >
              <defs>
                <filter id="seg-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="wheel-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="85%" stopColor="transparent" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
                </radialGradient>
                <radialGradient id="hub-grad" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#242420" />
                  <stop offset="100%" stopColor="var(--color-bg)" />
                </radialGradient>
              </defs>

              {/* Outer ring */}
              <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="none" stroke="color-mix(in oklab, var(--color-lime) 15%, transparent)" strokeWidth="2" />
              <circle cx={CENTER} cy={CENTER} r={RADIUS + 1} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

              {/* Segments */}
              {wheelPaths.map((seg, i) => {
                const isWinning = winningSegment === i && !spinning;
                return (
                  <g key={i}>
                    <path
                      d={seg.d}
                      fill={seg.color}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="0.5"
                      style={isWinning && seg.mult > 0 ? {
                        animation: 'segment-pulse 1s ease-in-out infinite',
                        filter: 'url(#seg-glow)',
                      } : {}}
                    />
                    {seg.mult > 0 && (
                      <g transform={`translate(${seg.tx}, ${seg.ty}) rotate(${seg.textRotation})`}>
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={seg.accent ? 'var(--color-bg)' : 'var(--color-lime)'}
                          fontSize={seg.mult >= 9.9 ? '9' : seg.mult >= 4 ? '10' : '11'}
                          fontWeight="800"
                          fontFamily="system-ui, sans-serif"
                          style={{ textShadow: seg.accent ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}
                        >
                          {seg.mult}x
                        </text>
                      </g>
                    )}
                    {seg.mult === 0 && (
                      <g transform={`translate(${seg.tx}, ${seg.ty})`}>
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="rgba(255,255,255,0.12)"
                          fontSize="9"
                          fontWeight="600"
                        >
                          ✕
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Shadow overlay */}
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#wheel-shadow)" />

              {/* Center hub */}
              <circle cx={CENTER} cy={CENTER} r="36" fill="url(#hub-grad)" stroke="color-mix(in oklab, var(--color-lime) 25%, transparent)" strokeWidth="2" />
              <circle cx={CENTER} cy={CENTER} r="28" fill="none" stroke="color-mix(in oklab, var(--color-lime) 10%, transparent)" strokeWidth="1" />
              <text x={CENTER} y={CENTER + 1} textAnchor="middle" dominantBaseline="central" fill="var(--color-lime)" fontSize="11" letterSpacing="1" fontFamily="var(--font-display), system-ui, sans-serif">TOLS</text>
            </motion.svg>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`mt-6 px-8 py-3 rounded-2xl text-center transition-all ${result.won ? 'animate-result-win' : 'animate-result-lose'}`}
              style={{
                background: result.won ? 'color-mix(in oklab, var(--color-lime) 10%, transparent)' : 'color-mix(in oklab, var(--color-loss) 8%, transparent)',
                border: result.won ? '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)' : '1px solid color-mix(in oklab, var(--color-loss) 20%, transparent)',
              }}
            >
              <div className="text-2xl font-black font-mono tabular-nums" style={{ color: result.won ? 'var(--color-lime)' : 'var(--loss)' }}>
                {result.won ? `+${result.payout.toFixed(2)}` : 'BUST'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {result.multiplier}x multiplier
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Balance */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="text-2xl font-black text-lime" />
          </div>

          {/* Risk Level */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Risk Level</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => !spinning && setRisk(r)}
                  className="py-2.5 rounded-xl text-xs font-bold capitalize transition-all"
                  style={
                    risk === r
                      ? { background: 'color-mix(in oklab, var(--color-lime) 12%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)', boxShadow: '0 0 12px color-mix(in oklab, var(--color-lime) 10%, transparent)' }
                      : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
                  }
                  disabled={spinning}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={spinning} />

{/* Spin Button */}
          <button
            onClick={spin}
            disabled={spinning || betAmount <= 0 || betAmount > balance}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-30 hover:shadow-lg"
            style={{
              background: spinning
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, var(--color-lime) 0%, #c2e600 100%)',
              color: spinning ? 'rgba(255,255,255,0.3)' : 'var(--color-bg)',
              boxShadow: spinning ? 'none' : '0 4px 24px color-mix(in oklab, var(--color-lime) 25%, transparent)',
            }}
          >
            {spinning ? 'Spinning…' : 'Spin Wheel'}
          </button>

          {/* Multiplier Legend */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Segment Guide</p>
            <div className="space-y-1.5">
              {risk === 'low' && (
                <>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#23301a' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>1.2x — Frequent</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#2b3a15' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>1.5x — Common</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#4a4a0a' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>1.8x — Uncommon</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-lime)' }} /><span className="text-[11px] font-bold" style={{ color: 'var(--color-lime)' }}>2.0x — Rare!</span></div>
                </>
              )}
              {risk === 'medium' && (
                <>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#2b3a15' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>1.5x — Frequent</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-lime)' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>2.0x — Common</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#ff9e1b' }} /><span className="text-[11px] font-bold" style={{ color: '#ff9e1b' }}>3.0x — Rare!</span></div>
                </>
              )}
              {risk === 'high' && (
                <>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-lime)' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>2.0x — Uncommon</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#ff9e1b' }} /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>4.5x — Rare</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#ff4a33' }} /><span className="text-[11px] font-bold" style={{ color: '#ff4a33' }}>9.9x — Legendary!</span></div>
                </>
              )}
            </div>
          </div>
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
          <div className="flex gap-2 flex-wrap">
            {history.map((h, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-xl text-xs font-black"
                style={{
                  background: h.result === 'win' ? 'color-mix(in oklab, var(--color-lime) 8%, transparent)' : 'color-mix(in oklab, var(--color-loss) 6%, transparent)',
                  color: h.result === 'win' ? 'var(--color-lime)' : 'var(--color-loss)',
                  border: h.result === 'win' ? '1px solid color-mix(in oklab, var(--color-lime) 15%, transparent)' : '1px solid color-mix(in oklab, var(--color-loss) 10%, transparent)',
                }}
              >
                {h.multiplier}x {h.result === 'win' ? `+$${h.payout.toFixed(2)}` : '✕'}
              </span>
            ))}
          </div>
        </div>
      )}

      </div>
  );
}
