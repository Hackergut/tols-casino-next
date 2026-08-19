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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gem, Bomb } from 'lucide-react';
import { GameFrame, BetPanel, BetButton, StatRow, NumberField } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useAutoBet, isAutoRunning } from '@/components/casino/useAutoBet';
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
  /*
   * The tile selection is remembered like every other setting: a player who
   * leaves Mines and comes back finds their pattern, not an empty board.
   * Restored picks are re-validated — a stale array could name tiles that no
   * longer fit the current mine count.
   */
  const [pickedTiles, setPickedTiles] = useGameSetting<number[]>('mines', 'picks', []);
  const maxPicks = TILES - mineCount;
  const picks = useMemo(
    () =>
      new Set(
        pickedTiles
          .filter((t) => Number.isInteger(t) && t >= 0 && t < TILES)
          .slice(0, maxPicks),
      ),
    [pickedTiles, maxPicks],
  );
  const [layout, setLayout] = useState<boolean[] | null>(null);
  const [outcome, setOutcome] = useState<null | { won: boolean; profit: number }>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  const n = picks.size;

  const multiplier = useMemo(() => (n > 0 ? minesMultiplier(n, mineCount) : 0), [n, mineCount]);
  const survival = useMemo(() => (n > 0 ? minesSurvival(n, mineCount) : 0), [n, mineCount]);
  const floored = useMemo(() => (n > 0 ? minesIsFloored(n, mineCount) : false), [n, mineCount]);

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  const toggle = useCallback(
    (i: number) => {
      if (busy || layout) return;
      const next = new Set(picks);
      if (next.has(i)) next.delete(i);
      else if (next.size < maxPicks) next.add(i);
      setPickedTiles(Array.from(next));
    },
    [busy, layout, picks, maxPicks, setPickedTiles],
  );

  /**
   * One round. Resolves to the net profit, or null when the bet did not
   * settle (which is also the auto-bet stop signal).
   */
  const reveal = useCallback(async (): Promise<number | null> => {
    if (n < 1) return null;
    setOutcome(null);
    const data = await place(betAmount, { mines: mineCount, picks: Array.from(picks) });
    if (!data) return null;
    setLayout(data.payload.layout);
    const net = Math.round((data.payout - data.amount) * 100) / 100;
    const finish = () => setOutcome({ won: data.won, profit: data.payout - data.amount });
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    if (reduced || isAutoRunning('mines')) finish();
    else settleTimer.current = window.setTimeout(finish, 320);
    return net;
  }, [n, place, betAmount, mineCount, picks, reduced]);

  /*
   * Auto replays the same pattern every round: clear the settled board, keep
   * the picks, reveal again. Manual play keeps the pattern too on "New
   * round" — clearing it used to force a full re-pick between every round.
   */
  const play = useCallback(async (): Promise<number | null> => {
    if (picks.size < 1) return null;
    if (layout) {
      setLayout(null);
      setOutcome(null);
    }
    return reveal();
  }, [picks.size, layout, reveal]);

  const auto = useAutoBet('mines', play);
  const autoMode = useGameSettings((st) => st.mode) === 'auto';

  const reset = useCallback(() => {
    setLayout(null);
    setOutcome(null);
  }, []);

  const settled = layout !== null;
  const locked = busy || auto.running;

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
          disabled={locked || settled}
          action={
            // Auto drives whole rounds, so it owns the button even when the
            // board is settled.
            !autoMode && settled ? (
              <BetButton onClick={reset} tone="danger">New round</BetButton>
            ) : (
              <BetButton
                onClick={autoMode ? (auto.running ? auto.stop : () => { void auto.start(); }) : () => { void play(); }}
                disabled={auto.running ? false : n < 1 || balance > 0 && (betAmount <= 0 || betAmount > balance)}
                busy={autoMode ? auto.running : busy}
                repeatable={autoMode}
              >
                {autoMode
                  ? auto.running
                    ? 'Stop Auto'
                    : 'Start Auto'
                  : busy
                    ? 'Revealing…'
                    : n < 1
                      ? 'Pick tiles'
                      : `Reveal ${n} tile${n === 1 ? '' : 's'}`}
              </BetButton>
            )
          }
        >
          <div className="tols-field">
            <label htmlFor="mines-count">Mines</label>
            <NumberField
              id="mines-count"
              integer
              min={1}
              max={24}
              step={1}
              value={mineCount}
              disabled={locked || settled}
              onCommit={(v) => {
                setMineCount(v);
                // Picks that no longer fit the safe-tile budget are dropped.
                if (picks.size > TILES - v) setPickedTiles(Array.from(picks).slice(0, TILES - v));
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
                disabled={locked || settled}
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
