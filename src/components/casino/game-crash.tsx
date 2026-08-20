'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RotateCcw, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { GameBetControls, GameBalance, GameHeader } from "@/components/casino/game-shared";
import { originalsAction, placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}


type Phase = 'betting' | 'running' | 'cashed' | 'crashed';

interface HistoryEntry {
  multiplier: number;
  result: string;
  payout: number;
}

/** Deterministic jitter so the shatter looks random but renders stably. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1..1
}

const W = 600;
const H = 280;
const PAD = 40;

export function CrashGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [betAmount, setBetAmount] = useState(5);
  const [autoCashout, setAutoCashout] = useState(2);
  const { balance, setBalance } = useOriginalsSession("crash", { cashOutAt: autoCashout }, betAmount, initialBalance);
  const [phase, setPhase] = useState<Phase>('betting');
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState(0);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showPF, setShowPF] = useState(false);
  const [pfData, setPfData] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [chartPoints, setChartPoints] = useState<Array<{ x: number; y: number }>>([]);

  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(undefined);
  const startTimeRef = useRef(0);
  const currentCrashRef = useRef(0);
  const autoCashoutRef = useRef(autoCashout);
  const cashOutRef = useRef<(() => void) | undefined>(undefined);
  const betAmountRef = useRef(betAmount);
  const roundIdRef = useRef<string | null>(null);

  useEffect(() => { autoCashoutRef.current = autoCashout; }, [autoCashout]);
  useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);

  // Screen-space points — one mapping shared by path, comet trail and shatter.
  const scaled = useMemo(() => {
    if (chartPoints.length < 2) return [];
    const maxX = Math.max(5, chartPoints[chartPoints.length - 1].x);
    const maxY = Math.max(2, ...chartPoints.map(p => p.y)) * 1.15;
    return chartPoints.map(p => ({
      x: PAD + (p.x / maxX) * (W - PAD * 2),
      y: H - PAD - (p.y / maxY) * (H - PAD * 2),
    }));
  }, [chartPoints]);

  const chartPath = useMemo(() => {
    if (scaled.length < 2) return '';
    let d = `M ${scaled[0].x} ${scaled[0].y}`;
    for (let i = 1; i < scaled.length; i++) d += ` L ${scaled[i].x} ${scaled[i].y}`;
    return d;
  }, [scaled]);

  const chartFillPath = useMemo(() => {
    if (!chartPath) return '';
    return chartPath + ` L ${W - PAD} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  }, [chartPath]);

  // Shatter fragments: the curve broken into short segments that fly apart on bust.
  const shatterSegments = useMemo(() => {
    if (scaled.length < 4) return [];
    const segs: string[] = [];
    const step = Math.max(2, Math.floor(scaled.length / 14));
    for (let i = 0; i < scaled.length - 1; i += step) {
      const chunk = scaled.slice(i, i + step + 1);
      if (chunk.length < 2) continue;
      let d = `M ${chunk[0].x} ${chunk[0].y}`;
      for (let j = 1; j < chunk.length; j++) d += ` L ${chunk[j].x} ${chunk[j].y}`;
      segs.push(d);
    }
    return segs;
  }, [scaled]);

  // Axis labels
  const axisLabels = useMemo(() => {
    if (chartPoints.length < 2) return { xLabels: [], yLabels: [] };
    const maxX = Math.max(5, chartPoints[chartPoints.length - 1].x);
    const maxY = Math.max(2, ...chartPoints.map(p => p.y)) * 1.15;
    const xLabels: string[] = [];
    const yLabels: string[] = [];
    const xStep = maxX <= 10 ? 2 : maxX <= 30 ? 5 : 10;
    const yStep = maxY <= 3 ? 0.5 : maxY <= 8 ? 1 : maxY <= 20 ? 2 : 5;
    for (let t = 0; t <= maxX; t += xStep) xLabels.push(t.toFixed(0) + 's');
    for (let m = 0; m <= maxY; m += yStep) yLabels.push(m.toFixed(m < 1 ? 1 : 0) + 'x');
    return { xLabels, yLabels, maxX, maxY };
  }, [chartPoints]);

  const cashOut = useCallback(async () => {
    if (phase !== 'running' || !roundIdRef.current) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const cashMult = Math.floor(multiplier * 100) / 100;
    try {
      const data = await originalsAction('crash', roundIdRef.current, { type: 'cashout', cashOutAt: cashMult });
      const cp = Number((data.payload as { crashPoint?: number })?.crashPoint ?? 0);
      setCrashPoint(cp);
      currentCrashRef.current = cp || cashMult;
      setBalance(data.newBalance);
      setPfData({ serverSeedHash: data.serverSeedHash, clientSeed: data.clientSeed, nonce: data.nonce });
      if (data.won) {
        setPhase('cashed');
        setPayout(data.payout);
        setHistory(prev => [{ multiplier: cashMult, result: 'win', payout: data.payout }, ...prev].slice(0, 10));
      } else {
        setPhase('crashed');
        setMultiplier(cp || cashMult);
        setHistory(prev => [{ multiplier: cp || cashMult, result: 'lose', payout: 0 }, ...prev].slice(0, 10));
      }
    } catch { /* ignore */ }
  }, [phase, multiplier]);

  useEffect(() => { cashOutRef.current = cashOut; }, [cashOut]);

  // Animation loop — rAF owns game-critical timing (do not convert to Framer Motion).
  useEffect(() => {
    if (phase !== 'running') return;
    let frameCount = 0;
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.pow(Math.E, 0.06 * elapsed);
      const mFloor = Math.floor(m * 100) / 100;
      setMultiplier(mFloor);
      // Record chart points every ~3 frames
      if (frameCount % 3 === 0) {
        setChartPoints(prev => {
          const next = [...prev, { x: elapsed, y: mFloor }];
          return next.length > 300 ? next.slice(-300) : next;
        });
      }
      frameCount++;
      if (elapsed > 30 || m >= currentCrashRef.current) {
        setPhase('crashed');
        setMultiplier(Math.min(mFloor, currentCrashRef.current));
        setChartPoints(prev => [...prev, { x: elapsed, y: Math.min(mFloor, currentCrashRef.current) }]);
        if (roundIdRef.current) {
          void originalsAction('crash', roundIdRef.current, { type: 'bust' }).then((data) => {
            const cp = Number((data.payload as { crashPoint?: number })?.crashPoint ?? mFloor);
            setCrashPoint(cp);
            setMultiplier(cp);
            setBalance(data.newBalance);
            setHistory(prev => [{ multiplier: cp, result: 'lose', payout: 0 }, ...prev].slice(0, 10));
          }).catch(() => {});
        }
        return;
      }
      if (autoCashoutRef.current > 0 && m >= autoCashoutRef.current) {
        cashOutRef.current?.();
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase]);

  const startGame = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance) return;
    setMultiplier(1);
    setPayout(0);
    setCrashPoint(0);
    setChartPoints([{ x: 0, y: 1 }]);
    setPhase('running');
    startTimeRef.current = Date.now();
    currentCrashRef.current = 1000;
    roundIdRef.current = null;
    try {
      const data = await placeOriginalsBet('crash', betAmount, { cashOutAt: autoCashout }, 'start');
      roundIdRef.current = data.roundId ?? null;
      setBalance(data.newBalance);
      setPfData({ serverSeedHash: data.serverSeedHash, clientSeed: data.clientSeed, nonce: data.nonce });
      if (!data.pending) {
        const serverCp = Number((data.payload as { crashPoint?: number })?.crashPoint ?? 1);
        setCrashPoint(serverCp);
        currentCrashRef.current = serverCp;
        if (serverCp <= 1) {
          setMultiplier(1);
          setPhase('crashed');
          setHistory(prev => [{ multiplier: 1, result: 'lose', payout: 0 }, ...prev].slice(0, 10));
        }
      }
    } catch {
      setPhase('betting');
    }
  }, [betAmount, balance, autoCashout]);

  const reset = useCallback(() => {
    setPhase('betting');
    setMultiplier(1);
    setPayout(0);
    setCrashPoint(0);
    setChartPoints([]);
  }, []);

  const potentialPayout = useMemo(() => (betAmount * multiplier).toFixed(2), [betAmount, multiplier]);

  const lineColor = phase === 'crashed' ? 'var(--loss)' : 'var(--color-lime)';
  const gradId = phase === 'crashed' ? 'crashGradLoss' : 'crashGradLime';

  // Multiplier readout scales with value (log growth, capped) — driven by the
  // same per-frame state the rAF loop already writes, so no extra work.
  const multScale = reduced ? 1 : 1 + Math.min(0.4, Math.log10(Math.max(multiplier, 1)) * 0.45);

  // Grid parallax: rows drift downward as the multiplier climbs; modulo the row
  // spacing so the wrap is seamless.
  const rowSpace = (H - 80) / ((axisLabels.yLabels?.length || 3) + 1);
  const gridShift = reduced ? 0 : (Math.log(Math.max(multiplier, 1)) * 26) % rowSpace;

  const trail = phase === 'running' ? scaled.slice(-10) : [];
  const head = scaled.length > 1 ? scaled[scaled.length - 1] : null;

  return (
    <div className="space-y-4">
      
      <GameHeader title="Crash" subtitle="Watch the multiplier rise — cash out before it crashes!" onBack={onBack} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Chart Area */}
        <div className="lg:col-span-3">
          <div
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br from-surface to-surface-raised transition-colors ${
              phase === 'running' ? 'border-lime/20' : 'border-border/40'
            } ${!reduced && phase === 'crashed' ? 'game-shake game-flash-red' : ''} ${!reduced && phase === 'cashed' ? 'game-flash-lime' : ''}`}
            style={{ minHeight: 320 }}
          >
            {/* Particles (capped well under 50; disabled for reduced motion) */}
            {phase === 'running' && !reduced && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="game-particle"
                    style={{
                      left: `${(i * 5.2 + 2) % 100}%`,
                      bottom: 0,
                      width: `${3 + (i % 3)}px`,
                      height: `${3 + (i % 3)}px`,
                      background: i % 2 === 0 ? 'var(--color-lime)' : 'var(--lime-200)',
                      opacity: 0.7,
                      animationDuration: `${2 + (i % 4) * 0.7}s`,
                      animationDelay: `${(i * 0.3) % 3}s`,
                      '--dx': `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 8)}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            )}

            {/* Multiplier Overlay */}
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className={phase === 'running' && !reduced ? 'game-pulse' : ''} style={{ transform: `scale(${multScale})`, transition: 'transform 120ms linear' }}>
                <div
                  className={`font-mono text-6xl font-black tabular-nums sm:text-7xl ${
                    phase === 'running' || phase === 'cashed' ? 'glow-lime text-lime' : phase === 'crashed' ? 'glow-red text-loss' : 'text-foreground/90'
                  }`}
                  style={{ transition: 'color 0.3s' }}
                >
                  {multiplier.toFixed(2)}x
                </div>
              </div>
              {phase === 'crashed' && <p className="mt-2 text-sm font-bold uppercase tracking-widest text-loss">Crashed!</p>}
              {phase === 'cashed' && (
                <div className="relative">
                  <p className="mt-2 text-sm font-bold tracking-wide text-win">CASHED OUT!</p>
                  <span className={`absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-lg font-black tabular-nums text-win ${reduced ? '' : 'game-float-win'}`}>
                    +${payout.toFixed(2)}
                  </span>
                </div>
              )}
              {phase === 'betting' && <p className="mt-2 text-sm text-muted-foreground/60">Place your bet to start</p>}
            </div>

            {/* SVG Chart */}
            <div className="w-full" style={{ height: 320 }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="crashGradLime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-lime)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-lime)" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="crashGradLoss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--loss)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.02" />
                  </linearGradient>
                  <filter id="glowLine">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Grid — parallax drift while the multiplier climbs */}
                <g className="chart-grid" style={{ transform: `translateY(${gridShift}px)` }}>
                  {axisLabels.yLabels?.map((_, i) => {
                    const y = H - PAD - ((i + 1) / (axisLabels.yLabels.length + 1)) * (H - 80);
                    return <line key={`h${i}`} x1={PAD} y1={y} x2={W - PAD} y2={y} />;
                  })}
                  {axisLabels.xLabels?.map((_, i) => {
                    const x = PAD + ((i + 1) / (axisLabels.xLabels.length + 1)) * (W - PAD * 2);
                    return <line key={`v${i}`} x1={x} y1={PAD} x2={x} y2={H - PAD} />;
                  })}
                </g>
                {/* Axis labels */}
                <g className="chart-axis">
                  {axisLabels.xLabels?.map((label, i) => {
                    const x = PAD + ((i + 1) / (axisLabels.xLabels.length + 1)) * (W - PAD * 2);
                    return <text key={`x-${i}`} x={x} y={H - 10} textAnchor="middle">{label}</text>;
                  })}
                  {axisLabels.yLabels?.map((label, i) => {
                    const y = H - PAD - ((i + 1) / (axisLabels.yLabels.length + 1)) * (H - 80);
                    return <text key={`y-${i}`} x={PAD - 5} y={y + 3} textAnchor="end">{label}</text>;
                  })}
                </g>
                {/* Axis lines */}
                <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

                {/* Curve shatter on bust */}
                {phase === 'crashed' && !reduced && shatterSegments.length > 0 ? (
                  <g>
                    {shatterSegments.map((d, i) => (
                      <motion.path
                        key={`${d.length}-${i}`}
                        d={d}
                        fill="none"
                        stroke="var(--loss)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                        animate={{
                          opacity: 0,
                          x: jitter(i, 1) * 46,
                          y: 24 + Math.abs(jitter(i, 2)) * 70,
                          rotate: jitter(i, 3) * 32,
                        }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.012 }}
                      />
                    ))}
                  </g>
                ) : (
                  <>
                    {/* Area fill under the curve */}
                    {chartFillPath && <path d={chartFillPath} fill={`url(#${gradId})`} />}
                    {/* Curve with animated glow */}
                    {chartPath && (
                      <path d={chartPath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" filter={reduced ? undefined : 'url(#glowLine)'} />
                    )}
                  </>
                )}

                {/* Comet head + motion trail */}
                {phase === 'running' && head && (
                  <g>
                    {!reduced && trail.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={1 + (i / trail.length) * 3.2}
                        fill="var(--color-lime)"
                        opacity={0.06 + (i / trail.length) * 0.32}
                      />
                    ))}
                    <circle cx={head.x} cy={head.y} r={4.5} fill="var(--color-lime)" style={{ filter: 'drop-shadow(0 0 8px var(--color-lime))' }} />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Crash History Badges */}
          {history.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">History:</span>
              <AnimatePresence initial={false}>
                {history.map((h, i) => {
                  const cls = h.multiplier < 2
                    ? 'text-loss bg-loss/10 border-loss/20'
                    : h.multiplier < 5
                      ? 'text-pending bg-pending/10 border-pending/20'
                      : 'text-win bg-win/10 border-win/20';
                  return (
                    <motion.span
                      key={`${h.multiplier}-${i}-${history.length}`}
                      initial={reduced ? false : { opacity: 0, scale: 0.8, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={`rounded-md border px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${cls}`}
                    >
                      {h.multiplier.toFixed(2)}x
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Provably Fair */}
          <div className="mt-3 overflow-hidden rounded-xl border border-border/40 bg-surface">
            <button onClick={() => setShowPF(v => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/30">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-lime" />
                <span className="text-sm font-semibold text-foreground/70">Provably Fair</span>
              </div>
              {showPF ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {showPF && (
              <div className="space-y-2 border-t border-border/30 px-4 pb-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Server Seed Hash</span>
                  <span className="font-mono text-xs text-foreground/60">{pfData ? pfData.serverSeedHash.slice(0, 20) + '...' : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Client Seed</span>
                  <span className="font-mono text-xs text-foreground/60">{pfData ? pfData.clientSeed : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Nonce</span>
                  <span className="font-mono text-xs text-foreground/60">{pfData ? pfData.nonce : '—'}</span>
                </div>
                <button className="btn-press mt-1 w-full rounded-lg border border-lime/15 bg-lime/10 py-2 text-xs font-semibold uppercase tracking-wide text-lime transition-colors hover:bg-lime/20">
                  Verify
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="space-y-3">
          {/* Balance — posted-tick signature */}
          <GameBalance value={balance} />

          {/* Current Multiplier / Potential Payout */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-surface p-3">
              <p className="text-xs text-muted-foreground">Multiplier</p>
              <p className="font-mono text-lg font-bold tabular-nums text-foreground">{multiplier.toFixed(2)}x</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface p-3">
              <p className="text-xs text-muted-foreground">Payout</p>
              <p className="font-mono text-lg font-bold tabular-nums text-lime">${potentialPayout}</p>
            </div>
          </div>

          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={phase === 'running'} />

          {/* Auto Cashout */}
          <div className="rounded-xl border border-border/40 bg-surface p-4">
            <p className="mb-2 text-xs text-muted-foreground">Auto Cashout</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={autoCashout}
                onChange={e => setAutoCashout(Math.max(1.01, Number(e.target.value)))}
                step="0.1"
                className="flex-1 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 font-mono text-sm font-medium tabular-nums text-foreground outline-none focus:border-lime/40"
                disabled={phase === 'running'}
              />
              <span className="text-xs font-bold text-muted-foreground">×</span>
            </div>
          </div>

          {/* Action Button */}
          {phase === 'running' ? (
            <motion.button
              onClick={cashOut}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              className="g-btn g-btn-play cashout"
            >
              Cash Out ${potentialPayout}
            </motion.button>
          ) : (phase === 'crashed' || phase === 'cashed') ? (
            <button onClick={reset} className="g-btn g-btn-secondary">
              <RotateCcw className="w-4 h-4" /> Bet Again
            </button>
          ) : (
            <motion.button
              onClick={startGame}
              disabled={betAmount <= 0 || betAmount > balance}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              className="g-btn g-btn-play"
            >
              Place Bet
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
