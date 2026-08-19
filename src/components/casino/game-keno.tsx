'use client';

/*
 * Keno on the shared Originals frame.
 *
 * SECURITY / CORRECTNESS: the previous version ran the entire game in the
 * browser. It shuffled its own draw with crypto.getRandomValues, scored the
 * hits locally, read a hardcoded paytable and credited the balance itself —
 * the server was never called, so there was no provable fairness and no
 * enforced RTP.
 *
 * It was also playing a different game: the client drew 20 numbers from a 1–80
 * grid, while the server (and the calibrated hypergeometric paytable in
 * game-math) uses 10 drawn from 40. The odds on screen never matched the odds
 * the paytable was solved for.
 *
 * The grid, the draw and the paytable now all come from the server's actual
 * configuration: KENO_POOL, KENO_DRAWN and the rows the bet route derives.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, isAutoRunning } from '@/components/casino/useAutoBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { KENO_POOL, KENO_DRAWN, kenoHitProb } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const MAX_PICKS = 10;
type Risk = 'classic' | 'low' | 'medium' | 'high';

interface KenoPayload { drawn: number[]; hits: number; picks: number[] }

export function KenoGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<KenoPayload>('keno', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [risk, setRisk] = useGameSetting<Risk>('keno', 'risk', 'classic', ['classic', 'low', 'medium', 'high']);
  /*
   * Picked numbers are remembered between sessions, like the stake and the
   * risk level — a returning player used to face an empty grid. Restored
   * picks are re-validated against the pool before use.
   */
  const [pickedNumbers, setPickedNumbers] = useGameSetting<number[]>('keno', 'picks', []);
  const selected = useMemo(
    () =>
      new Set(
        pickedNumbers
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= KENO_POOL)
          .slice(0, MAX_PICKS),
      ),
    [pickedNumbers],
  );
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [drawing, setDrawing] = useState(false);
  const [outcome, setOutcome] = useState<null | { won: boolean; hits: number; profit: number }>(null);
  // Every reveal timeout is tracked so unmounting mid-draw (game switch)
  // cannot fire a setState on a dead component.
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  }, []);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    },
    [],
  );

  const toggle = useCallback(
    (n: number) => {
      if (busy || drawing) return;
      const next = new Set(selected);
      if (next.has(n)) next.delete(n);
      else if (next.size < MAX_PICKS) next.add(n);
      setPickedNumbers(Array.from(next));
      setOutcome(null);
      setDrawn(new Set());
    },
    [busy, drawing, selected, setPickedNumbers],
  );

  const quickPick = useCallback(() => {
    if (busy || drawing) return;
    const pool = Array.from({ length: KENO_POOL }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Presentation only — which numbers you pick cannot change the RTP, so a
    // client-side shuffle is safe here in a way the draw never was.
    setPickedNumbers(pool.slice(0, Math.max(1, selected.size || 5)));
    setOutcome(null);
    setDrawn(new Set());
  }, [busy, drawing, selected.size, setPickedNumbers]);

  const hitChance = useMemo(() => {
    const k = selected.size;
    if (!k) return null;
    // Chance of at least one hit, from the same hypergeometric the paytable
    // was solved against.
    return (1 - kenoHitProb(k, 0)) * 100;
  }, [selected.size]);

  const play = useCallback(async (): Promise<number | null> => {
    if (selected.size < 1) return null;
    setOutcome(null);
    setDrawn(new Set());
    setDrawing(true);
    const data = await place(betAmount, { picks: Array.from(selected), risk });
    if (!data) { setDrawing(false); return null; }

    const balls = data.payload.drawn ?? [];
    const net = Math.round((data.payout - data.amount) * 100) / 100;
    const finish = () => {
      setDrawn(new Set(balls));
      setOutcome({ won: data.won, hits: data.payload.hits ?? 0, profit: data.payout - data.amount });
      setDrawing(false);
    };

    if (reduced || isAutoRunning('keno')) {
      finish();
      return net;
    }
    // Reveal the server's draw one ball at a time. The result is already
    // decided; this is pacing, not suspense over an undetermined outcome.
    await new Promise<void>((resolve) => {
      balls.forEach((n, i) => {
        later(() => setDrawn((prev) => new Set([...prev, n])), i * 90);
      });
      later(() => {
        finish();
        resolve();
      }, balls.length * 90 + 120);
    });
    return net;
  }, [selected, place, betAmount, risk, reduced, later]);

  const auto = useAutoBet('keno', play);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';
  const busyAll = busy || drawing || auto.running;

  return (
    <GameFrame
      gameId="keno"
      title="Keno"
      subtitle={`Pick up to ${MAX_PICKS} — ${KENO_DRAWN} of ${KENO_POOL} are drawn`}
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
          disabled={busyAll}
          action={
            <BetButton
              onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void play(); }}
              disabled={auto.running ? false : selected.size < 1 || balance > 0 && (betAmount <= 0 || betAmount > balance)}
              busy={busyAll}
              repeatable={autoMode}
            >
              {autoMode
                ? auto.running
                  ? 'Stop Auto'
                  : 'Start Auto'
                : busyAll
                  ? 'Drawing…'
                  : selected.size < 1
                    ? 'Pick numbers'
                    : 'Play'}
            </BetButton>
          }
        >
          <SegmentedControl<Risk>
            label="Risk"
            value={risk}
            onChange={setRisk}
            disabled={busyAll}
            options={[
              { value: 'classic', label: 'Classic' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Med' },
              { value: 'high', label: 'High' },
            ]}
          />
          <button type="button" className="tols-chip" onClick={quickPick} disabled={busyAll}>
            Quick pick
          </button>
          <div>
            <StatRow label="Picked" value={`${selected.size} / ${MAX_PICKS}`} />
            {hitChance !== null && <StatRow label="Chance of a hit" value={`${hitChance.toFixed(2)}%`} />}
            {outcome && <StatRow label="Hits" value={`${outcome.hits}`} tone={outcome.won ? 'lime' : undefined} />}
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="keno">
        <div className="keno__grid">
          {Array.from({ length: KENO_POOL }, (_, i) => i + 1).map((n) => {
            const picked = selected.has(n);
            const hit = drawn.has(n);
            return (
              <button
                key={n}
                type="button"
                className="keno__cell"
                onClick={() => toggle(n)}
                disabled={busyAll}
                data-picked={picked || undefined}
                data-drawn={hit || undefined}
                data-hit={(picked && hit) || undefined}
                aria-pressed={picked}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="keno__verdict" data-won={outcome?.won || undefined}>
          {drawing
            ? 'Drawing…'
            : outcome
              ? outcome.won
                ? `${outcome.hits} hits — +$${outcome.profit.toFixed(2)}`
                : `${outcome.hits} hits — no win`
              : 'Select your numbers'}
        </p>
      </div>
    </GameFrame>
  );
}
