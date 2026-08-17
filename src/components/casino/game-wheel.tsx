'use client';

/*
 * Wheel on the shared Originals frame.
 *
 * BUG FIXED — the wheel drew a hardcoded segment table (1.2 / 1.5 / 1.8 / 2.0…)
 * that was never regenerated when the payouts were recalibrated. The server
 * pays from wheelTable(segments, risk); the wheel showed something else. The
 * pointer would land on a wedge reading "1.5×" and the balance would move by a
 * different amount, which looks exactly like a rigged wheel.
 *
 * Segments are now generated from the same wheelTable() the bet route pays
 * from, so the wedge under the pointer is always the multiplier credited.
 */

import { useCallback, useMemo, useState } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { wheelTable, type Risk } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const SEGMENTS = 20;
const SEG_ANGLE = 360 / SEGMENTS;
const CENTER = 160;
const RADIUS = 150;
const SPIN_MS = 2600;

/** Colour a wedge by how good it is, so the wheel reads at a glance. */
function wedgeFill(mult: number, max: number): string {
  if (mult <= 0) return 'var(--surface)';
  if (mult >= max) return 'var(--lime-300)';
  const t = Math.min(1, mult / Math.max(1.0001, max));
  return `color-mix(in oklab, var(--lime-300) ${Math.round(18 + t * 55)}%, var(--surface))`;
}

export function WheelGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ segment: number; mult: number }>('wheel', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [risk, setRisk] = useGameSetting<Risk>('wheel', 'risk', 'medium', ['low', 'medium', 'high']);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<null | { won: boolean; multiplier: number; profit: number }>(null);

  // Single source of truth: exactly what the server pays.
  const table = useMemo(() => wheelTable(SEGMENTS, risk), [risk]);
  const maxMult = useMemo(() => Math.max(...table), [table]);

  const wedges = useMemo(
    () =>
      table.map((mult, i) => {
        const a0 = (i * SEG_ANGLE - 90) * (Math.PI / 180);
        const a1 = ((i + 1) * SEG_ANGLE - 90) * (Math.PI / 180);
        const x1 = CENTER + RADIUS * Math.cos(a0);
        const y1 = CENTER + RADIUS * Math.sin(a0);
        const x2 = CENTER + RADIUS * Math.cos(a1);
        const y2 = CENTER + RADIUS * Math.sin(a1);
        const mid = (a0 + a1) / 2;
        return {
          mult,
          index: i,
          d: `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`,
          tx: CENTER + RADIUS * 0.74 * Math.cos(mid),
          ty: CENTER + RADIUS * 0.74 * Math.sin(mid),
          fill: wedgeFill(mult, maxMult),
        };
      }),
    [table, maxMult],
  );

  const spin = useCallback(async () => {
    setOutcome(null);
    setWinning(null);
    setSpinning(true);

    const data = await place(betAmount, { segments: SEGMENTS, risk });
    if (!data) { setSpinning(false); return; }

    const seg = data.payload.segment;
    const settle = () => {
      setWinning(seg);
      setOutcome({ won: data.won, multiplier: data.multiplier, profit: data.payout - data.amount });
      setSpinning(false);
    };

    if (reduced) {
      // Land directly on the winning wedge with no spin.
      setRotation(360 - (seg * SEG_ANGLE + SEG_ANGLE / 2));
      settle();
      return;
    }

    const fullSpins = 5 + Math.floor(Math.random() * 3);
    setRotation((prev) => prev + fullSpins * 360 + (360 - (seg * SEG_ANGLE + SEG_ANGLE / 2)) - (prev % 360));
    window.setTimeout(settle, SPIN_MS);
  }, [place, betAmount, risk, reduced]);

  return (
    <GameFrame
      gameId="wheel"
      title="Wheel"
      subtitle="Spin for the multiplier under the pointer"
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
          disabled={busy || spinning}
          action={
            <BetButton onClick={spin} disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy || spinning}>
              {spinning ? 'Spinning…' : 'Spin'}
            </BetButton>
          }
        >
          <SegmentedControl<Risk>
            label="Risk"
            value={risk}
            onChange={setRisk}
            disabled={busy || spinning}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Med' },
              { value: 'high', label: 'High' },
            ]}
          />
          <div>
            <StatRow label="Segments" value={`${SEGMENTS}`} />
            <StatRow label="Top multiplier" value={`${maxMult.toFixed(2)}×`} tone="lime" />
            <StatRow label="Paying wedges" value={`${table.filter((m) => m > 0).length} / ${SEGMENTS}`} />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="wheel">
        <div className="wheel__pointer" aria-hidden="true" />
        <svg
          className="wheel__svg"
          viewBox="0 0 320 320"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: reduced ? 'none' : `transform ${SPIN_MS}ms cubic-bezier(.16,1,.3,1)`,
          }}
        >
          {wedges.map((w) => (
            <g key={w.index}>
              <path d={w.d} fill={w.fill} stroke="var(--bg)" strokeWidth="1.5" />
              <text
                x={w.tx}
                y={w.ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={w.mult >= maxMult ? 'var(--bg)' : 'rgba(255,255,255,.72)'}
                transform={`rotate(${w.index * SEG_ANGLE + SEG_ANGLE / 2} ${w.tx} ${w.ty})`}
              >
                {w.mult > 0 ? `${w.mult}×` : '—'}
              </text>
            </g>
          ))}
          <circle cx={CENTER} cy={CENTER} r="26" fill="var(--bg)" stroke="var(--border)" />
        </svg>
        <p className="wheel__verdict" data-won={outcome?.won || undefined}>
          {spinning
            ? '…'
            : outcome
              ? outcome.won
                ? `${outcome.multiplier.toFixed(2)}× — +$${outcome.profit.toFixed(2)}`
                : 'No win'
              : 'Place your bet'}
          {winning !== null && !spinning ? '' : ''}
        </p>
      </div>
    </GameFrame>
  );
}
