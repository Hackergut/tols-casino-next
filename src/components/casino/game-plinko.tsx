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
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useGameSetting, useSkipAnimation } from "@/lib/game-settings";
import { placeOriginalsBet } from "@/lib/originals-client";
import { PLINKO_TABLES } from "@/lib/game-engines/tables";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface PlinkoPayload {
  slot: number;
}

const MULTIPLIER_TABLES = PLINKO_TABLES;

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

/* Board geometry */
const VIRTUAL_WIDTH = 760;
const PADDING_X = 40;
const PADDING_TOP = 34;
const BIN_HEIGHT = 42;

interface Geo {
  rows: number; width: number; height: number; centerX: number; spacing: number;
  rowSpacing: number; pegRadius: number; ballRadius: number; spawnY: number;
  landingY: number; binTopY: number; pegs: { x: number; y: number }[];
  binCentersX: number[]; binFromX: (x: number) => number;
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
  const binFromX = (x: number) => Math.max(0, Math.min(rows, Math.floor((x - PADDING_X) / spacing)));
  return { rows, width: VIRTUAL_WIDTH, height, centerX, spacing, rowSpacing, pegRadius, ballRadius, spawnY: 6, landingY, binTopY, pegs, binCentersX, binFromX };
}

function addBoardBodies(world: Matter.World, geo: Geo) {
  const opt = { isStatic: true, restitution: 0.4, friction: 0 };
  for (const p of geo.pegs) Matter.Composite.add(world, Matter.Bodies.circle(p.x, p.y, geo.pegRadius, { ...opt, label: 'peg' }));
  Matter.Composite.add(world, Matter.Bodies.rectangle(PADDING_X - 8, geo.height / 2, 16, geo.height, opt));
  Matter.Composite.add(world, Matter.Bodies.rectangle(VIRTUAL_WIDTH - PADDING_X + 8, geo.height / 2, 16, geo.height, opt));
  const bottomCount = geo.rows + 2;
  const rowWidth = (bottomCount - 1) * geo.spacing;
  const startX = geo.centerX - rowWidth / 2;
  for (let j = 0; j < bottomCount; j++) Matter.Composite.add(world, Matter.Bodies.rectangle(startX + j * geo.spacing, geo.binTopY + BIN_HEIGHT / 2, 3, BIN_HEIGHT, { ...opt, label: 'divider' }));
  Matter.Composite.add(world, Matter.Bodies.rectangle(geo.centerX, geo.height + 6, VIRTUAL_WIDTH, 16, opt));
}

function makeBall(geo: Geo, offsetX: number): Matter.Body {
  return Matter.Bodies.circle(geo.centerX + offsetX, geo.spawnY, geo.ballRadius, { restitution: 0.42, friction: 0, frictionAir: 0.008, frictionStatic: 0, label: 'ball' });
}

function simulateBin(geo: Geo, offsetX: number): number {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1;
  addBoardBodies(engine.world, geo);
  const ball = makeBall(geo, offsetX);
  Matter.Composite.add(engine.world, ball);
  for (let step = 0; step < 1000; step++) { Matter.Engine.update(engine, 1000 / 60); if (ball.position.y >= geo.landingY) break; }
  const bin = geo.binFromX(ball.position.x);
  Matter.World.clear(engine.world, false);
  Matter.Engine.clear(engine);
  return bin;
}

