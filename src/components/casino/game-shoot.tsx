'use client';

/*
 * Shoot on the shared Originals frame.
 *
 * SECURITY: the previous version resolved the whole round in the browser. It
 * generated targets from Math.random(), decided the multiplier locally, and
 * credited the balance with setBalance(b => b + payout) — the server was never
 * asked. That meant no provable fairness, no server-side RTP, and a payout any
 * user could set from the console. It also meant the calibrated 94% band table
 * did not apply to the game people actually played.
 *
 * Every outcome now comes from POST /api/bets, like every other Original.
 * The targets shown are presentation: the server picks the band, and the
 * chosen target is what the reveal animates to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { GameFrame, BetPanel, BetButton, StatRow } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, isAutoRunning } from '@/components/casino/useAutoBet';
import { useGameSettings, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { shootBands } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const TARGET_COUNT = 5;

export function ShootGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<{ mult: number }>('shoot', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [firing, setFiring] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<null | { won: boolean; multiplier: number; profit: number; idx: number }>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  // The payout ladder, straight from the calibrated bands so the odds shown
  // are the odds paid.
  const bands = useMemo(() => shootBands().filter((b) => b.multiplier > 0), []);

  const shoot = useCallback(
    async (idx: number): Promise<number | null> => {
      if (busy || firing !== null) return null;
      setOutcome(null);
      setFiring(idx);
      const data = await place(betAmount, { target: idx });
      if (!data) { setFiring(null); return null; }
      const net = Math.round((data.payout - data.amount) * 100) / 100;
      const settle = () => {
        setOutcome({
          won: data.won,
          multiplier: data.payload.mult ?? data.multiplier,
          profit: data.payout - data.amount,
          idx,
        });
        setFiring(null);
      };
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      if (reduced || isAutoRunning('shoot')) settle();
      else settleTimer.current = window.setTimeout(settle, 420);
      return net;
    },
    [busy, firing, place, betAmount, reduced],
  );

  const randomShot = useCallback(() => shoot(Math.floor(Math.random() * TARGET_COUNT)), [shoot]);

  const auto = useAutoBet('shoot', randomShot);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';

  const canPlay = balance <= 0 || (betAmount > 0 && betAmount <= balance);
  const locked = busy || firing !== null || auto.running;

  return (
    <GameFrame
      gameId="shoot"
      title="Shoot"
      subtitle="Pick a target and take the shot"
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
          disabled={locked}
          action={
            <BetButton
              onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void randomShot(); }}
              disabled={auto.running ? false : !canPlay}
              busy={autoMode ? auto.running : busy || firing !== null}
              repeatable={autoMode}
            >
              {autoMode
                ? auto.running
                  ? 'Stop Auto'
                  : 'Start Auto'
                : busy || firing !== null
                  ? 'Firing…'
                  : 'Quick Shot'}
            </BetButton>
          }
        >
          <div className="tols-seg-label">Payout ladder</div>
          <div>
            {bands.map((b) => (
              <StatRow
                key={b.multiplier}
                label={`${(b.p * 100).toFixed(1)}% chance`}
                value={`${b.multiplier.toFixed(2)}×`}
                tone={b.multiplier >= 5 ? 'lime' : undefined}
              />
            ))}
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="shoot">
        <div className="shoot__range">
          {Array.from({ length: TARGET_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className="shoot__target"
              disabled={!canPlay || locked}
              data-firing={firing === i || undefined}
              data-hit={outcome?.idx === i && outcome.won ? true : undefined}
              data-miss={outcome?.idx === i && !outcome.won ? true : undefined}
              onClick={() => { void shoot(i); }}
              aria-label={`Target ${i + 1}`}
            >
              <Crosshair className="size-6" />
            </button>
          ))}
        </div>
        <p className="shoot__verdict" data-won={outcome?.won || undefined}>
          {firing !== null
            ? '…'
            : outcome
              ? outcome.won
                ? `HIT ${outcome.multiplier.toFixed(2)}× — +$${outcome.profit.toFixed(2)}`
                : 'MISS'
              : 'Choose a target'}
        </p>
      </div>
    </GameFrame>
  );
}
