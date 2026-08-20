'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Minus, Plus } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";
import { originalsAction, placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}


const MINE_OPTIONS = [1, 3, 5, 10, 15, 24];

/* ── SVG Icons ── */
function GemIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <linearGradient id="gem-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dcff6b" />
          <stop offset="50%" stopColor="var(--color-win)" />
          <stop offset="100%" stopColor="#b8e600" />
        </linearGradient>
        <linearGradient id="gem-shine" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <polygon points="20,4 36,16 28,36 12,36 4,16" fill="url(#gem-grad)" stroke="#b8e600" strokeWidth="0.5" />
      <polygon points="20,4 36,16 20,18 4,16" fill="url(#gem-shine)" opacity="0.7" />
      <line x1="20" y1="4" x2="20" y2="36" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1="4" y1="16" x2="36" y2="16" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      <line x1="20" y1="18" x2="12" y2="36" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <line x1="20" y1="18" x2="28" y2="36" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <polygon points="20,8 26,14 20,16 14,14" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

function BombIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <radialGradient id="bomb-grad" cx="0.4" cy="0.35" r="0.6">
          <stop offset="0%" stopColor="#555" />
          <stop offset="100%" stopColor="#141412" />
        </radialGradient>
        <radialGradient id="bomb-highlight" cx="0.3" cy="0.25" r="0.3">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      {/* Spikes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <line
          key={i}
          x1={20 + 12 * Math.cos((angle * Math.PI) / 180)}
          y1={22 + 12 * Math.sin((angle * Math.PI) / 180)}
          x2={20 + 16 * Math.cos((angle * Math.PI) / 180)}
          y2={22 + 16 * Math.sin((angle * Math.PI) / 180)}
          stroke="var(--color-loss)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {/* Body */}
      <circle cx="20" cy="22" r="12" fill="url(#bomb-grad)" stroke="#333" strokeWidth="1" />
      <circle cx="20" cy="22" r="11" fill="url(#bomb-highlight)" />
      {/* Fuse */}
      <path d="M20,10 Q22,6 25,8 Q27,5 24,3" stroke="#888" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Spark */}
      <circle cx="24" cy="3" r="2" fill="var(--color-pending)">
        <animate attributeName="r" values="1.5;3;1.5" dur="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="0.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="24" cy="3" r="3" fill="none" stroke="var(--color-pending)" strokeWidth="0.5" opacity="0.5">
        <animate attributeName="r" values="2;5;2" dur="0.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="0.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Confetti Particle ── */
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  const styles = {
    left: `${x}%`,
    animationDelay: `${delay}ms`,
    backgroundColor: color,
  } as React.CSSProperties;
  return <div className="mines-confetti-particle" style={styles} />;
}

