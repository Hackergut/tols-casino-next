'use client';

/*
 * European Roulette — original clean-room implementation (no third-party game
 * code). The wheel is presentation only: the server (POST /api/bets,
 * game:"roulette") picks the winning pocket and settles every bet at the real
 * single-zero payout (97.3% RTP). The wheel animates to that number.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import { GameBalance, GameHeader } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props {
  onBack: () => void;
  initialBalance: number;
}

const CHIPS = [1, 5, 10, 25, 100];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function numColor(n: number): string {
  if (n === 0) return '#cdf32b';
  return RED.has(n) ? '#e33b26' : '#141412';
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/* ── Wheel canvas ── */
export interface RouletteHandle {
  spin: (winning: number) => Promise<void>;
}

const RouletteWheel = forwardRef<RouletteHandle, unknown>(function RouletteWheel(_p, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0);
  const ballRef = useRef({ angle: -Math.PI / 2, radius: 0 });
  const rafRef = useRef<number | null>(null);
  // Rendered at 2x the CSS size for crisp edges on retina displays.
  const SIZE = 520;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUTER = 244;
  const R_POCKET = 203;
  const R_HUB = 107;
  const PA = (Math.PI * 2) / 37;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rot = rotRef.current;
    // Backing store is DPR-scaled; keep drawing in the 0..SIZE coordinate space.
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Outer rim
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUTER + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1015';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(205,243,43,0.35)';
    ctx.stroke();

    // Pockets
    for (let i = 0; i < 37; i++) {
      const n = WHEEL_ORDER[i];
      const a0 = i * PA + rot - Math.PI / 2 - PA / 2;
      const a1 = a0 + PA;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R_OUTER, a0, a1);
      ctx.closePath();
      ctx.fillStyle = numColor(n);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();

      // number
      const mid = (a0 + a1) / 2;
      ctx.save();
      ctx.translate(CX + Math.cos(mid) * (R_POCKET + 20), CY + Math.sin(mid) * (R_POCKET + 20));
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = '700 17px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }

    // Inner hub
    ctx.beginPath();
    ctx.arc(CX, CY, R_HUB, 0, Math.PI * 2);
    const hub = ctx.createRadialGradient(CX, CY - 20, 10, CX, CY, R_HUB);
    hub.addColorStop(0, '#1e1e1b');
    hub.addColorStop(1, '#0f1015');
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(205,243,43,0.25)';
    ctx.stroke();
    ctx.fillStyle = '#cdf32b';
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TOLS', CX, CY);

    // Ball
    const b = ballRef.current;
    const bx = CX + Math.cos(b.angle) * b.radius;
    const by = CY + Math.sin(b.angle) * b.radius;
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(bx - 3, by - 3, 1.5, bx, by, 10);
    bg.addColorStop(0, '#f4ff9a');
    bg.addColorStop(1, '#cdf32b');
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Top pointer
    ctx.beginPath();
    ctx.moveTo(CX, CY - R_OUTER - 16);
    ctx.lineTo(CX - 12, CY - R_OUTER - 34);
    ctx.lineTo(CX + 12, CY - R_OUTER - 34);
    ctx.closePath();
    ctx.fillStyle = '#cdf32b';
    ctx.fill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
      canvas.style.aspectRatio = '1 / 1';
    }
    ballRef.current = { angle: -Math.PI / 2, radius: R_POCKET };
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useImperativeHandle(
    ref,
    () => ({
      spin: (winning: number) =>
        new Promise<void>((resolve) => {
          const idx = WHEEL_ORDER.indexOf(winning);
          const startRot = rotRef.current % (Math.PI * 2);
          // Rotate so winning pocket ends at the top pointer.
          const targetRot = -(idx * PA) + Math.PI * 2 * 6; // 6 full turns
          const startBallAngle = -Math.PI / 2;
          const ballTurns = Math.PI * 2 * 9; // ball orbits 9 times (opposite feel)
          const duration = 4200;
          const start = performance.now();

          const tick = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            const e = easeOutQuart(t);
            rotRef.current = startRot + (targetRot - startRot) * e;
            // Ball eases from (top − 9 turns) back to the top pointer, dropping inward.
            ballRef.current.angle = startBallAngle - ballTurns * (1 - e);
            ballRef.current.radius = R_OUTER - 12 - (R_OUTER - 12 - (R_POCKET - 2)) * e;
            draw();
            if (t < 1) {
              rafRef.current = requestAnimationFrame(tick);
            } else {
              rotRef.current = targetRot % (Math.PI * 2);
              ballRef.current = { angle: -Math.PI / 2, radius: R_POCKET - 2 };
              draw();
              rafRef.current = null;
              setTimeout(resolve, 250);
            }
          };
          rafRef.current = requestAnimationFrame(tick);
        }),
    }),
    [draw],
  );

  return <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: 460, display: 'block', margin: '0 auto' }} />;
});

