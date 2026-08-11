'use client';

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import Matter from 'matter-js';
import { ArrowLeft, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";

interface Props {
  onBack: () => void;
  initialBalance: number;
}


/* ── Multiplier tables matching backend (src/app/api/bets/route.ts) ── */
const MULTIPLIER_TABLES: Record<string, number[]> = {
  '8-low': [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
  '8-medium': [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
  '8-high': [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  '12-low': [10, 3, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 3, 10],
  '12-medium': [58, 15, 7, 3, 1.5, 1, 0.5, 1, 1.5, 3, 7, 15, 58],
  '12-high': [420, 70, 14, 5, 2, 1, 0.2, 1, 2, 5, 14, 70, 420],
  '16-low': [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  '16-medium': [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  '16-high': [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
};

/* ── Theme colours (hex — canvas can't read CSS vars) ── */
const COL = {
  bg: '#0f1015',
  surface: '#151513',
  lime: '#cdf32b',
  cyan: '#c2e600',
  win: '#b8e600',
  blue: '#a8a89e',
  pending: '#ffb52e',
  loss: '#ff4a33',
  peg: 'rgba(205,243,43,0.55)',
};

function slotColor(mult: number): string {
  if (mult >= 10) return COL.lime;
  if (mult >= 5) return COL.cyan;
  if (mult >= 2) return COL.win;
  if (mult >= 1) return COL.blue;
  if (mult >= 0.5) return COL.pending;
  return COL.loss;
}

function getSlotColorVar(mult: number): string {
  if (mult >= 10) return 'var(--color-lime)';
  if (mult >= 5) return '#c2e600';
  if (mult >= 2) return 'var(--color-win)';
  if (mult >= 1) return '#a8a89e';
  if (mult >= 0.5) return 'var(--color-pending)';
  return 'var(--color-loss)';
}
function getSlotBgColorVar(mult: number): string {
  if (mult >= 10) return 'color-mix(in oklab, var(--color-lime) 15%, transparent)';
  if (mult >= 5) return 'rgba(34,211,238,0.15)';
  if (mult >= 2) return 'color-mix(in oklab, var(--color-win) 15%, transparent)';
  if (mult >= 1) return 'rgba(96,165,250,0.12)';
  if (mult >= 0.5) return 'color-mix(in oklab, var(--color-pending) 12%, transparent)';
  return 'color-mix(in oklab, var(--color-loss) 15%, transparent)';
}

/* ────────────────────────────────────────────────────────────────────────
 * Board geometry — pure, derived from row count.
 * Row r (0-indexed) has (r + 3) pegs; the bottom row therefore has
 * (rows + 2) pegs, forming (rows + 1) bins — matching the multiplier tables.
 * ──────────────────────────────────────────────────────────────────────── */
const VIRTUAL_WIDTH = 760;
const PADDING_X = 40;
const PADDING_TOP = 34;
const BIN_HEIGHT = 42;

interface Geo {
  rows: number;
  width: number;
  height: number;
  centerX: number;
  spacing: number;
  rowSpacing: number;
  pegRadius: number;
  ballRadius: number;
  spawnY: number;
  landingY: number;
  binTopY: number;
  pegs: { x: number; y: number }[];
  binCentersX: number[];
  binFromX: (x: number) => number;
}

function buildGeo(rows: number): Geo {
  const usableWidth = VIRTUAL_WIDTH - PADDING_X * 2;
  const spacing = usableWidth / (rows + 1);
  const rowSpacing = spacing * 0.92;
  const pegRadius = Math.max(3, Math.min(8, spacing * 0.12));
  const ballRadius = Math.max(5, Math.min(12, spacing * 0.26));
  const centerX = VIRTUAL_WIDTH / 2;

  const pegs: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const count = r + 3;
    const rowWidth = (count - 1) * spacing;
    const startX = centerX - rowWidth / 2;
    const y = PADDING_TOP + r * rowSpacing;
    for (let j = 0; j < count; j++) pegs.push({ x: startX + j * spacing, y });
  }

  const binTopY = PADDING_TOP + (rows - 1) * rowSpacing + spacing * 0.55;
  const height = binTopY + BIN_HEIGHT + 8;
  const landingY = binTopY - ballRadius;

  const binCentersX: number[] = [];
  for (let i = 0; i <= rows; i++) binCentersX.push(PADDING_X + spacing / 2 + i * spacing);

  const binFromX = (x: number) =>
    Math.max(0, Math.min(rows, Math.floor((x - PADDING_X) / spacing)));

  return {
    rows,
    width: VIRTUAL_WIDTH,
    height,
    centerX,
    spacing,
    rowSpacing,
    pegRadius,
    ballRadius,
    spawnY: 6,
    landingY,
    binTopY,
    pegs,
    binCentersX,
    binFromX,
  };
}

/* Static bodies (pegs, side walls, bin dividers, floor) — identical build for
 * both the headless search engine and the visible engine so trajectories match. */
function addBoardBodies(world: Matter.World, geo: Geo) {
  const bodies: Matter.Body[] = [];
  const opt = { isStatic: true, restitution: 0.4, friction: 0 };

  for (const p of geo.pegs) {
    bodies.push(Matter.Bodies.circle(p.x, p.y, geo.pegRadius, { ...opt, label: 'peg' }));
  }

  // Side walls
  bodies.push(Matter.Bodies.rectangle(PADDING_X - 8, geo.height / 2, 16, geo.height, opt));
  bodies.push(
    Matter.Bodies.rectangle(VIRTUAL_WIDTH - PADDING_X + 8, geo.height / 2, 16, geo.height, opt),
  );

  // Bin dividers (aligned under the bottom row of pegs)
  const bottomCount = geo.rows + 2;
  const rowWidth = (bottomCount - 1) * geo.spacing;
  const startX = geo.centerX - rowWidth / 2;
  for (let j = 0; j < bottomCount; j++) {
    const x = startX + j * geo.spacing;
    bodies.push(
      Matter.Bodies.rectangle(x, geo.binTopY + BIN_HEIGHT / 2, 3, BIN_HEIGHT, {
        ...opt,
        label: 'divider',
      }),
    );
  }

  // Floor
  bodies.push(Matter.Bodies.rectangle(geo.centerX, geo.height + 6, VIRTUAL_WIDTH, 16, opt));

  Matter.Composite.add(world, bodies);
}

function makeBall(geo: Geo, offsetX: number): Matter.Body {
  return Matter.Bodies.circle(geo.centerX + offsetX, geo.spawnY, geo.ballRadius, {
    restitution: 0.42,
    friction: 0,
    frictionAir: 0.008,
    frictionStatic: 0,
    label: 'ball',
  });
}

const FIXED_DT = 1000 / 60;

/* Headless simulation → returns the bin the ball lands in for a given spawn
 * offset. Deterministic because dt is fixed and there is no external RNG. */
function simulateBin(geo: Geo, offsetX: number): number {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1;
  addBoardBodies(engine.world, geo);
  const ball = makeBall(geo, offsetX);
  Matter.Composite.add(engine.world, ball);
  for (let step = 0; step < 1000; step++) {
    Matter.Engine.update(engine, FIXED_DT);
    if (ball.position.y >= geo.landingY) break;
  }
  const bin = geo.binFromX(ball.position.x);
  Matter.World.clear(engine.world, false);
  Matter.Engine.clear(engine);
  return bin;
}

/* Find a spawn offset whose trajectory lands in `target`. Candidates are
 * ordered by absolute offset so the ball drops as close to centre as possible
 * while still reaching the (server-decided) bin. */
function findOffsetForBin(geo: Geo, target: number): number {
  const maxOff = (VIRTUAL_WIDTH - PADDING_X * 2) * 0.46;
  const N = 161;
  const candidates: number[] = [];
  for (let i = 0; i < N; i++) {
    candidates.push(-maxOff + (2 * maxOff * i) / (N - 1));
  }
  candidates.sort((a, b) => Math.abs(a) - Math.abs(b));

  let best = 0;
  let bestDelta = Infinity;
  for (const off of candidates) {
    const bin = simulateBin(geo, off);
    if (bin === target) return off;
    const d = Math.abs(bin - target);
    if (d < bestDelta) {
      bestDelta = d;
      best = off;
    }
  }
  // Targeted fallback: spawn (roughly) above the target bin, jitter fine.
  const baseOff = geo.binCentersX[target] - geo.centerX;
  for (let k = 0; k < 41; k++) {
    const jitter = (k - 20) * (geo.spacing / 20);
    const off = baseOff + jitter;
    if (Math.abs(off) > maxOff) continue;
    if (simulateBin(geo, off) === target) return off;
  }
  return best; // extremely rare — closest achievable
}

/* ── Canvas physics board ── */
export interface PlinkoBoardHandle {
  drop: (targetBin: number) => Promise<void>;
}

interface BoardProps {
  rows: 8 | 12 | 16;
  multipliers: number[];
}

const PlinkoBoard = forwardRef<PlinkoBoardHandle, BoardProps>(function PlinkoBoard(
  { rows, multipliers },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoRef = useRef<Geo>(buildGeo(rows));
  const ballsRef = useRef<Matter.Body[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const flashBinRef = useRef<{ bin: number; until: number } | null>(null);
  const multRef = useRef<number[]>(multipliers);

  multRef.current = multipliers;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const geo = geoRef.current;
    const mults = multRef.current;

    // Backing store is DPR-scaled for crisp retina output; draw in CSS pixels.
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geo.width, geo.height);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, geo.height);
    bg.addColorStop(0, COL.bg);
    bg.addColorStop(1, COL.surface);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, geo.width, geo.height);

    // Bins
    const now = performance.now();
    const flash = flashBinRef.current && flashBinRef.current.until > now ? flashBinRef.current.bin : -1;
    for (let i = 0; i <= geo.rows; i++) {
      const mult = mults[i] ?? 0;
      const color = slotColor(mult);
      const cx = geo.binCentersX[i];
      const w = geo.spacing - 4;
      const x = cx - w / 2;
      const y = geo.binTopY + 2;
      const isFlash = i === flash;
      ctx.save();
      if (isFlash) {
        ctx.shadowColor = color;
        ctx.shadowBlur = Math.min(6 + mult, 28);
      }
      ctx.fillStyle = isFlash ? color : `${color}22`;
      roundRect(ctx, x, y, w, BIN_HEIGHT - 6, 5);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = isFlash ? COL.bg : color;
      ctx.font = `700 ${geo.rows === 16 ? 9 : geo.rows === 12 ? 11 : 12}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}x`, cx, y + (BIN_HEIGHT - 6) / 2);
    }

    // Pegs
    for (const p of geo.pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, geo.pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = COL.peg;
      ctx.shadowColor = COL.lime;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Ball trail
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const a = (i / trail.length) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, geo.ballRadius * (0.5 + (i / trail.length) * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(205,243,43,${a})`;
      ctx.fill();
    }

    // Balls
    for (const ball of ballsRef.current) {
      const { x, y } = ball.position;
      const grad = ctx.createRadialGradient(
        x - geo.ballRadius * 0.3,
        y - geo.ballRadius * 0.3,
        geo.ballRadius * 0.2,
        x,
        y,
        geo.ballRadius,
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, COL.lime);
      grad.addColorStop(1, '#9bb800');
      ctx.beginPath();
      ctx.arc(x, y, geo.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = COL.lime;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, []);

  // (Re)build the visible engine when rows change; draw a static frame.
  const engineRef = useRef<Matter.Engine | null>(null);
  useEffect(() => {
    const geo = buildGeo(rows);
    geoRef.current = geo;
    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    addBoardBodies(engine.world, geo);
    engineRef.current = engine;
    ballsRef.current = [];
    trailRef.current = [];

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = geo.width * dpr;
      canvas.height = geo.height * dpr;
      canvas.style.aspectRatio = `${geo.width} / ${geo.height}`;
    }
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
    };
  }, [rows, draw]);

  useImperativeHandle(
    ref,
    () => ({
      drop: (targetBin: number) =>
        new Promise<void>((resolve) => {
          const engine = engineRef.current;
          const geo = geoRef.current;
          if (!engine) return resolve();

          // Remove any leftover balls
          for (const b of ballsRef.current) Matter.Composite.remove(engine.world, b);
          ballsRef.current = [];
          trailRef.current = [];

          const offset = findOffsetForBin(geo, targetBin);
          const ball = makeBall(geo, offset);
          Matter.Composite.add(engine.world, ball);
          ballsRef.current = [ball];

          let landed = false;
          let settleFrames = 0;

          const tick = () => {
            Matter.Engine.update(engine, FIXED_DT);

            // trail
            trailRef.current.push({ x: ball.position.x, y: ball.position.y });
            if (trailRef.current.length > 12) trailRef.current.shift();

            if (!landed && ball.position.y >= geo.landingY) {
              landed = true;
              flashBinRef.current = { bin: targetBin, until: performance.now() + 1400 };
            }

            draw();

            const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
            if (landed) {
              settleFrames++;
              if (speed < 0.4 || settleFrames > 70) {
                Matter.Composite.remove(engine.world, ball);
                ballsRef.current = [];
                draw();
                rafRef.current = null;
                return resolve();
              }
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }),
    }),
    [draw],
  );

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block h-auto w-full"
      style={{
        // Cap at the board's natural width so height follows the true aspect
        // ratio — a max-height cap here would squash the board.
        maxWidth: VIRTUAL_WIDTH,
        filter: 'drop-shadow(0 0 30px color-mix(in oklab, var(--color-lime) 5%, transparent))',
      }}
    />
  );
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function PlinkoGame({ onBack, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(5);
  const [rows, setRows] = useState<8 | 12 | 16>(12);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; slot: number; multiplier: number; payout: number }>(null);
  const [history, setHistory] = useState<Array<{ slot: number; multiplier: number; result: string; payout: number }>>([]);

  const boardRef = useRef<PlinkoBoardHandle | null>(null);

  const multipliers = useMemo(() => {
    const key = `${rows}-${risk}`;
    return MULTIPLIER_TABLES[key] ?? MULTIPLIER_TABLES['12-medium'];
  }, [rows, risk]);

  const dropBall = useCallback(async () => {
    if (dropping || betAmount <= 0 || betAmount > balance) return;
    setDropping(true);
    setResult(null);

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'plinko', amount: betAmount, payload: { rows, risk } }),
      });
      const data = await res.json();
      if (data.success) {
        const payload = data.data.payload as { slot: number };
        // Animate the ball to the server-decided slot, then reveal the result.
        await boardRef.current?.drop(payload.slot);
        const r = {
          won: data.data.won,
          slot: payload.slot,
          multiplier: data.data.multiplier,
          payout: data.data.payout,
        };
        setResult(r);
        setBalance(data.data.newBalance);
        setHistory((prev) =>
          [{ slot: payload.slot, multiplier: r.multiplier, result: r.won ? 'win' : 'lose', payout: r.payout }, ...prev].slice(0, 10),
        );
      }
    } catch {
      /* ignore */
    }
    setDropping(false);
  }, [dropping, betAmount, balance, rows, risk]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Plinko</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Drop the ball and watch it bounce to a multiplier!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Game Board */}
        <div className="lg:col-span-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <PlinkoBoard ref={boardRef} rows={rows} multipliers={multipliers} />

            {/* Result Banner */}
            {result && (
              <div className="px-4 py-3 text-center" style={{
                background: result.won
                  ? 'linear-gradient(90deg, color-mix(in oklab, var(--color-lime) 8%, transparent), color-mix(in oklab, var(--color-lime) 15%, transparent), color-mix(in oklab, var(--color-lime) 8%, transparent))'
                  : 'linear-gradient(90deg, color-mix(in oklab, var(--color-loss) 8%, transparent), color-mix(in oklab, var(--color-loss) 15%, transparent), color-mix(in oklab, var(--color-loss) 8%, transparent))',
                borderTop: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div className="flex items-center justify-center gap-3">
                  <span className={`text-lg font-bold font-mono tabular-nums ${result.won ? 'text-lime' : 'text-loss'}`}>
                    {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
                  </span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    at {result.multiplier}x
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="space-y-3">
          {/* Balance */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="mt-1 text-2xl font-bold text-lime" />
          </div>

          {/* Rows */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Pins</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([8, 12, 16] as const).map(r => (
                <button key={r} onClick={() => setRows(r)}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={rows === r
                    ? { background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)', boxShadow: '0 0 12px color-mix(in oklab, var(--color-lime) 15%, transparent)' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}
                  disabled={dropping}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Risk */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Risk</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as const).map(r => (
                <button key={r} onClick={() => setRisk(r)}
                  className="py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all"
                  style={risk === r
                    ? { background: r === 'low' ? 'color-mix(in oklab, var(--color-win) 15%, transparent)' : r === 'high' ? 'color-mix(in oklab, var(--color-loss) 15%, transparent)' : 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: r === 'low' ? 'var(--color-win)' : r === 'high' ? 'var(--color-loss)' : 'var(--color-lime)', border: `1px solid ${r === 'low' ? 'color-mix(in oklab, var(--color-win) 30%, transparent)' : r === 'high' ? 'color-mix(in oklab, var(--color-loss) 30%, transparent)' : 'color-mix(in oklab, var(--color-lime) 30%, transparent)'}`, boxShadow: `0 0 12px ${r === 'low' ? 'color-mix(in oklab, var(--color-win) 15%, transparent)' : r === 'high' ? 'color-mix(in oklab, var(--color-loss) 15%, transparent)' : 'color-mix(in oklab, var(--color-lime) 15%, transparent)'}` }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}
                  disabled={dropping}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Mini multiplier distribution */}
            <div className="mt-3 flex flex-wrap gap-1">
              {multipliers.map((m, i) => (
                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold"
                  style={{
                    background: getSlotBgColorVar(m),
                    color: getSlotColorVar(m),
                    border: `1px solid ${getSlotColorVar(m)}22`
                  }}
                >
                  {m}x
                </span>
              ))}
            </div>
          </div>

          {/* Bet Amount */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={dropping} />

{/* Bet Button */}
          <button onClick={dropBall}
            disabled={dropping || betAmount <= 0 || betAmount > balance}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{
              background: dropping ? 'color-mix(in oklab, var(--color-lime) 30%, transparent)' : 'var(--color-lime)',
              color: 'var(--color-bg)',
              boxShadow: dropping ? 'none' : '0 0 20px color-mix(in oklab, var(--color-lime) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            {dropping ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(10,12,16,0.3)', borderTopColor: 'var(--color-bg)' }} />
                Dropping...
              </span>
            ) : (
              'Drop Ball'
            )}
          </button>
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
                    Slot {h.slot} → <span style={{ color: getSlotColorVar(h.multiplier) }}>{h.multiplier}x</span>
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${h.result === 'win' ? 'text-win' : 'text-loss'}`}>
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
