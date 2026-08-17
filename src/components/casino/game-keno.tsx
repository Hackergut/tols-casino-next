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

import { useCallback, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { KENO_POOL, KENO_DRAWN, kenoHitProb } from '@/lib/game-math';

interface Props { onBack: () => void; initialBalance: number; }

const MAX_PICKS = 10;
type Risk = 'classic' | 'low' | 'medium' | 'high';

interface KenoPayload { drawn: number[]; hits: number; picks: number[] }

export function KenoGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const { balance, busy, error, history, fairness, place } = useBet<KenoPayload>('keno', initialBalance);
  const [betAmount, setBetAmount] = useState(1);
  const [risk, setRisk] = useState<Risk>('classic');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [drawing, setDrawing] = useState(false);
  const [outcome, setOutcome] = useState<null | { won: boolean; hits: number; profit: number }>(null);

  const toggle = useCallback(
    (n: number) => {
      if (busy || drawing) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(n)) next.delete(n);
        else if (next.size < MAX_PICKS) next.add(n);
        return next;
      });
      setOutcome(null);
      setDrawn(new Set());
    },
    [busy, drawing],
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
    setSelected(new Set(pool.slice(0, Math.max(1, selected.size || 5))));
    setOutcome(null);
    setDrawn(new Set());
  }, [busy, drawing, selected.size]);

  const hitChance = useMemo(() => {
    const k = selected.size;
    if (!k) return null;
    // Chance of at least one hit, from the same hypergeometric the paytable
    // was solved against.
    return (1 - kenoHitProb(k, 0)) * 100;
  }, [selected.size]);

  const play = useCallback(async () => {
    if (selected.size < 1) return;
    setOutcome(null);
    setDrawn(new Set());
    setDrawing(true);
    const picks = Array.from(selected);
    const data = await place(betAmount, { picks, risk });
    if (!data) { setDrawing(false); return; }

    const balls = data.payload.drawn ?? [];
    const finish = () => {
      setDrawn(new Set(balls));
      setOutcome({ won: data.won, hits: data.payload.hits ?? 0, profit: data.payout - betAmount });
      setDrawing(false);
    };

    if (reduced) {
      finish();
      return;
    }
    // Reveal the server's draw one ball at a time. The result is already
    // decided; this is pacing, not suspense over an undetermined outcome.
    balls.forEach((n, i) => {
      window.setTimeout(() => setDrawn((prev) => new Set([...prev, n])), i * 90);
    });
    window.setTimeout(finish, balls.length * 90 + 120);
  }, [selected, place, betAmount, risk, reduced]);

  const busyAll = busy || drawing;

  return (
    <GameFrame
      title="Keno"
      subtitle={`Pick up to ${MAX_PICKS} — ${KENO_DRAWN} of ${KENO_POOL} are drawn`}
      onBack={onBack}
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
              onClick={play}
              disabled={selected.size < 1 || betAmount <= 0 || betAmount > balance}
              busy={busyAll}
            >
              {busyAll ? 'Drawing…' : selected.size < 1 ? 'Pick numbers' : 'Play'}
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