function findOffsetForBin(geo: Geo, target: number): number {
  const maxOff = (VIRTUAL_WIDTH - PADDING_X * 2) * 0.46;
  const candidates: number[] = [];
  for (let i = 0; i < 161; i++) candidates.push(-maxOff + (2 * maxOff * i) / 160);
  candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
  for (const off of candidates) if (simulateBin(geo, off) === target) return off;
  const baseOff = geo.binCentersX[target] - geo.centerX;
  for (let k = 0; k < 41; k++) {
    const off = baseOff + (k - 20) * (geo.spacing / 20);
    if (Math.abs(off) <= maxOff && simulateBin(geo, off) === target) return off;
  }
  return 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

export interface PlinkoBoardHandle { drop: (targetBin: number) => Promise<void>; }

const PlinkoBoard = forwardRef<PlinkoBoardHandle, { rows: 8 | 12 | 16; multipliers: number[] }>(
  function PlinkoBoard({ rows, multipliers }, ref) {
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
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, geo.width, geo.height);
      const bg = ctx.createLinearGradient(0, 0, 0, geo.height);
      bg.addColorStop(0, COL.bg); bg.addColorStop(1, COL.surface);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, geo.width, geo.height);
      const now = performance.now();
      const flash = flashBinRef.current && flashBinRef.current.until > now ? flashBinRef.current.bin : -1;
      for (let i = 0; i <= geo.rows; i++) {
        const mult = mults[i] ?? 0; const color = slotColor(mult); const cx = geo.binCentersX[i];
        const w = geo.spacing - 4; const x = cx - w / 2; const y = geo.binTopY + 2;
        ctx.save(); if (i === flash) { ctx.shadowColor = color; ctx.shadowBlur = Math.min(6 + mult, 28); }
        ctx.fillStyle = i === flash ? color : `${color}22`;
        roundRect(ctx, x, y, w, BIN_HEIGHT - 6, 5); ctx.fill(); ctx.restore();
        ctx.fillStyle = i === flash ? COL.bg : color;
        ctx.font = `700 ${geo.rows === 16 ? 9 : geo.rows === 12 ? 11 : 12}px ui-monospace, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${mult}x`, cx, y + (BIN_HEIGHT - 6) / 2);
      }
      for (const p of geo.pegs) {
        ctx.beginPath(); ctx.arc(p.x, p.y, geo.pegRadius, 0, Math.PI * 2);
        ctx.fillStyle = COL.peg; ctx.shadowColor = COL.lime; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
      }
      for (const ball of ballsRef.current) {
        const { x, y } = ball.position;
        const grad = ctx.createRadialGradient(x - geo.ballRadius * 0.3, y - geo.ballRadius * 0.3, geo.ballRadius * 0.2, x, y, geo.ballRadius);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, COL.lime); grad.addColorStop(1, '#9bb800');
        ctx.beginPath(); ctx.arc(x, y, geo.ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.shadowColor = COL.lime; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
      }
    }, []);

    const engineRef = useRef<Matter.Engine | null>(null);
    useEffect(() => {
      const geo = buildGeo(rows); geoRef.current = geo;
      const engine = Matter.Engine.create(); engine.gravity.y = 1;
      addBoardBodies(engine.world, geo); engineRef.current = engine;
      ballsRef.current = []; trailRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = geo.width * dpr; canvas.height = geo.height * dpr;
        canvas.style.aspectRatio = `${geo.width} / ${geo.height}`;
      }
      draw();
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); Matter.World.clear(engine.world, false); Matter.Engine.clear(engine); };
    }, [rows, draw]);

    useImperativeHandle(ref, () => ({
      drop: (targetBin: number) => new Promise<void>((resolve) => {
        const engine = engineRef.current; const geo = geoRef.current;
        if (!engine) return resolve();
        for (const b of ballsRef.current) Matter.Composite.remove(engine.world, b);
        ballsRef.current = []; trailRef.current = [];
        const offset = findOffsetForBin(geo, targetBin);
        const ball = makeBall(geo, offset); Matter.Composite.add(engine.world, ball);
        ballsRef.current = [ball]; let landed = false; let settleFrames = 0;
        const tick = () => {
          Matter.Engine.update(engine, 1000 / 60);
          trailRef.current.push({ x: ball.position.x, y: ball.position.y });
          if (trailRef.current.length > 12) trailRef.current.shift();
          if (!landed && ball.position.y >= geo.landingY) { landed = true; flashBinRef.current = { bin: targetBin, until: performance.now() + 1400 }; }
          draw();
          const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
          if (landed) { settleFrames++; if (speed < 0.4 || settleFrames > 70) { Matter.Composite.remove(engine.world, ball); ballsRef.current = []; draw(); rafRef.current = null; return resolve(); } }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }),
    }), [draw]);

    return <canvas ref={canvasRef} className="mx-auto block h-auto w-full" style={{ maxWidth: VIRTUAL_WIDTH, filter: 'drop-shadow(0 0 30px color-mix(in oklab, var(--color-lime) 5%, transparent))' }} />;
  }
);

export function PlinkoGame({ onBack, initialBalance, onPickGame }: Props) {
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<PlinkoPayload>("plinko", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);
  const [rows, setRows] = useGameSetting<"8" | "12" | "16">("plinko", "rows", "12");
  const [risk, setRisk] = useGameSetting<"low" | "medium" | "high">("plinko", "risk", "medium");
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; slot: number; multiplier: number; payout: number }>(null);
  const boardRef = useRef<PlinkoBoardHandle | null>(null);

  const numRows = Number(rows) as 8 | 12 | 16;
  const multipliers = useMemo(() => MULTIPLIER_TABLES[`${numRows}-${risk}`] ?? MULTIPLIER_TABLES['12-medium'], [numRows, risk]);

  const dropBall = useCallback(async () => {
    if (dropping || betAmount <= 0 || betAmount > balance) return;
    setDropping(true); setResult(null);
    try {
      const data = await place(betAmount, { rows: numRows, risk });
      if (!data) { setDropping(false); return; }
      await boardRef.current?.drop(data.payload.slot);
      setResult({ won: data.won, slot: data.payload.slot, multiplier: data.multiplier, payout: data.payout });
    } catch { /* ignore */ }
    setDropping(false);
  }, [dropping, betAmount, balance, numRows, risk, place]);

  return (
    <GameFrame
      gameId="plinko"
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
          disabled={dropping || busy}
          action={
            <BetButton onClick={dropBall} disabled={dropping || busy || betAmount <= 0} busy={dropping}>
              {dropping ? 'Dropping...' : 'Drop Ball'}
            </BetButton>
          }
        >
          <SegmentedControl
            label="Pins"
            options={[{ value: "8" as const, label: "8" }, { value: "12" as const, label: "12" }, { value: "16" as const, label: "16" }]}
            value={rows}
            onChange={setRows}
            disabled={dropping}
          />
          <SegmentedControl
            label="Risk"
            options={[{ value: "low" as const, label: "Low" }, { value: "medium" as const, label: "Medium" }, { value: "high" as const, label: "High" }]}
            value={risk}
            onChange={setRisk}
            disabled={dropping}
          />
          {/* Mini multiplier distribution */}
          <div className="flex flex-wrap gap-1 mt-2">
            {multipliers.map((m, i) => (
              <span key={i} className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold"
                style={{ background: getSlotBgColorVar(m), color: getSlotColorVar(m) }}
              >{m}×</span>
            ))}
          </div>
          {result && (
            <StatRow
              label={result.won ? "Won" : "Lost"}
              value={result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
              tone={result.won ? "lime" : "muted"}
            />
          )}
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="plinko">
        <PlinkoBoard ref={boardRef} rows={numRows} multipliers={multipliers} />
        {result && (
          <p className="plinko__verdict" data-won={result.won || undefined}>
            {result.won ? `+$${result.payout.toFixed(2)} at ${result.multiplier}×` : `-$${betAmount.toFixed(2)}`}
          </p>
        )}
      </div>
    </GameFrame>
  );
}
