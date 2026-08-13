'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";

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

/* ── Neon + Glass constants ── */
const NEON = {
  lime: '0 0 12px rgba(204,255,0,0.4), 0 0 40px rgba(204,255,0,0.1)',
  win: '0 0 16px rgba(0,255,102,0.5), 0 0 50px rgba(0,255,102,0.12)',
  loss: '0 0 16px rgba(255,51,102,0.5), 0 0 50px rgba(255,51,102,0.12)',
};
const GLASS = {
  panel: { background: 'rgba(22,22,26,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' } as React.CSSProperties,
};

/** Deterministic jitter for shatter animation */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const W = 600;
const H = 280;
const PAD = 40;

export function CrashGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(5);
  const [autoCashout, setAutoCashout] = useState(2);
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

  useEffect(() => { autoCashoutRef.current = autoCashout; }, [autoCashout]);
  useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);

  // Screen-space points
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

  // Shatter segments for crash animation
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
    if (chartPoints.length < 2) return { xLabels: [] as string[], yLabels: [] as string[] };
    const maxX = Math.max(5, chartPoints[chartPoints.length - 1].x);
    const maxY = Math.max(2, ...chartPoints.map(p => p.y)) * 1.15;
    const xLabels: string[] = [];
    for (let i = 0; i <= 4; i++) xLabels.push((maxX * i / 4).toFixed(1) + 's');
    const yLabels: string[] = [];
    for (let i = 0; i <= 3; i++) yLabels.push((maxY * i / 3).toFixed(2) + '×');
    return { xLabels, yLabels };
  }, [chartPoints]);

  /* ── Cash out (PRESERVED) ── */
  const cashOut = useCallback(() => {
    if (phase !== 'running') return;
    const p = betAmountRef.current * multiplier;
    setPayout(p);
    setPhase('cashed');
    setBalance(prev => prev + p);
    setHistory(prev => [{ multiplier, result: 'cashed', payout: p }, ...prev].slice(0, 20));
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, [phase, multiplier]);

  useEffect(() => { cashOutRef.current = cashOut; }, [cashOut]);

  /* ── Start game (PRESERVED — all API logic intact) ── */
  const startGame = useCallback(async () => {
    if (phase !== 'betting' || betAmount <= 0 || betAmount > balance) return;
    setBalance(prev => prev - betAmount);
    setPhase('running');
    setMultiplier(1);
    setPayout(0);
    setChartPoints([{ x: 0, y: 1 }]);

    try {
      const res = await fetch('/api/bets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'crash', amount: betAmount, payload: { autoCashout } }) });
      const data = await res.json();
      if (data.success) {
        const cp = data.data.payload.crashPoint;
        currentCrashRef.current = cp;
        setCrashPoint(cp);
        setBalance(data.data.newBalance + betAmount); // will be subtracted by animation
        setPfData({ serverSeedHash: data.data.serverSeedHash, clientSeed: data.data.clientSeed, nonce: data.data.nonce });

        // Animate multiplier
        startTimeRef.current = performance.now();
        const animate = (now: number) => {
          const elapsed = (now - startTimeRef.current) / 1000;
          const m = Math.pow(Math.E, 0.05 * elapsed * elapsed);
          if (m >= cp) {
            setMultiplier(cp);
            setChartPoints(prev => [...prev, { x: elapsed, y: cp }]);
            setPhase('crashed');
            setHistory(prev => [{ multiplier: cp, result: 'crashed', payout: 0 }, ...prev].slice(0, 20));
            return;
          }
          // Auto cashout
          if (autoCashoutRef.current > 0 && m >= autoCashoutRef.current) {
            cashOutRef.current?.();
            return;
          }
          setMultiplier(m);
          setChartPoints(prev => [...prev, { x: elapsed, y: m }]);
          animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
      } else {
        setPhase('betting');
        setBalance(prev => prev + betAmount);
      }
    } catch {
      setPhase('betting');
      setBalance(prev => prev + betAmount);
    }
  }, [phase, betAmount, balance, autoCashout]);

  const reset = useCallback(() => {
    setPhase('betting');
    setMultiplier(1);
    setCrashPoint(0);
    setPayout(0);
    setChartPoints([]);
  }, []);

  // Chart glow color
  const chartColor = phase === 'crashed' ? '#ff3366' : phase === 'cashed' ? '#00ff66' : '#ccff00';
  const chartGlow = phase === 'crashed' ? 'rgba(255,51,102,0.6)' : phase === 'cashed' ? 'rgba(0,255,102,0.6)' : 'rgba(204,255,0,0.5)';

  return (
    <div className="game-wrapper compact-game">
      {/* Header */}
      <div className="g-header" style={{ ...GLASS.panel, padding: '12px 16px', marginBottom: '12px' }}>
        <button onClick={onBack} className="g-back group" aria-label="Back"><ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /></button>
        <div>
          <h1 className="text-base font-display font-bold text-white">Crash</h1>
          <p className="text-xs text-white/50">Cash out before it crashes</p>
        </div>
      </div>

      <div className="game-grid">
        {/* === CHART AREA === */}
        <div className="space-y-3">
          <div className="relative" style={{ ...GLASS.panel, padding: '16px', boxShadow: phase === 'crashed' ? NEON.loss : phase === 'cashed' ? NEON.win : 'none', transition: 'box-shadow 0.4s ease' }}>
            {/* Multiplier Display */}
            <div className="text-center mb-3">
              <motion.div
                className="text-4xl font-mono font-black tabular-nums"
                style={{ color: chartColor, textShadow: `0 0 20px ${chartGlow}` }}
                animate={phase === 'crashed' && !reduced ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {multiplier.toFixed(2)}×
              </motion.div>
              <AnimatePresence>
                {phase === 'cashed' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-1">
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(0,255,102,0.12)', color: '#00ff66', border: '1px solid rgba(0,255,102,0.3)' }}>
                      +${payout.toFixed(2)}
                    </span>
                  </motion.div>
                )}
                {phase === 'crashed' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-1">
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,51,102,0.12)', color: '#ff3366', border: '1px solid rgba(255,51,102,0.3)' }}>
                      CRASHED @ {crashPoint.toFixed(2)}×
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SVG Chart — neon glow line */}
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'clamp(160px, 30vw, 240px)' }}>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1={PAD} y1={H - PAD - f * (H - PAD * 2)} x2={W - PAD} y2={H - PAD - f * (H - PAD * 2)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

              {/* Fill area with gradient */}
              {chartFillPath && phase !== 'crashed' && (
                <path d={chartFillPath} fill={phase === 'cashed' ? 'rgba(0,255,102,0.06)' : 'rgba(204,255,0,0.04)'} />
              )}

              {/* Main curve — neon glow via filter */}
              {phase !== 'crashed' && chartPath && (
                <>
                  <path d={chartPath} fill="none" stroke={chartColor} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${chartGlow})` }} />
                  {/* Comet head */}
                  {scaled.length > 1 && phase === 'running' && (
                    <circle cx={scaled[scaled.length - 1].x} cy={scaled[scaled.length - 1].y} r="5" fill={chartColor} style={{ filter: `drop-shadow(0 0 10px ${chartGlow})` }}>
                      {!reduced && <animate attributeName="r" values="4;6;4" dur="0.8s" repeatCount="indefinite" />}
                    </circle>
                  )}
                </>
              )}

              {/* Shatter on crash */}
              {phase === 'crashed' && shatterSegments.map((seg, i) => (
                <motion.path
                  key={i}
                  d={seg}
                  fill="none"
                  stroke="#ff3366"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ opacity: 1, x: 0, y: 0 }}
                  animate={reduced ? { opacity: 0 } : { opacity: 0, x: jitter(i, 1) * 40, y: jitter(i, 2) * 30 + 20 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ filter: 'drop-shadow(0 0 4px rgba(255,51,102,0.6))' }}
                />
              ))}

              {/* Axis labels */}
              {axisLabels.xLabels.map((l, i) => (
                <text key={`x-${i}`} x={PAD + i * (W - PAD * 2) / 4} y={H - 10} fill="rgba(255,255,255,0.25)" fontSize="10" textAnchor="middle" fontFamily="monospace">{l}</text>
              ))}
              {axisLabels.yLabels.map((l, i) => (
                <text key={`y-${i}`} x={PAD - 8} y={H - PAD - i * (H - PAD * 2) / 3 + 4} fill="rgba(255,255,255,0.25)" fontSize="10" textAnchor="end" fontFamily="monospace">{l}</text>
              ))}
            </svg>
          </div>

          {/* History badges — neon pills */}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-white/40">History:</span>
              {history.slice(0, 12).map((h, i) => {
                const style: React.CSSProperties = h.multiplier < 2
                  ? { background: 'rgba(255,51,102,0.1)', color: '#ff3366', border: '1px solid rgba(255,51,102,0.25)', boxShadow: '0 0 6px rgba(255,51,102,0.15)' }
                  : h.multiplier < 5
                    ? { background: 'rgba(255,181,46,0.1)', color: '#ffb52e', border: '1px solid rgba(255,181,46,0.25)', boxShadow: '0 0 6px rgba(255,181,46,0.15)' }
                    : { background: 'rgba(204,255,0,0.1)', color: '#ccff00', border: '1px solid rgba(204,255,0,0.3)', boxShadow: '0 0 8px rgba(204,255,0,0.2)' };
                return (
                  <motion.span
                    key={i}
                    initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums"
                    style={style}
                  >
                    {h.multiplier.toFixed(2)}×
                  </motion.span>
                );
              })}
            </div>
          )}

          {/* Provably Fair */}
          <div style={{ ...GLASS.panel, overflow: 'hidden' }}>
            <button onClick={() => setShowPF(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: '#ccff00', filter: 'drop-shadow(0 0 4px rgba(204,255,0,0.4))' }} />
                <span className="text-xs font-semibold text-white/60">Provably Fair</span>
              </div>
              {showPF ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            {showPF && (
              <div className="px-4 pb-3 pt-2 space-y-2 border-t border-white/[0.04]">
                <div className="flex justify-between"><span className="text-[11px] text-white/40">Server Seed Hash</span><span className="text-[11px] font-mono text-white/55">{pfData ? pfData.serverSeedHash.slice(0, 20) + '...' : '—'}</span></div>
                <div className="flex justify-between"><span className="text-[11px] text-white/40">Client Seed</span><span className="text-[11px] font-mono text-white/55">{pfData ? pfData.clientSeed : '—'}</span></div>
                <div className="flex justify-between"><span className="text-[11px] text-white/40">Nonce</span><span className="text-[11px] font-mono text-white/55">{pfData ? pfData.nonce : '—'}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* === CONTROLS PANEL === */}
        <div className="space-y-3">
          {/* Balance */}
          <div style={{ ...GLASS.panel, padding: '14px 16px' }}>
            <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="text-xl font-black font-mono tabular-nums" style={{ color: '#ccff00', textShadow: '0 0 10px rgba(204,255,0,0.3)' }} />
          </div>

          {/* Bet Controls */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={phase !== 'betting'} />

          {/* Auto Cashout */}
          <div style={{ ...GLASS.panel, padding: '12px 14px' }}>
            <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-2">Auto Cashout</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={autoCashout}
                onChange={(e) => setAutoCashout(Math.max(1.01, Number(e.target.value)))}
                step="0.1"
                min="1.01"
                disabled={phase !== 'betting'}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-mono font-bold bg-[rgba(15,16,21,0.8)] text-white/90 border border-white/[0.08] focus:border-[rgba(204,255,0,0.3)] focus:outline-none transition-colors"
              />
              <span className="text-sm font-bold text-white/50">×</span>
            </div>
          </div>

          {/* Action Buttons */}
          {phase === 'betting' && (
            <motion.button
              onClick={startGame}
              disabled={betAmount <= 0 || betAmount > balance}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              className="w-full py-4 rounded-xl text-base font-black uppercase tracking-wide transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #ccff00, #a8e600)', color: '#0f1015', boxShadow: betAmount <= 0 || betAmount > balance ? 'none' : NEON.lime }}
            >
              Place Bet
            </motion.button>
          )}
          {phase === 'running' && (
            <motion.button
              onClick={cashOut}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              animate={reduced ? {} : { boxShadow: ['0 0 12px rgba(0,255,102,0.4)', '0 0 24px rgba(0,255,102,0.6)', '0 0 12px rgba(0,255,102,0.4)'] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-full py-4 rounded-xl text-base font-black uppercase tracking-wide"
              style={{ background: 'linear-gradient(135deg, #00ff66, #00cc52)', color: '#0f1015' }}
            >
              Cash Out @ {multiplier.toFixed(2)}×
            </motion.button>
          )}
          {(phase === 'crashed' || phase === 'cashed') && (
            <button
              onClick={reset}
              className="w-full py-4 rounded-xl text-base font-bold uppercase tracking-wide transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              New Round
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
