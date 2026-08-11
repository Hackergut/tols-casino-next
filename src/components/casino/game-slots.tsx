'use client';

/*
 * Slots — PixiJS reels adapted from asiryk/slot-game (MIT).
 * https://github.com/asiryk/slot-game
 *
 * The original decides wins in the browser. Here the reels are purely a
 * presentation layer: the server (POST /api/bets, game:"slots") picks the
 * symbol grid and payout at a fixed 97% RTP, and the reels animate to *that*
 * grid. No outcome logic lives on the client.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Application, Assets, Sprite, Container, Graphics, Texture } from 'pixi.js';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';

interface Props {
  onBack: () => void;
  initialBalance: number;
}

const QUICK_BETS = [1, 5, 10, 50, 100];

/* Backend paytable (normalised pays from src/app/api/bets/route.ts) — display only. */
const PAYTABLE: { sym: number; label: string; pay: number }[] = [
  { sym: 6, label: 'SYM6', pay: 31.98 },
  { sym: 5, label: 'SYM5', pay: 20.35 },
  { sym: 4, label: 'SYM4', pay: 13.08 },
  { sym: 3, label: 'SYM3', pay: 8.72 },
  { sym: 2, label: 'SYM2', pay: 5.81 },
  { sym: 1, label: 'SYM1 (wild)', pay: 87.22 },
];

/* ── Board geometry (matches the 960×536 atlas background) ── */
const APP_W = 960;
const APP_H = 536;
const SYM_SCALE = 0.8;
const SYM_W = 235 * SYM_SCALE; // 188
const SYM_H = 155 * SYM_SCALE; // 124
const Y_OFFSET = (APP_H - SYM_H * 3) / 3;
const CELL_H = SYM_H + Y_OFFSET;
const PADDING_TOP = Y_OFFSET / 2;
const REEL_LEFT_X = (r: number) => 91 + r * 240; // top-left x of each reel's symbols

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface ReelState {
  slots: Sprite[]; // 5 sprites (vi = -1..3)
  strip: number[]; // symbol ids along the reel
  stopOff: number;
  duration: number;
  start: number;
  done: boolean;
  off: number;
}

export interface SlotsHandle {
  spin: (grid: number[][], winSym: number) => Promise<void>;
}

const SlotReels = forwardRef<SlotsHandle, unknown>(function SlotReels(_props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const texRef = useRef<Record<number, Texture>>({});
  const reelsRef = useRef<ReelState[]>([]);
  const winGlowRef = useRef<Graphics | null>(null);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();

    (async () => {
      await app.init({ width: APP_W, height: APP_H, backgroundAlpha: 0, antialias: true });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      const host = hostRef.current;
      if (host) {
        host.innerHTML = '';
        app.canvas.style.width = '100%';
        app.canvas.style.height = 'auto';
        app.canvas.style.display = 'block';
        host.appendChild(app.canvas);
      }

      const sheet = await Assets.load('/games/slots/atlas.json');
      if (cancelled) {
        app.destroy(true);
        return;
      }
      for (let i = 1; i <= 6; i++) texRef.current[i] = sheet.textures[`SYM${i}.png`];

      // Background
      const bg = new Sprite(sheet.textures['BG.png']);
      bg.width = APP_W;
      bg.height = APP_H;
      app.stage.addChild(bg);

      // Reels area with a mask (hides buffer rows above/below the 3 visible)
      const reelsLayer = new Container();
      app.stage.addChild(reelsLayer);
      const mask = new Graphics().rect(80, 18, APP_W - 160, APP_H - 36).fill(0xffffff);
      app.stage.addChild(mask);
      reelsLayer.mask = mask;

      // Win glow behind the centre payline (hidden until a win)
      const glow = new Graphics()
        .rect(80, PADDING_TOP + CELL_H, APP_W - 160, SYM_H)
        .fill({ color: 0xcdf32b, alpha: 0.18 });
      glow.visible = false;
      app.stage.addChild(glow);
      winGlowRef.current = glow;

      // Bet line
      const betline = new Sprite(sheet.textures['Bet_Line.png']);
      betline.anchor.set(0.5);
      betline.x = APP_W / 2;
      betline.y = APP_H / 2;
      betline.alpha = 0.5;
      app.stage.addChild(betline);

      // Build the three reels (5 sprites each)
      const reels: ReelState[] = [];
      for (let r = 0; r < 3; r++) {
        const slots: Sprite[] = [];
        for (let vi = -1; vi <= 3; vi++) {
          const s = new Sprite(texRef.current[1 + ((r + vi + 6) % 6)]);
          s.width = SYM_W;
          s.height = SYM_H;
          s.x = REEL_LEFT_X(r);
          s.y = PADDING_TOP + vi * CELL_H;
          reelsLayer.addChild(s);
          slots.push(s);
        }
        reels.push({ slots, strip: [], stopOff: 0, duration: 0, start: 0, done: true, off: 0 });
      }
      reelsRef.current = reels;
      app.render();
    })();

    return () => {
      cancelled = true;
      const app = appRef.current;
      if (app) {
        app.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      spin: (grid: number[][], winSym: number) =>
        new Promise<void>((resolve) => {
          const app = appRef.current;
          const reels = reelsRef.current;
          const glow = winGlowRef.current;
          if (!app || reels.length !== 3) return resolve();
          if (glow) glow.visible = false;

          const now = performance.now();
          for (let r = 0; r < 3; r++) {
            const reel = reels[r];
            const stopOff = 22 + r * 6; // later reels travel further → left-to-right settle
            const len = stopOff + 6;
            const strip: number[] = [];
            for (let i = 0; i < len; i++) strip.push(1 + Math.floor(Math.random() * 6));
            // The 3 cells that come to rest in the visible window = server grid[r]
            strip[stopOff] = grid[r][0]; // top
            strip[stopOff + 1] = grid[r][1]; // middle (payline)
            strip[stopOff + 2] = grid[r][2]; // bottom
            reel.strip = strip;
            reel.stopOff = stopOff;
            reel.duration = 1000 + r * 550;
            reel.start = now;
            reel.done = false;
            reel.off = 0;
          }

          const tick = () => {
            const t = performance.now();
            let allDone = true;
            for (let r = 0; r < 3; r++) {
              const reel = reels[r];
              if (!reel.done) {
                const p = Math.min(1, (t - reel.start) / reel.duration);
                reel.off = reel.stopOff * easeOutCubic(p);
                if (p >= 1) {
                  reel.off = reel.stopOff;
                  reel.done = true;
                } else {
                  allDone = false;
                }
              }
              const cellBase = Math.floor(reel.off);
              const frac = reel.off - cellBase;
              for (let vi = -1; vi <= 3; vi++) {
                const s = reel.slots[vi + 1];
                let idx = cellBase + vi;
                if (idx < 0) idx = 0;
                if (idx >= reel.strip.length) idx = reel.strip.length - 1;
                s.texture = texRef.current[reel.strip[idx]] ?? s.texture;
                s.y = PADDING_TOP + vi * CELL_H - frac * CELL_H;
              }
            }
            app.render();
            if (allDone) {
              app.ticker.remove(tick);
              if (glow && winSym > 0) {
                glow.visible = true;
                setTimeout(() => {
                  if (winGlowRef.current) winGlowRef.current.visible = false;
                }, 1400);
              }
              resolve();
            }
          };
          app.ticker.add(tick);
        }),
    }),
    [],
  );

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        aspectRatio: `${APP_W} / ${APP_H}`,
        background: 'var(--color-bg)',
      }}
    />
  );
});

