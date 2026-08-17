'use client';

/*
 * Slots — PixiJS reels adapted from asiryk/slot-game (MIT).
 * https://github.com/asiryk/slot-game
 *
 * The original decides wins in the browser. Here the reels are purely a
 * presentation layer: the server (POST /api/bets, game:"slots") picks the
 * symbol grid and payout at a fixed SLOTS_RTP, and the reels animate to *that*
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
import { GameFrame, BetPanel, BetButton, StatRow } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { slotPaytable, SLOTS_RTP } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const QUICK_BETS = [1, 5, 10, 50, 100];

/*
 * Paytable for display. Previously this was a hand-copied snapshot of the
 * server's numbers and it went stale the moment the edge changed — the UI
 * advertised payouts the server no longer paid. It is now derived from the
 * same slotPaytable() the bet route uses, so it cannot drift again.
 */
const PAYTABLE: { sym: number; label: string; pay: number }[] = (() => {
  const pays = slotPaytable();
  const labels = ['SYM1 (wild)', 'SYM2', 'SYM3', 'SYM4', 'SYM5', 'SYM6'];
  return pays
    .map((pay, i) => ({ sym: i + 1, label: labels[i], pay }))
    .sort((a, b) => (a.sym === 1 ? 1 : b.sym === 1 ? -1 : b.pay - a.pay));
})();

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
  /** `skip` snaps the reels to the final grid — reduced motion or Quick Play. */
  spin: (grid: number[][], winSym: number, skip?: boolean) => Promise<void>;
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
      await app.init({
        width: APP_W,
        height: APP_H,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: "webgl",
      });
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
      spin: (grid: number[][], winSym: number, skip?: boolean) =>
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
            // Quick Play / reduced motion still settles left-to-right, just
            // fast enough to read as a snap rather than a spin.
            reel.duration = skip ? 90 + r * 40 : 1000 + r * 550;
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
      className="slots__reels"
      style={{
        width: '100%',
        aspectRatio: `${APP_W} / ${APP_H}`,
        background: 'var(--color-bg)',
      }}
    />
  );
});

export function SlotsGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } =
    useBet<{ grid: number[][]; winSym: number }>('slots', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [outcome, setOutcome] = useState<null | { won: boolean; multiplier: number; profit: number }>(null);
  const reelsRef = useRef<SlotsHandle | null>(null);

  const spin = useCallback(async () => {
    setOutcome(null);
    const data = await place(betAmount);
    if (!data) return;
    // The reels animate to the grid the server already picked.
    await reelsRef.current?.spin(data.payload.grid, data.payload.winSym, skipAnim);
    setOutcome({ won: data.won, multiplier: data.multiplier, profit: data.payout - data.amount });
  }, [place, betAmount, skipAnim]);

  return (
    <GameFrame
      gameId="slots"
      title="Neon Sevens"
      subtitle="Three reels, one payline"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={history}
      fairness={fairness}
      rtp={SLOTS_RTP}
      controls={
        <BetPanel
          amount={betAmount}
          setAmount={setBetAmount}
          balance={balance}
          disabled={busy}
          action={
            <BetButton onClick={spin} disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy}>
              {busy ? 'Spinning…' : 'Spin'}
            </BetButton>
          }
        >
          <div>
            <span className="tols-seg-label">Paytable · 3 on the line</span>
            {PAYTABLE.map((p) => (
              <StatRow key={p.sym} label={p.label} value={`${p.pay.toFixed(2)}×`} tone={p.sym === 1 ? 'lime' : undefined} />
            ))}
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="slots">
        <SlotReels ref={reelsRef} />
        <p className="slots__verdict" data-won={outcome?.won || undefined}>
          {busy
            ? '…'
            : outcome
              ? outcome.won
                ? `${outcome.multiplier.toFixed(2)}× — +$${outcome.profit.toFixed(2)}`
                : 'No win'
              : 'Spin to play'}
        </p>
      </div>
    </GameFrame>
  );
}
