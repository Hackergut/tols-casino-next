'use client';

/*
 * Mines on the shared Originals frame.
 *
 * BUG FIXED — the player was charged once per tile. The old flow POSTed to
 * /api/bets on every single reveal, and again on cash-out; every POST debits
 * the stake. A round where you revealed five tiles and cashed out cost six
 * stakes and paid one. The stake shown under "Bet Amount" was not the amount
 * at risk.
 *
 * The layout was also re-drawn on each call: every POST uses a new nonce, so
 * minesLayout() returned a *different* board each time. The mine you "avoided"
 * on pick three had no relationship to the one that killed you on pick four.
 *
 * A progressive reveal cannot be settled honestly through a one-shot endpoint
 * — the server has no open round to attach later picks to. So the round is now
 * explicit: choose your tiles, then reveal. One bet, one charge, one layout,
 * and the multiplier is minesMultiplier(picks, mines) — exactly what the
 * server pays. Committing the picks up front is also strictly fairer than the
 * old flow, where the board could be reshuffled underneath you.
 */

import { useCallback, useMemo, useState } from 'react';
import { Gem, Bomb } from 'lucide-react';
import { GameFrame, BetPanel, BetButton, StatRow } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useGameSetting, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { minesMultiplier, minesSurvival, minesIsFloored } from '@/lib/game-math';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

const TILES = 25;

export function MinesGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } =
    useBet<{ layout: boolean[]; picks: number[] }>('mines', initialBalance);
  // Stake is shared across every Original and survives navigation, so it
  // cannot silently jump when the player switches game.
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);
  const [mineCount, setMineCount] = useGameSetting<number>('mines', 'mines', 3);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [layout, setLayout] = useState<boolean[] | null>(null);
  const [outcome, setOutcome] = useState<null | { won: boolean; profit: number }>(null);

  const maxPicks = TILES - mineCount;
  const n = picks.size;

  const multiplier = useMemo(() => (n > 0 ? minesMultiplier(n, mineCount) : 0), [n, mineCount]);
  const survival = useMemo(() => (n > 0 ? minesSurvival(n, mineCount) : 0), [n, mineCount]);
  const floored = useMemo(() => (n > 0 ? minesIsFloored(n, mineCount) : false), [n, mineCount]);

  const toggle = useCallback(
    (i: number) => {
      if (busy || layout) return;
      setPicks((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else if (next.size < TILES - mineCount) next.add(i);
        return next;
      });
    },
    [busy, layout, mineCount],
  );

  const reveal = useCallback(async () => {
    if (n < 1) return;
    setOutcome(null);
    const data = await place(betAmount, { mines: mineCount, picks: Array.from(picks) });
    if (!data) return;
    setLayout(data.payload.layout);
    const finish = () => setOutcome({ won: data.won, profit: data.payout - data.amount });
    if (reduced) finish();
    else window.setTimeout(finish, 320);
  }, [n, place, betAmount, mineCount, picks, reduced]);

  const reset = useCallback(() => {
    setPicks(new Set());
    setLayout(null);
    setOutcome(null);
  }, []);

  const settled = layout !== null;

  return (
    <GameFrame
      gameId="mines"
      title="Mines"
      subtitle={`Pick your tiles — ${mineCount} of ${TILES} are mined`}
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
          disabled={busy || settled}
          action={
            settled ? (
              <BetButton onClick={reset} tone="danger">New round</BetButton>
            ) : (
              <BetButton onClick={reveal} disabled={n < 1 || balance > 0 && (betAmount <= 0 || betAmount > balance)} busy={busy}>
                {busy ? 'Revealing…' : n < 1 ? 'Pick tiles' : `Reveal ${n} tile${n > 1 ? '' : ''}`}
              </BetButton>
            )
          }
        >
          <div className="tols-field">
            <label htmlFor="mines-count">Mines</label>
            <input
              id="mines-count"
              type="number"
              min={1}
              max={24}
              step={1}
              value={mineCount}
              disabled={busy || settled}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                const next = Number.isFinite(v) ? Math.max(1, Math.min(24, v)) : 3;
                setMineCount(next);
                // Picks that no longer fit the safe-tile budget are dropped.
                setPicks((prev) => new Set(Array.from(prev).slice(0, TILES - next)));
              }}
              className="tols-input font-mono"
            />
          </div>
          <div>
            <StatRow label="Tiles picked" value={`${n} / ${maxPicks}`} />
            <StatRow label="Survival chance" value={n ? `${(survival * 100).toFixed(2)}%` : '—'} />
            <StatRow label="Multiplier" value={n ? `${multiplier.toFixed(2)}×` : '—'} tone="lime" />
            <StatRow
              label="Profit on win"
              value={n ? `$${(betAmount * multiplier - betAmount).toFixed(2)}` : '—'}
              tone="lime"
            />
          </div>
          {floored && (
            <p className="tols-note">
              This is the safest possible reveal — the payout is held at the minimum win, so it
              returns slightly more than the house edge.
            </p>
          )}
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="mines">
        <div className="mines__grid">
          {Array.from({ length: TILES }, (_, i) => {
            const picked = picks.has(i);
            const isMine = layout?.[i] === true;
            return (
              <button
                key={i}
                type="button"
                className="mines__tile"
                onClick={() => toggle(i)}
                disabled={busy || settled}
                data-picked={picked || undefined}
                data-safe={settled && picked && !isMine ? true : undefined}
                data-boom={settled && picked && isMine ? true : undefined}
                data-mine={settled && !picked && isMine ? true : undefined}
                aria-pressed={picked}
                aria-label={`Tile ${i + 1}`}
              >
                {settled && isMine ? (
                  <Bomb className="size-4" />
                ) : settled && picked ? (
                  <Gem className="size-4" />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mines__verdict" data-won={outcome?.won || undefined}>
          {busy
            ? '…'
            : outcome
              ? outcome.won
                ? `SAFE — +$${outcome.profit.toFixed(2)}`
                : 'BOOM — hit a mine'
              : n > 0
                ? `${n} picked · ${multiplier.toFixed(2)}×`
                : 'Choose your tiles'}
        </p>
      </div>
    </GameFrame>
  );
}