export function MinesGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const [mineCount, setMineCount] = useState(3);
  const { balance, setBalance } = useOriginalsSession("mines", { mines: mineCount, tilesToReveal: 3 }, betAmount, initialBalance);
  const [phase, setPhase] = useState<'betting' | 'playing' | 'done'>('betting');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [mines, setMines] = useState<Set<number>>(new Set());
  const [payout, setPayout] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(0);
  const [displayMultiplier, setDisplayMultiplier] = useState(0);
  const [result, setResult] = useState<null | { won: boolean; payout: number; hitMine: boolean }>(null);
  const [history, setHistory] = useState<Array<{ result: string; payout: number; mines: number; picks: number }>>([]);
  const [shaking, setShaking] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const roundIdRef = useRef<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('tols:game-params', { detail: { gameId: 'mines', params: { mines: mineCount, tilesToReveal: 3 }, bet: betAmount } }));
  }, [mineCount, betAmount]);

  const currentPicks = useMemo(() => Array.from(revealed), [revealed]);

  const mineMultiplier = useMemo(() => {
    if (phase !== 'playing') return 0;
    let m = 1;
    for (let i = 0; i < currentPicks.length; i++) {
      m *= (25 - i) / (25 - mineCount - i);
    }
    return Math.max(1, m * 0.99);
  }, [currentPicks, mineCount, phase]);

  /* Smooth multiplier counter animation */
  useEffect(() => {
    if (phase !== 'playing') {
      setDisplayMultiplier(currentMultiplier);
      return;
    }
    const target = currentMultiplier;
    const start = displayMultiplier;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      setDisplayMultiplier(target);
      return;
    }
    const duration = 400;
    const startTime = performance.now();
    let raf: number;
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMultiplier(start + diff * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [currentMultiplier, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Multiplier progress (0-1 range based on typical range) */
  const multiplierProgress = useMemo(() => {
    if (displayMultiplier <= 1) return 0;
    // Typical range: 1x to ~50x depending on mine count
    const maxExpected = mineCount <= 5 ? 50 : mineCount <= 15 ? 20 : 10;
    return Math.min((displayMultiplier - 1) / (maxExpected - 1), 1);
  }, [displayMultiplier, mineCount]);

  const startGame = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance) return;
    setRevealed(new Set());
    setMines(new Set());
    setPayout(0);
    setCurrentMultiplier(0);
    setDisplayMultiplier(0);
    setResult(null);
    setGameKey(k => k + 1);
    try {
      const data = await placeOriginalsBet('mines', betAmount, { mines: mineCount, tilesToReveal: 3 }, 'start');
      roundIdRef.current = data.roundId ?? null;
      setBalance(data.newBalance);
      setPhase('playing');
    } catch { /* ignore */ }
  }, [betAmount, balance, mineCount]);

  const revealTile = useCallback(async (idx: number) => {
    if (phase !== 'playing' || revealed.has(idx) || !roundIdRef.current) return;

    try {
      const data = await originalsAction('mines', roundIdRef.current, { type: 'reveal', cellIndex: idx });
      const payload = data.payload as { picks?: number[]; layout?: boolean[]; multiplier?: number };
      const picks = payload.picks ?? [];
      setRevealed(new Set(picks.filter((p) => !(payload.layout && payload.layout[p]))));
      if (payload.layout) {
        const minePositions = new Set<number>();
        payload.layout.forEach((m, i) => { if (m) minePositions.add(i); });
        setMines(minePositions);
      }
      const mult = Number(payload.multiplier ?? data.multiplier ?? 0);
      setCurrentMultiplier(mult);
      setPayout(betAmount * mult);
      setBalance(data.newBalance);

      if (!data.pending) {
        setPhase('done');
        if (!data.won) {
          setRevealed(new Set(picks));
          setResult({ won: false, payout: 0, hitMine: true });
          setHistory(prev => [{ result: 'lose', payout: 0, mines: mineCount, picks: Math.max(0, picks.length - 1) }, ...prev].slice(0, 10));
          setShaking(true);
          setRedFlash(true);
          setTimeout(() => setShaking(false), 500);
          setTimeout(() => setRedFlash(false), 600);
        } else {
          setResult({ won: true, payout: data.payout, hitMine: false });
          setHistory(prev => [{ result: 'win', payout: data.payout, mines: mineCount, picks: picks.length }, ...prev].slice(0, 10));
        }
      }
    } catch { /* ignore */ }
  }, [phase, revealed, betAmount, mineCount]);

  const cashOut = useCallback(async () => {
    if (phase !== 'playing' || revealed.size === 0 || !roundIdRef.current) return;
    try {
      const data = await originalsAction("mines", roundIdRef.current, { type: "cashout" });
      const payload = data.payload as { layout?: boolean[] };
      if (payload.layout) {
        const minePositions = new Set<number>();
        payload.layout.forEach((m, i) => { if (m) minePositions.add(i); });
        setMines(minePositions);
      }
      setPhase('done');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      setResult({ won: true, payout: data.payout, hitMine: false });
      setPayout(data.payout);
      setBalance(data.newBalance);
      setHistory(prev => [{ result: 'win', payout: data.payout, mines: mineCount, picks: currentPicks.length }, ...prev].slice(0, 10));
    } catch { /* ignore */ }
  }, [phase, revealed, mineCount, currentPicks]);

  const reset = useCallback(() => {
    setPhase('betting');
    setRevealed(new Set());
    setMines(new Set());
    setPayout(0);
    setCurrentMultiplier(0);
    setDisplayMultiplier(0);
    setResult(null);
    setShowConfetti(false);
  }, []);

  const confettiColors = ['var(--color-lime)', 'var(--color-win)', 'var(--color-pending)', '#c2e600', '#ff8a5c', '#f0c04a'];

  return (
    <div className="mines-game-wrapper relative">
      {/* CSS Keyframes */}
      {/* Red Flash Overlay */}
      {redFlash && !reduced && (
        <div
          className="mines-red-flash-overlay fixed inset-0 z-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--loss) 40%, transparent), color-mix(in srgb, var(--loss) 10%, transparent))' }}
        />
      )}

      {/* Confetti */}
      {showConfetti && !reduced && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle
              key={i}
              delay={i * 50}
              x={10 + Math.random() * 80}
              color={confettiColors[i % confettiColors.length]}
            />
          ))}
        </div>
      )}

      {/* Shaking container */}
      <div className={shaking && !reduced ? 'mines-screen-shake' : ''}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl transition-all duration-200 hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-pending) 20%, transparent), color-mix(in oklab, var(--color-pending) 5%, transparent))', border: '1px solid color-mix(in oklab, var(--color-pending) 20%, transparent)' }}>
              <BombIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Mines</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Reveal safe tiles — avoid the mines!</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid Area */}
          <div className="lg:col-span-2">
            <div
              ref={gridRef}
              className="rounded-2xl p-5 sm:p-8 relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)',
                border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)',
                boxShadow: '0 0 60px color-mix(in oklab, var(--color-lime) 3%, transparent), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {/* Subtle grid pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                  backgroundImage: `repeating-linear-gradient(0deg, color-mix(in oklab, var(--color-lime) 30%, transparent) 0px, color-mix(in oklab, var(--color-lime) 30%, transparent) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-lime) 30%, transparent) 0px, color-mix(in oklab, var(--color-lime) 30%, transparent) 1px, transparent 1px, transparent 40px)`
                }}
              />

              {/* Result Banner */}
              {result && (
                <div className={`text-center mb-5 py-3 rounded-xl text-sm font-bold tracking-wide relative overflow-hidden ${result.won ? '' : ''}`}
                  style={result.won
                    ? { background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-win) 15%, transparent), color-mix(in oklab, var(--color-win) 5%, transparent))', border: '1px solid color-mix(in oklab, var(--color-win) 30%, transparent)', color: 'var(--color-win)' }
                    : { background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-loss) 15%, transparent), color-mix(in oklab, var(--color-loss) 5%, transparent))', border: '1px solid color-mix(in oklab, var(--color-loss) 30%, transparent)', color: 'var(--color-loss)' }
                  }
                >
                  {result.won ? `✓ Cashed out! +$${result.payout.toFixed(2)}` : '✕ BOOM! Hit a mine!'}
                </div>
              )}

              {/* 5x5 Grid */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5 max-w-[340px] mx-auto relative z-10">
                {Array.from({ length: 25 }).map((_, i) => {
                  const isRevealed = revealed.has(i);
                  const isMine = mines.has(i);
                  const showMine = (phase === 'done' && isMine);
                  const hitMine = isRevealed && isMine;
                  const showSafe = isRevealed && !isMine;
                  const flipped = showSafe || hitMine || showMine;
                  const row = Math.floor(i / 5);
                  const col = i % 5;
                  // cascade-reveal the remaining mines on loss
                  const cascadeDelay = showMine && !hitMine ? row * 0.05 + col * 0.03 : 0;

                  return (
                    <button
                      key={`${gameKey}-${i}`}
                      onClick={() => revealTile(i)}
                      disabled={phase !== 'playing' || isRevealed}
                      className={`relative aspect-square [perspective:600px] ${!isRevealed && phase === 'playing' ? 'cursor-pointer' : ''}`}
                      aria-label={`Tile ${i + 1}`}
                    >
                      {/* 3D flip: cover face → value face */}
                      <motion.div
                        className="relative h-full w-full [transform-style:preserve-3d]"
                        initial={false}
                        animate={{ rotateY: flipped ? 180 : 0 }}
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 30, delay: cascadeDelay }}
                      >
                        {/* cover */}
                        <div
                          className={`absolute inset-0 overflow-hidden rounded-xl [backface-visibility:hidden] ${!isRevealed && phase === 'playing' ? 'mines-tile-unrevealed' : ''}`}
                          style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                            border: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.02)',
                          }}
                        >
                          <svg className="absolute inset-0 h-full w-full opacity-[0.06]" viewBox="0 0 40 40" preserveAspectRatio="none">
                            <pattern id={`diamond-${i}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <polygon points="10,2 18,10 10,18 2,10" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                            <rect width="40" height="40" fill={`url(#diamond-${i})`} />
                          </svg>
                        </div>
                        {/* value face */}
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded-xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
                          style={
                            hitMine
                              ? {
                                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--loss) 35%, transparent), color-mix(in srgb, var(--loss) 15%, transparent))',
                                  border: '1px solid color-mix(in srgb, var(--loss) 50%, transparent)',
                                  boxShadow: '0 0 20px color-mix(in srgb, var(--loss) 20%, transparent)',
                                }
                              : showMine
                                ? {
                                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--loss) 20%, transparent), color-mix(in srgb, var(--loss) 8%, transparent))',
                                    border: '1px solid color-mix(in srgb, var(--loss) 25%, transparent)',
                                  }
                                : {
                                    background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-win) 25%, transparent), color-mix(in oklab, var(--color-win) 10%, transparent))',
                                    border: '1px solid color-mix(in oklab, var(--color-win) 40%, transparent)',
                                    boxShadow: '0 0 15px color-mix(in oklab, var(--color-win) 15%, transparent)',
                                  }
                          }
                        >
                          {showSafe && <GemIcon className="mines-gem-sparkle h-7 w-7 sm:h-8 sm:w-8" />}
                          {(hitMine || showMine) && <BombIcon className="h-6 w-6 sm:h-7 sm:w-7" />}
                          {/* gem sparkle burst */}
                          {showSafe && !reduced && (
                            <span className="pointer-events-none absolute inset-0">
                              {[0, 1, 2, 3, 4, 5].map(k => (
                                <motion.span
                                  key={k}
                                  className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
                                  style={{ background: 'var(--color-lime)' }}
                                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                  animate={{
                                    x: Math.cos((k * Math.PI) / 3) * 26,
                                    y: Math.sin((k * Math.PI) / 3) * 26,
                                    opacity: 0,
                                    scale: 0.4,
                                  }}
                                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
                                />
                              ))}
                            </span>
                          )}
                          {/* bomb shockwave ring */}
                          {hitMine && !reduced && (
                            <motion.span
                              className="pointer-events-none absolute inset-0 m-auto h-4 w-4 rounded-full border-2"
                              style={{ borderColor: 'var(--loss)' }}
                              initial={{ scale: 0.4, opacity: 1 }}
                              animate={{ scale: 5, opacity: 0 }}
                              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                            />
                          )}
                        </div>
                      </motion.div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Balance Card */}
            <div className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))',
                border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)',
              }}
            >
              <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Balance</p>
              <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="mt-1 text-2xl font-bold text-lime" />
            </div>

            {/* Multiplier Display (Playing) */}
            {phase === 'playing' && (
              <div className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 8%, transparent), color-mix(in oklab, var(--color-lime) 2%, transparent))',
                  border: '1px solid color-mix(in oklab, var(--color-lime) 15%, transparent)',
                  boxShadow: '0 0 30px color-mix(in oklab, var(--color-lime) 5%, transparent)',
                }}
              >
                <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Current Multiplier</p>
                <p className={`text-4xl font-black tabular-nums mt-2 mines-multiplier-pop ${displayMultiplier > 1 ? '' : ''}`}
                  key={displayMultiplier.toFixed(2)}
                  style={{
                    color: displayMultiplier >= 5 ? 'var(--color-pending)' : 'var(--color-lime)',
                    textShadow: `0 0 25px ${displayMultiplier >= 5 ? 'rgba(251,191,36,0.4)' : 'color-mix(in oklab, var(--color-lime) 30%, transparent)'}`,
                  }}
                >
                  {displayMultiplier.toFixed(2)}x
                </p>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Potential: <span className="font-semibold" style={{ color: 'var(--color-lime)' }}>${(betAmount * displayMultiplier).toFixed(2)}</span>
                </p>

                {/* Multiplier Progress Bar */}
                <div className="mt-3 h-2 rounded-full overflow-hidden relative"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative mines-progress-shimmer overflow-hidden"
                    style={{
                      width: `${multiplierProgress * 100}%`,
                      background: displayMultiplier >= 5
                        ? 'linear-gradient(90deg, var(--color-win), var(--color-pending), var(--color-pending))'
                        : 'linear-gradient(90deg, var(--color-win), var(--color-lime))',
                      boxShadow: displayMultiplier >= 5
                        ? '0 0 10px rgba(251,191,36,0.5)'
                        : '0 0 10px color-mix(in oklab, var(--color-lime) 30%, transparent)',
                    }}
                  />
                </div>

                {/* Tiles revealed counter */}
                <div className="flex justify-between mt-2">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{revealed.size} tiles</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{mineCount} mines</span>
                </div>
              </div>
            )}

            {/* Betting Phase Controls */}
            {phase === 'betting' && (
              <>
                {/* Mine Count Selector */}
                <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
                  <p className="text-xs font-medium tracking-wider uppercase mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Mines</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MINE_OPTIONS.map(v => (
                      <button
                        key={v}
                        onClick={() => setMineCount(v)}
                        className="relative py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group"
                        style={mineCount === v
                          ? {
                              background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-loss) 20%, transparent), color-mix(in oklab, var(--color-loss) 8%, transparent))',
                              color: 'var(--color-loss)',
                              border: '1px solid color-mix(in oklab, var(--color-loss) 30%, transparent)',
                              boxShadow: '0 0 15px color-mix(in oklab, var(--color-loss) 10%, transparent)',
                            }
                          : {
                              background: 'rgba(255,255,255,0.03)',
                              color: 'rgba(255,255,255,0.4)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }
                        }
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <BombIcon className="w-3.5 h-3.5" />
                          {v}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bet Amount */}
                <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={phase !== 'betting'} />

