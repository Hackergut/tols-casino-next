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
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { plinkoTable, type Risk, type PlinkoRows } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}


/*
 * Bin multipliers come from plinkoTable() — the same function the bet route
 * pays from. They used to be hardcoded here, and they were the ORIGINAL
 * uncalibrated tables: the '12-high' row below once read 420x at the edges and
 * measured 251% RTP. After the payouts were recalibrated server-side, the
 * board went on printing the old numbers under each bin while the server paid
 * the new ones. Deriving them guarantees the label matches the payout.
 */

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
  /** `skip` lands the ball immediately — reduced motion or Quick Play. */
  drop: (targetBin: number, skip?: boolean) => Promise<void>;
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

  // Kept in sync in an effect, not during render: the canvas draw loop reads
  // this ref outside React's render cycle.
  useEffect(() => {
    multRef.current = multipliers;
  }, [multipliers]);

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
      drop: (targetBin: number, skip?: boolean) =>
        new Promise<void>((resolve) => {
          const engine = engineRef.current;
          const geo = geoRef.current;
          if (!engine) return resolve();

          if (skip) {
            // No physics run: highlight the winning bin and settle at once.
            for (const b of ballsRef.current) Matter.Composite.remove(engine.world, b);
            ballsRef.current = [];
            trailRef.current = [];
            flashBinRef.current = { bin: targetBin, until: performance.now() + 900 };
            draw();
            return resolve();
          }

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

export function PlinkoGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ slot: number }>('plinko', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [rows, setRows] = useGameSetting<PlinkoRows>('plinko', 'rows', 12, [8, 12, 16]);
  const [risk, setRisk] = useGameSetting<Risk>('plinko', 'risk', 'medium', ['low', 'medium', 'high']);
  const [outcome, setOutcome] = useState<null | { won: boolean; multiplier: number; profit: number }>(null);

  const boardRef = useRef<PlinkoBoardHandle | null>(null);

  const multipliers = useMemo(() => plinkoTable(rows, risk), [rows, risk]);

  const dropBall = useCallback(async () => {
    setOutcome(null);
    const data = await place(betAmount, { rows, risk });
    if (!data) return;
    // Animate to the server-decided bin, then reveal.
    await boardRef.current?.drop(data.payload.slot, skipAnim);
    setOutcome({ won: data.won, multiplier: data.multiplier, profit: data.payout - data.amount });
  }, [place, betAmount, rows, risk, skipAnim]);

  return (
    <GameFrame
      gameId="plinko"
      title="Plinko"
      subtitle="Drop the ball and follow it down"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={history}
      fairness={fairness}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={busy}
          action={
            <BetButton onClick={dropBall} disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy}>
              {busy ? 'Dropping…' : 'Drop Ball'}
            </BetButton>
          }
        >
          <SegmentedControl<Risk>
            label="Risk"
            value={risk}
            onChange={setRisk}
            disabled={busy}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Med' },
              { value: 'high', label: 'High' },
            ]}
          />
          <SegmentedControl<PlinkoRows>
            label="Rows"
            value={rows}
            onChange={setRows}
            disabled={busy}
            options={[
              { value: 8, label: '8' },
              { value: 12, label: '12' },
              { value: 16, label: '16' },
            ]}
          />
          <div>
            <StatRow label="Top multiplier" value={`${Math.max(...multipliers).toFixed(2)}×`} tone="lime" />
            <StatRow label="Lowest bin" value={`${Math.min(...multipliers).toFixed(2)}×`} />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="plinko">
        <PlinkoBoard ref={boardRef} rows={rows} multipliers={multipliers} />
        <p className="plinko__verdict" data-won={outcome?.won || undefined}>
          {busy
            ? '…'
            : outcome
              ? outcome.won
                ? `${outcome.multiplier.toFixed(2)}× — +$${outcome.profit.toFixed(2)}`
                : `${outcome.multiplier.toFixed(2)}× — -$${Math.abs(outcome.profit).toFixed(2)}`
              : 'Ready'}
        </p>
      </div>
    </GameFrame>
  );
}
