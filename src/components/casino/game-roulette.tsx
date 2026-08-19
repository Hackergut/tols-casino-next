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
import { Undo2 } from 'lucide-react';
import { GameFrame, BetButton, StatRow, BetModeAndAuto } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, useAutoStatus, isAutoRunning } from '@/components/casino/useAutoBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { ROULETTE_RTP } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const CHIPS = [1, 5, 10, 25, 100];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function numColor(n: number): string {
  if (n === 0) return '#9bc400';
  return RED.has(n) ? '#e33b26' : '#141412';
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/* ── Wheel canvas ── */
export interface RouletteHandle {
  /** `skip` settles on the winning pocket at once. */
  spin: (winning: number, skip?: boolean) => Promise<void>;
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

    // Ball
    const b = ballRef.current;
    const bx = CX + Math.cos(b.angle) * b.radius;
    const by = CY + Math.sin(b.angle) * b.radius;
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(bx - 3, by - 3, 1.5, bx, by, 10);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#c8c8c2');
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
      spin: (winning: number, skip?: boolean) =>
        new Promise<void>((resolve) => {
          const idx = WHEEL_ORDER.indexOf(winning);
          const startRot = rotRef.current % (Math.PI * 2);

          if (skip) {
            // Settle straight onto the winning pocket, no orbit.
            rotRef.current = -(idx * PA) % (Math.PI * 2);
            ballRef.current = { angle: -Math.PI / 2, radius: R_POCKET - 2 };
            draw();
            return resolve();
          }
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

export function RouletteGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ winning: number }>('roulette', initialBalance);
  // Chip value persists like every other game setting.
  const [chip, setChip] = useGameSetting<number>('roulette', 'chip', 1, CHIPS);
  const [bets, setBets] = useState<Map<string, Bet>>(new Map());
  const [spinning, setSpinning] = useState(false);
  /*
   * `net` and `staked` are captured at settle time. The old result read the
   * live `totalStaked`, so editing the table after a win mutated the "you
   * lost $X" banner of the spin you had just watched; and a win showed the
   * gross payout ("+$36") while a loss showed the net stake ("−$1") — two
   * different accounting bases for one number.
   */
  const [result, setResult] = useState<null | { winning: number; net: number }>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const wheelRef = useRef<RouletteHandle | null>(null);

  const totalStaked = Array.from(bets.values()).reduce((s, b) => s + b.amount, 0);
  // Read straight from the status store: the useAutoBet instance below is
  // declared after spin(), but the table lock must exist before placeBet.
  const autoRunning = useAutoStatus((s) => s.running && s.gameId === 'roulette');
  const locked = busy || spinning || autoRunning;

  const placeBet = useCallback((type: string, value?: number) => {
    if (locked) return;
    setResult(null);
    setBets((prev) => {
      const next = new Map(prev);
      const k = betKey(type, value);
      const cur = next.get(k);
      next.set(k, { type, value, amount: (cur?.amount ?? 0) + chip });
      return next;
    });
  }, [chip, locked]);

  const clearBets = useCallback(() => { if (!locked) setBets(new Map()); }, [locked]);

  const spin = useCallback(async (): Promise<number | null> => {
    if (bets.size === 0 || balance > 0 && (totalStaked <= 0 || totalStaked > balance)) return null;
    setSpinning(true);
    setResult(null);
    // Bets are locked during the spin (the table is disabled), so this
    // capture stays the amount actually settled.
    const staked = totalStaked;
    const data = await place(staked, { bets: Array.from(bets.values()) });
    if (!data) { setSpinning(false); return null; }
    const winning = data.payload.winning;
    const charged = Number.isFinite(data.amount) ? data.amount : staked;
    await wheelRef.current?.spin(winning, skipAnim || isAutoRunning('roulette'));
    setResult({ winning, net: Math.round((data.payout - charged) * 100) / 100 });
    setRecent((prev) => [winning, ...prev].slice(0, 12));
    setSpinning(false);
    return Math.round((data.payout - charged) * 100) / 100;
  }, [bets, totalStaked, balance, place, skipAnim]);

  const auto = useAutoBet('roulette', spin);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';

  const chipOn = (type: string, value?: number) => bets.get(betKey(type, value))?.amount ?? 0;

  // Standard table layout: row1 = 3,6..36 ; row2 = 2,5..35 ; row3 = 1,4..34
  const gridRows = [
    Array.from({ length: 12 }, (_, i) => 3 + i * 3),
    Array.from({ length: 12 }, (_, i) => 2 + i * 3),
    Array.from({ length: 12 }, (_, i) => 1 + i * 3),
  ];

  return (
    <GameFrame
      gameId="roulette"
      title="Roulette"
      subtitle="European single zero — the best odds on the site"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={history}
      fairness={fairness}
      rtp={ROULETTE_RTP}
      controls={
        /*
         * Roulette stakes come from the chips on the table, not a single
         * amount field, so this rail replaces BetPanel while keeping the
         * same shell, spacing and button styling as every other Original.
         */
        <div className="tols-bet">
          {/* Same Manual/Auto unit every BetPanel gets — roulette's rail is
              bespoke, but the betting modes must not be. */}
          <BetModeAndAuto blocked={busy || spinning} />
          <span className="tols-bet__label">
            Chip value
            <span className="tols-bet__balance">${balance.toFixed(2)}</span>
          </span>
          <div className="tols-chips">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className="tols-chip"
                data-active={chip === c || undefined}
                onClick={() => setChip(c)}
                disabled={locked}
              >
                ${c}
              </button>
            ))}
          </div>
          <div>
            <StatRow label="Total staked" value={`$${totalStaked.toFixed(2)}`} tone="lime" />
            <StatRow label="Bets on table" value={`${bets.size}`} />
          </div>
          <div className="tols-bet__action">
            <BetButton
              onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void spin(); }}
              disabled={auto.running ? false : bets.size === 0 || balance > 0 && (totalStaked <= 0 || totalStaked > balance)}
              busy={autoMode ? auto.running : locked}
              repeatable={autoMode}
            >
              {autoMode ? (auto.running ? 'Stop Auto' : 'Start Auto') : locked ? 'Spinning…' : 'Spin'}
            </BetButton>
            <button type="button" className="tols-chip" onClick={clearBets} disabled={locked || bets.size === 0}>
              <Undo2 className="size-3.5" /> Clear bets
            </button>
          </div>
          {error && <p className="tols-error">{error}</p>}
        </div>
      }
    >
      <div className="roul">
        <RouletteWheel ref={wheelRef} />

        {result && (
          <div className="roul__result">
            <span className="roul__ball" style={{ background: numColor(result.winning) }}>{result.winning}</span>
            <span className="roul__amount" data-won={result.net > 0 || undefined}>
              {result.net >= 0 ? `+$${result.net.toFixed(2)}` : `−$${Math.abs(result.net).toFixed(2)}`}
            </span>
          </div>
        )}

        <div className="roul__table">
          <div className="roul__nums">
            <button
              type="button"
              className="roul__zero"
              onClick={() => placeBet('straight', 0)}
              disabled={locked}
              style={{ background: numColor(0) }}
            >
              0{chipOn('straight', 0) > 0 && <Chip amount={chipOn('straight', 0)} />}
            </button>
            <div className="roul__grid">
              {gridRows.flatMap((row) =>
                row.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="roul__num"
                    onClick={() => placeBet('straight', n)}
                    disabled={locked}
                    style={{ background: numColor(n) }}
                  >
                    {n}{chipOn('straight', n) > 0 && <Chip amount={chipOn('straight', n)} />}
                  </button>
                )),
              )}
            </div>
          </div>

          <div className="roul__row roul__row--3">
            {DOZENS.map((d) => (
              <button key={d.key} type="button" className="roul__outside" onClick={() => placeBet(d.type)} disabled={locked}>
                {d.label}{chipOn(d.type) > 0 && <Chip amount={chipOn(d.type)} />}
              </button>
            ))}
          </div>

          <div className="roul__row roul__row--6">
            {OUTSIDE.map((o) => (
              <button
                key={o.key}
                type="button"
                className="roul__outside"
                onClick={() => placeBet(o.type)}
                disabled={locked}
                style={
                  o.type === 'red' ? { background: '#e33b26', color: '#fff' }
                  : o.type === 'black' ? { background: '#141412', color: '#fff' }
                  : undefined
                }
              >
                {o.label}{chipOn(o.type) > 0 && <Chip amount={chipOn(o.type)} />}
              </button>
            ))}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="roul__recent">
            {recent.map((n, i) => (
              <span key={i} className="roul__ball roul__ball--sm" style={{ background: numColor(n) }}>{n}</span>
            ))}
          </div>
        )}
      </div>
    </GameFrame>
  );
}

function Chip({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
      style={{ background: 'var(--color-lime)', color: 'var(--color-bg)', boxShadow: '0 0 6px color-mix(in oklab, var(--color-lime) 40%, transparent)' }}>
      {amount}
    </span>
  );
}