{/* Start Button */}
                <button
                  onClick={startGame}
                  disabled={betAmount <= 0 || betAmount > balance}
                  className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-lime), #c2e600)',
                    color: 'var(--color-bg)',
                    boxShadow: '0 0 20px color-mix(in oklab, var(--color-lime) 20%, transparent), 0 4px 15px color-mix(in oklab, var(--color-lime) 15%, transparent)',
                  }}
                >
                  Start Game
                </button>
              </>
            )}

            {/* Cash Out Button (Playing) */}
            {phase === 'playing' && (
              <button
                onClick={cashOut}
                disabled={revealed.size === 0}
                className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={revealed.size > 0
                  ? {
                      background: 'linear-gradient(135deg, var(--color-win), #b8e600)',
                      color: 'var(--color-bg)',
                      boxShadow: '0 0 25px color-mix(in oklab, var(--color-win) 30%, transparent), 0 4px 15px color-mix(in oklab, var(--color-win) 20%, transparent)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.3)',
                    }
                }
              >
                Cash Out ${(betAmount * displayMultiplier).toFixed(2)}
              </button>
            )}

            {/* Play Again Button (Done) */}
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
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 rounded-2xl p-4"
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
                  className="flex items-center justify-between py-2 px-3 rounded-xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider ${
                      h.result === 'win'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {h.result.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {h.mines} mines · {h.picks} picks
                    </span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${h.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                    {h.result === 'win' ? '+' : '-'}${h.payout.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