/* ── Bet helpers ── */
type Bet = { type: string; value?: number; amount: number };
const betKey = (type: string, value?: number) => (value === undefined ? type : `${type}:${value}`);

const OUTSIDE: { key: string; label: string; type: string }[] = [
  { key: 'low', label: '1-18', type: 'low' },
  { key: 'even', label: 'EVEN', type: 'even' },
  { key: 'red', label: 'RED', type: 'red' },
  { key: 'black', label: 'BLACK', type: 'black' },
  { key: 'odd', label: 'ODD', type: 'odd' },
  { key: 'high', label: '19-36', type: 'high' },
];
const DOZENS = [
  { key: 'dozen1', label: '1st 12', type: 'dozen1' },
  { key: 'dozen2', label: '2nd 12', type: 'dozen2' },
  { key: 'dozen3', label: '3rd 12', type: 'dozen3' },
];
const COLUMNS = [
  { key: 'col3', label: '2:1', type: 'col3' },
  { key: 'col2', label: '2:1', type: 'col2' },
  { key: 'col1', label: '2:1', type: 'col1' },
];

export function RouletteGame({ onBack, initialBalance }: Props) {
  const [chip, setChip] = useState(5);
  const [bets, setBets] = useState<Map<string, Bet>>(new Map());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<null | { winning: number; won: boolean; payout: number }>(null);
  const [history, setHistory] = useState<Array<{ winning: number; result: string; payout: number }>>([]);
  const wheelRef = useRef<RouletteHandle | null>(null);

  const betList = Array.from(bets.values());
  const totalStaked = betList.reduce((s, b) => s + b.amount, 0);
  const { balance, setBalance } = useOriginalsSession(
    "roulette",
    betList.length ? { bets: betList } : { color: "red" },
    totalStaked || chip,
    initialBalance,
  );

  const placeBet = useCallback((type: string, value?: number) => {
    if (spinning) return;
    setResult(null);
    setBets((prev) => {
      const next = new Map(prev);
      const k = betKey(type, value);
      const cur = next.get(k);
      next.set(k, { type, value, amount: (cur?.amount ?? 0) + chip });
      return next;
    });
  }, [chip, spinning]);

  const clearBets = useCallback(() => { if (!spinning) setBets(new Map()); }, [spinning]);

  const spin = useCallback(async () => {
    if (spinning || bets.size === 0 || totalStaked <= 0 || totalStaked > balance) return;
    setSpinning(true);
    setResult(null);
    const betList = Array.from(bets.values());
    try {
      const data = await placeOriginalsBet("roulette", totalStaked, { bets: betList });
      const payload = data.payload as { winning: number };
      await wheelRef.current?.spin(payload.winning);
      setResult({ winning: payload.winning, won: data.won, payout: data.payout });
      setBalance(data.newBalance);
      setHistory((prev) =>
        [{ winning: payload.winning, result: data.won ? 'win' : 'lose', payout: data.payout }, ...prev].slice(0, 12),
      );
    } catch { /* ignore */ }
    setSpinning(false);
  }, [spinning, bets, totalStaked, balance]);

  const chipOn = (type: string, value?: number) => bets.get(betKey(type, value))?.amount ?? 0;

  // Number grid rows (standard table: row1 = 3,6,..36 ; row2 = 2,5,..35 ; row3 = 1,4,..34)
  const gridRows = [
    Array.from({ length: 12 }, (_, i) => 3 + i * 3),
    Array.from({ length: 12 }, (_, i) => 2 + i * 3),
    Array.from({ length: 12 }, (_, i) => 1 + i * 3),
  ];

  return (
    <div className="space-y-6">
      <GameHeader title="Roulette" subtitle="European single-zero — place your bets and spin!" onBack={onBack} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wheel + table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl p-4 flex flex-col items-center" style={{ background: 'var(--color-bg)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <RouletteWheel ref={wheelRef} />
            {result && (
              <div className="mt-3 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-white" style={{ background: numColor(result.winning) }}>
                  {result.winning}
                </span>
                <span className={`text-lg font-bold font-mono ${result.won ? 'text-lime' : 'text-loss'}`}>
                  {result.won ? `+$${result.payout.toFixed(2)}` : `-$${totalStaked.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>

          {/* Betting table */}
          <div className="rounded-xl p-3 overflow-x-auto" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <div className="flex gap-1 min-w-[560px]">
              {/* Zero */}
              <button onClick={() => placeBet('straight', 0)} disabled={spinning}
                className="relative w-10 self-stretch rounded-md text-sm font-black flex items-center justify-center"
                style={{ background: numColor(0), color: '#0f1015' }}>
                0
                {chipOn('straight', 0) > 0 && <Chip amount={chipOn('straight', 0)} />}
              </button>
              {/* Numbers grid */}
              <div className="flex-1 grid grid-rows-3 grid-flow-col gap-1">
                {gridRows.flatMap((row) =>
                  row.map((n) => (
                    <button key={n} onClick={() => placeBet('straight', n)} disabled={spinning}
                      className="relative h-9 min-w-[34px] rounded-md text-white text-xs font-bold flex items-center justify-center transition-transform hover:scale-105"
                      style={{ background: numColor(n) }}>
                      {n}
                      {chipOn('straight', n) > 0 && <Chip amount={chipOn('straight', n)} />}
                    </button>
                  )),
                )}
              </div>
              {/* 2:1 columns — engine types col3 / col2 / col1 match the three table rows */}
              <div className="grid grid-rows-3 gap-1 w-12 shrink-0">
                {COLUMNS.map((c) => (
                  <button key={c.key} onClick={() => placeBet(c.type)} disabled={spinning}
                    className="relative rounded-md text-[10px] font-black text-white/80 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {c.label}
                    {chipOn(c.type) > 0 && <Chip amount={chipOn(c.type)} />}
                  </button>
                ))}
              </div>
            </div>
            {/* Dozens */}
            <div className="grid grid-cols-3 gap-1 mt-1 min-w-[520px]">
              {DOZENS.map((d) => (
                <button key={d.key} onClick={() => placeBet(d.type)} disabled={spinning}
                  className="relative h-8 rounded-md text-[11px] font-bold text-white/80 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {d.label}
                  {chipOn(d.type) > 0 && <Chip amount={chipOn(d.type)} />}
                </button>
              ))}
            </div>
            {/* Even-money */}
            <div className="grid grid-cols-6 gap-1 mt-1 min-w-[520px]">
              {OUTSIDE.map((o) => (
                <button key={o.key} onClick={() => placeBet(o.type)} disabled={spinning}
                  className="relative h-8 rounded-md text-[11px] font-bold flex items-center justify-center"
                  style={{
                    background: o.type === 'red' ? '#e33b26' : o.type === 'black' ? '#141412' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {o.label}
                  {chipOn(o.type) > 0 && <Chip amount={chipOn(o.type)} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <GameBalance value={balance} />

          {/* Chip selector */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Chip Value</p>
            <div className="grid grid-cols-5 gap-1.5">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setChip(c)}
                  className="aspect-square rounded-full text-[10px] font-black transition-all"
                  style={{
                    backgroundImage: 'url(/games/props/chip-heads.jpg)',
                    backgroundSize: 'cover',
                    color: chip === c ? 'var(--color-lime)' : 'rgba(255,255,255,0.7)',
                    opacity: chip === c ? 1 : 0.5,
                    boxShadow: chip === c ? '0 0 14px color-mix(in oklab, var(--color-lime) 40%, transparent)' : 'none',
                    border: chip === c ? '2px solid var(--color-lime)' : '2px solid transparent',
                    textShadow: '0 1px 3px #000',
                  }}>
                  ${c}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total staked</span>
              <span className="font-bold text-lime font-mono">${totalStaked.toFixed(2)}</span>
            </div>
          </div>

          {/* Spin + clear */}
          <button onClick={spin}
            disabled={spinning || bets.size === 0 || totalStaked > balance}
            className="g-btn g-btn-play">
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(10,12,16,0.3)', borderTopColor: 'var(--color-bg)' }} />
                Spinning...
              </span>
            ) : 'Spin'}
          </button>
          <button onClick={clearBets} disabled={spinning || bets.size === 0}
            className="g-btn g-btn-secondary">
            <Undo2 className="w-3.5 h-3.5" /> Clear Bets
          </button>

          {/* Recent numbers */}
          {history.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Recent</p>
                <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold text-white" style={{ background: numColor(h.winning) }}>
                    {h.winning}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center"
      style={{
        backgroundImage: 'url(/games/props/chip-heads.jpg)',
        backgroundSize: 'cover',
        color: 'var(--color-lime)',
        textShadow: '0 1px 2px #000',
        boxShadow: '0 0 8px color-mix(in oklab, var(--color-lime) 40%, transparent)',
        border: '1px solid color-mix(in oklab, var(--color-lime) 45%, transparent)',
      }}>
      {amount}
    </span>
  );
}