export function SlotsGame({ onBack, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; multiplier: number; payout: number }>(null);
  const [history, setHistory] = useState<Array<{ multiplier: number; result: string; payout: number }>>([]);
  const reelsRef = useRef<SlotsHandle | null>(null);

  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'slots', amount: betAmount }),
      });
      const data = await res.json();
      if (data.success) {
        const payload = data.data.payload as { grid: number[][]; winSym: number };
        await reelsRef.current?.spin(payload.grid, payload.winSym);
        const r = { won: data.data.won, multiplier: data.data.multiplier, payout: data.data.payout };
        setResult(r);
        setBalance(data.data.newBalance);
        setHistory((prev) =>
          [{ multiplier: r.multiplier, result: r.won ? 'win' : 'lose', payout: r.payout }, ...prev].slice(0, 10),
        );
      }
    } catch {
      /* ignore */
    }
    setSpinning(false);
  }, [spinning, betAmount, balance]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Slots</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Spin the reels — match symbols on the centre payline!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Reels */}
        <div className="lg:col-span-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <SlotReels ref={reelsRef} />

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
                    {result.won ? `at ${result.multiplier}x` : 'no match'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="mt-1 text-2xl font-bold text-lime" />
          </div>

          {/* Bet Amount */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Bet Amount</p>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {QUICK_BETS.map((v) => (
                <button key={v} onClick={() => setBetAmount(v)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={betAmount === v
                    ? { background: 'color-mix(in oklab, var(--color-lime) 15%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 30%, transparent)' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}
                  disabled={spinning}
                >
                  ${v}
                </button>
              ))}
            </div>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
              className="w-full h-9 px-3 rounded-lg text-sm font-bold text-white text-center outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              disabled={spinning}
            />
          </div>

          {/* Spin Button */}
          <button onClick={spin}
            disabled={spinning || betAmount <= 0 || betAmount > balance}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{
              background: spinning ? 'color-mix(in oklab, var(--color-lime) 30%, transparent)' : 'var(--color-lime)',
              color: 'var(--color-bg)',
              boxShadow: spinning ? 'none' : '0 0 20px color-mix(in oklab, var(--color-lime) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(10,12,16,0.3)', borderTopColor: 'var(--color-bg)' }} />
                Spinning...
              </span>
            ) : (
              'Spin'
            )}
          </button>

          {/* Paytable */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Paytable (3 on line) · 97% RTP</p>
            <div className="space-y-1">
              {PAYTABLE.map((p) => (
                <div key={p.sym} className="flex items-center justify-between text-[10px] font-mono">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{p.label}</span>
                  <span className="text-lime font-bold">{p.pay.toFixed(2)}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Spin History</h3>
            <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in oklab, var(--color-lime) 20%, transparent) transparent' }}>
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${h.result === 'win' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                  {h.result.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{h.multiplier}x</span>
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
