'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import { originalsAction, placeOriginalsBet } from "@/lib/originals-client";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface CrashPayload {
  crashPoint?: number;
}

type Phase = 'betting' | 'running' | 'cashed' | 'crashed';

interface HistoryEntry {
  multiplier: number;
  result: string;
  payout: number;
}

function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const W = 600;
const H = 280;
const PAD = 40;

export function CrashGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history: histHistory, fairness, profit, betCount, place } = useBet<CrashPayload>("crash", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);

  const [phase, setPhase] = useState<Phase>('betting');
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState(0);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoCashout, setAutoCashout] = useState(2);
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
  useEffect(() => { return () => { if (animRef.current) cancelAnimationFrame(animRef.current); }; }, []);

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

  const axisLabels = useMemo(() => {
    if (chartPoints.length < 2) return { xLabels: [], yLabels: [], maxX: 10, maxY: 5 };
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
      const cp = Number((data.payload as CrashPayload)?.crashPoint ?? 0);
      setCrashPoint(cp);
      currentCrashRef.current = cp || cashMult;
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

  // Animation loop
  useEffect(() => {
    if (phase !== 'running') return;
    let frameCount = 0;
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.pow(Math.E, 0.06 * elapsed);
      const mFloor = Math.floor(m * 100) / 100;
      setMultiplier(mFloor);
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
            const cp = Number((data.payload as CrashPayload)?.crashPoint ?? mFloor);
            setCrashPoint(cp);
            setMultiplier(cp);
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
      if (!data.pending) {
        const serverCp = Number((data.payload as CrashPayload)?.crashPoint ?? 1);
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
  const multScale = skipAnim ? 1 : 1 + Math.min(0.4, Math.log10(Math.max(multiplier, 1)) * 0.45);
  const rowSpace = (H - 80) / ((axisLabels.yLabels?.length || 3) + 1);
  const gridShift = skipAnim ? 0 : (Math.log(Math.max(multiplier, 1)) * 26) % rowSpace;
  const trail = phase === 'running' ? scaled.slice(-10) : [];
  const head = scaled.length > 1 ? scaled[scaled.length - 1] : null;

  return (
    <GameFrame
      gameId="crash"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={histHistory}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={phase === 'running' || busy}
          action={
            phase === 'running' ? (
              <BetButton onClick={cashOut} tone="danger">
                Cash Out ${potentialPayout}
              </BetButton>
            ) : (phase === 'crashed' || phase === 'cashed') ? (
              <BetButton onClick={reset}>Bet Again</BetButton>
            ) : (
              <BetButton onClick={startGame} disabled={betAmount <= 0 || betAmount > balance || busy} busy={busy}>
                Place Bet
              </BetButton>
            )
          }
        >
          <StatRow label="Multiplier" value={`${multiplier.toFixed(2)}×`} />
          <StatRow label="Payout" value={`$${potentialPayout}`} tone="lime" />
          <div className="tols-field">
            <label>Auto Cashout</label>
            <input
              type="number"
              value={autoCashout}
              onChange={e => setAutoCashout(Math.max(1.01, Number(e.target.value)))}
              step="0.1"
              className="tols-input font-mono"
              disabled={phase === 'running'}
            />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className={`crash ${!skipAnim && phase === 'crashed' ? 'game-shake game-flash-red' : ''} ${!skipAnim && phase === 'cashed' ? 'game-flash-lime' : ''}`}>
        {/* SVG Chart */}
        <svg viewBox={`0 0 ${W} ${H}`} className="crash__chart" preserveAspectRatio="xMidYMid meet">
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
          {/* Grid */}
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
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

          {phase === 'crashed' && !skipAnim && shatterSegments.length > 0 ? (
            <g>
              {shatterSegments.map((d, i) => (
                <motion.path key={`${d.length}-${i}`} d={d} fill="none" stroke="var(--loss)" strokeWidth={2.5} strokeLinecap="round"
                  initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  animate={{ opacity: 0, x: jitter(i, 1) * 46, y: 24 + Math.abs(jitter(i, 2)) * 70, rotate: jitter(i, 3) * 32 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.012 }}
                />
              ))}
            </g>
          ) : (
            <>
              {chartFillPath && <path d={chartFillPath} fill={`url(#${gradId})`} />}
              {chartPath && (
                <path d={chartPath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  filter={skipAnim ? undefined : 'url(#glowLine)'}
                />
              )}
            </>
          )}

          {phase === 'running' && head && (
            <g>
              {!skipAnim && trail.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1 + (i / trail.length) * 3.2} fill="var(--color-lime)" opacity={0.06 + (i / trail.length) * 0.32} />
              ))}
              <circle cx={head.x} cy={head.y} r={4.5} fill="var(--color-lime)" style={{ filter: 'drop-shadow(0 0 8px var(--color-lime))' }} />
            </g>
          )}
        </svg>

        {/* Multiplier Overlay */}
        <div className="crash__readout">
          <div style={{ transform: `scale(${multScale})`, transition: 'transform 120ms linear' }}>
            <div className={`crash__value font-mono ${phase === 'running' || phase === 'cashed' ? 'glow-lime text-lime' : phase === 'crashed' ? 'glow-red text-loss' : 'text-foreground/90'}`}
              data-state={phase === 'running' || phase === 'cashed' ? 'win' : phase === 'crashed' ? 'loss' : undefined}
            >
              {multiplier.toFixed(2)}x
            </div>
          </div>
          {phase === 'crashed' && <p className="crash__verdict" data-won={false}>Crashed!</p>}
          {phase === 'cashed' && (
            <p className="crash__verdict text-win" data-won>
              Cashed Out! +${payout.toFixed(2)}
            </p>
          )}
          {phase === 'betting' && <p className="crash__verdict">Place your bet to start</p>}
        </div>
      </div>

      {/* History badges */}
      {history.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">History:</span>
          <AnimatePresence initial={false}>
            {history.map((h, i) => {
              const cls = h.multiplier < 2
                ? 'game-history-badge-low' : h.multiplier < 5
                  ? 'game-history-badge-mid' : 'game-history-badge-high';
              return (
                <motion.span key={`${h.multiplier}-${i}`}
                  initial={skipAnim ? false : { opacity: 0, scale: 0.8, y: -6 }}
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
    </GameFrame>
  );
}
