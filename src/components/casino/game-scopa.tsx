'use client';

/*
 * Scopa Siciliana Fast Bet — on the shared Originals frame.
 *
 * The outcome is decided server-side (/api/bets, case "scopa") in one request;
 * the client replays the returned `timeline` (deal + move events) as a live
 * auto-round: cards are dealt, played from the two face-up hands, captured
 * into the two piles, and the five scoring categories tally up before the
 * outcome banner. The replay is cosmetic — the result was already committed —
 * and the board is rebuilt with the pure reducer in `@/lib/scopa-playback`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FastForward, Swords } from 'lucide-react';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from '@/components/casino/GameFrame';
import { useBet } from '@/components/casino/useBet';
import { useGameSettings, useSkipAnimation } from '@/lib/game-settings';
import type { OriginalId } from '@/lib/originals-registry';
import { SCOPA_MARKETS, SCOPA_ODDS, type ScopaMarket, type Card as ScopaCard, type ScopaEvent } from '@/lib/scopa';
import {
  applyEventTo,
  emptyBoard,
  finalBoard,
  scopaCardKey,
  type ScopaBoard,
} from '@/lib/scopa-playback';
import { SicilianCard, SicilianCardBack } from '@/components/casino/scopa-card';

interface Props {
  onBack: () => void;
  initialBalance: number;
  /** Jump to a sibling Original from the rail under the canvas. */
  onPickGame?: (id: OriginalId) => void;
}

interface ScopaPayload {
  market: ScopaMarket;
  odds: number;
  outcome: 'player' | 'bank' | 'draw';
  timeline: ScopaEvent[];
  playerCardsCount: number;
  bankCardsCount: number;
  playerPoints: number;
  bankPoints: number;
  totalPoints: number;
  playerScopa: number;
  bankScopa: number;
  playerSettebello: boolean;
  bankSettebello: boolean;
  playerDenari: number;
  bankDenari: number;
  playerPrimiera: number;
  bankPrimiera: number;
}

type Phase = 'idle' | 'dealing' | 'playing' | 'scoring' | 'done';

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ');

const MARKET_GROUPS: { title: string; ids: ScopaMarket[] }[] = [
  { title: 'Esito 1X2', ids: ['player', 'bank', 'draw'] },
  { title: 'Totale punti', ids: ['over', 'under'] },
  { title: 'Settebello', ids: ['settebello_player', 'settebello_bank'] },
  { title: 'Scope', ids: ['scopa_over'] },
];

function marketLabel(m: ScopaMarket): string {
  return SCOPA_MARKETS.find((x) => x.id === m)?.label ?? m;
}

/* ── Card face. `layoutId` is the framer-motion shared element that flies a
   card between the hand, the table and the piles. ── */
function ScopaCardFace({
  card,
  size,
  layoutId,
  style,
}: {
  card: ScopaCard;
  size: 'sm' | 'md' | 'lg';
  layoutId: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, scale: 0.5, y: -14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        layout: { type: 'spring', stiffness: 480, damping: 40, mass: 0.75 },
        opacity: { duration: 0.16 },
        scale: { duration: 0.16 },
        y: { duration: 0.16 },
      }}
      className={cx('scopa-card', size)}
      style={style}
    >
      <SicilianCard card={card} />
    </motion.div>
  );
}

function ScorePanel({
  name,
  points,
  cells,
  winner,
  revealed,
  done,
}: {
  name: string;
  points: number;
  cells: { label: string; value: string; win: boolean }[];
  winner: boolean;
  revealed: number;
  done: boolean;
}) {
  return (
    <div className={cx('scopa-score-panel', winner && done && 'winner')}>
      <div className="scopa-score-head">
        <span className="scopa-score-name">{name}</span>
        {winner && done && <Swords className="h-3 w-3" style={{ color: 'var(--g-green, #00e701)' }} />}
      </div>
      <div
        className="scopa-score-points"
        style={done ? { animation: 'scopa-outcome-pop 0.4s cubic-bezier(0.16,1,0.3,1)' } : undefined}
      >
        {done ? points : '•'}
      </div>
      <div className="scopa-score-grid">
        {cells.map((c, j) => (
          <div key={j} className={cx('scopa-score-cell', c.win && done && 'win')}>
            <span>{c.label}</span>
            {revealed > j ? <b>{c.value}</b> : <b style={{ opacity: 0.3 }}>•</b>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScopaGame({ onBack, initialBalance, onPickGame }: Props) {
  const reduced = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<ScopaPayload>('scopa', initialBalance);
  const betAmount = useGameSettings((st) => st.stake);
  const setBetAmount = useGameSettings((st) => st.setStake);

  const [market, setMarket] = useState<ScopaMarket>('player');
  const [round, setRound] = useState<ScopaPayload | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);

  const [board, setBoard] = useState<ScopaBoard>(emptyBoard());
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState<{ id: number; kind: 'scopa' | 'sweep' } | null>(null);
  const [lastActor, setLastActor] = useState<0 | 1 | null>(null);

  const cancelRef = useRef<{ done: boolean }>({ done: false });
  const timersRef = useRef<number[]>([]);

  const odds = SCOPA_ODDS[market] ?? 2;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Replay the committed timeline (scheduling only — resets happen in placeBet).
  useEffect(() => {
    if (!round || reduced) return;
    const timeline = round.timeline;
    const cancel = { done: false };
    cancelRef.current = cancel;
    clearTimers();
    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(window.setTimeout(() => { if (!cancel.done) fn(); }, ms));
    };
    let i = 0;
    const run = () => {
      if (cancel.done) return;
      if (i >= timeline.length) {
        setPhase('scoring');
        for (let s = 1; s <= 5; s++) at(s * 130, () => setRevealed(s));
        at(5 * 130 + 160, () => setPhase('done'));
        return;
      }
      const ev = timeline[i++];
      setBoard((b) => applyEventTo(ev, b));
      if (ev.kind === 'move') {
        setLastActor(ev.player);
        if (ev.scopa) setFlash({ id: Date.now() + i, kind: 'scopa' });
        else if (ev.sweep) setFlash({ id: Date.now() + i, kind: 'sweep' });
      }
      at(ev.kind === 'deal' ? 70 : 175, run);
    };
    at(180, run);
    return () => {
      cancel.done = true;
      clearTimers();
    };
  }, [round, reduced, clearTimers]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const skip = useCallback(() => {
    if (!round) return;
    cancelRef.current.done = true;
    clearTimers();
    setBoard(finalBoard(round.timeline));
    setRevealed(5);
    setFlash(null);
    setPhase('done');
  }, [round, clearTimers]);

  const placeBet = useCallback(async () => {
    setRound(null);
    setFlash(null);
    setLastActor(null);
    const data = await place(betAmount, { market });
    if (!data) return;
    const payload = data.payload as ScopaPayload;
    if (reduced) {
      setBoard(finalBoard(payload.timeline));
      setRevealed(5);
      setPhase('done');
    } else {
      setBoard(emptyBoard());
      setRevealed(0);
      setPhase('dealing');
    }
    setRound(payload);
    setLastWon(data.won);
  }, [place, betAmount, market, reduced]);

  const done = phase === 'done';
  const playing = phase !== 'idle' && phase !== 'done';
  const remaining = round
    ? 40 - (board.hands[0].length + board.hands[1].length + board.table.length + board.piles[0].length + board.piles[1].length)
    : 40;

  const cells = round
    ? [
        { label: 'Carte', g: round.playerCardsCount, b: round.bankCardsCount, text: (v: number) => String(v) },
        { label: 'Denari', g: round.playerDenari, b: round.bankDenari, text: (v: number) => String(v) },
        { label: 'Settebello', g: round.playerSettebello ? 1 : 0, b: round.bankSettebello ? 1 : 0, text: (v: number) => (v ? '✓' : '—') },
        { label: 'Primiera', g: round.playerPrimiera, b: round.bankPrimiera, text: (v: number) => String(v) },
        { label: 'Scope', g: round.playerScopa, b: round.bankScopa, text: (v: number) => String(v) },
      ]
    : [];

  return (
    <GameFrame
      gameId="scopa"
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
          disabled={busy || playing}
          action={
            <BetButton
              onClick={placeBet}
              disabled={balance > 0 && (betAmount <= 0 || betAmount > balance)}
              busy={busy || playing}
              repeatable
            >
              {playing ? 'Giocando…' : `Punta ${marketLabel(market)} @ ${odds.toFixed(2)}×`}
            </BetButton>
          }
        >
          {MARKET_GROUPS.map((g) => (
            <SegmentedControl<ScopaMarket>
              key={g.title}
              label={g.title}
              value={market}
              onChange={setMarket}
              disabled={busy || playing}
              options={g.ids.map((id) => ({ value: id, label: marketLabel(id) }))}
            />
          ))}
          <div>
            <StatRow label="Quota" value={`${odds.toFixed(2)}×`} tone="lime" />
            <StatRow label="Vincita potenziale" value={`$${(betAmount * odds).toFixed(2)}`} tone="lime" />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className={cx('scopa-area', done && (lastWon ? 'win' : round?.outcome === 'draw' ? 'draw' : 'loss'))}>
        <div className="scopa-deck">
          <div className="scopa-deck-stack">
            <SicilianCardBack />
            <SicilianCardBack style={{ position: 'absolute', top: '0.1rem', left: '0.1rem', zIndex: 1 }} />
          </div>
          <span>× {remaining}</span>
        </div>
        {playing && !reduced && (
          <button onClick={skip} className="scopa-skip" aria-label="Salta animazione">
            <FastForward className="h-3 w-3" /> Salta
          </button>
        )}

        <div className="scopa-felt">
          {([0, 1] as const).map((side) => (
            <div key={`hand-${side}`} className={cx('scopa-hand-row', lastActor === side && playing && 'active')}>
              <span className="scopa-hand-name">{side === 0 ? 'Giocatore' : 'Banco'}</span>
              <div className="scopa-hand">
                {board.hands[side].map((c) => (
                  <ScopaCardFace key={scopaCardKey(c)} card={c} size="sm" layoutId={`scopa-${scopaCardKey(c)}`} />
                ))}
              </div>
            </div>
          ))}

          <div className="scopa-table">
            {([0, 1] as const).map((side) => (
              <div key={`pile-${side}`} className="scopa-pile">
                <span className="scopa-pile-name">{side === 0 ? 'Giocatore' : 'Banco'}</span>
                <div className="scopa-pile-stack">
                  {board.piles[side].map((c, i) => (
                    <ScopaCardFace
                      key={scopaCardKey(c)}
                      card={c}
                      size="sm"
                      layoutId={`scopa-${scopaCardKey(c)}`}
                      style={{ position: 'absolute', top: `${Math.min(i, 14) * 0.12}rem`, left: 0, zIndex: i }}
                    />
                  ))}
                </div>
                <span className="scopa-pile-count">{board.piles[side].length} carte</span>
              </div>
            ))}

            <div className="scopa-table-cards">
              {board.table.map((c) => (
                <ScopaCardFace key={scopaCardKey(c)} card={c} size="md" layoutId={`scopa-${scopaCardKey(c)}`} />
              ))}
            </div>
          </div>
        </div>

        {!round && (
          <div className="scopa-idle">
            <Swords className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span>{busy ? 'Piazzamento in corso…' : 'Scegli un mercato e piazza la scommessa'}</span>
          </div>
        )}

        <AnimatePresence>
          {flash && !done && (
            <motion.div key={flash.id} className="scopa-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                className={cx('scopa-flash-badge', flash.kind === 'sweep' && 'green')}
                style={{ animation: 'scopa-flash 0.8s ease forwards' }}
              >
                {flash.kind === 'scopa' ? 'SCOPA!' : 'RACCOLTA'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {done && round && (
            <motion.div className="scopa-outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                className={cx('scopa-outcome-title', lastWon ? 'win' : round.outcome === 'draw' ? 'draw' : 'loss')}
                style={{ animation: 'scopa-outcome-pop 0.5s cubic-bezier(0.16,1,0.3,1)' }}
              >
                {lastWon ? 'Vittoria' : round.outcome === 'draw' ? 'Pareggio' : 'Sconfitta'}
              </div>
              <div className="scopa-outcome-sub">
                Giocatore {round.playerPoints} · Banco {round.bankPoints} · {marketLabel(market)}
              </div>
              {lastWon && <div className="scopa-outcome-payout">+${(round.odds * betAmount).toFixed(2)}</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {round && (
        <div className="scopa-scoreboard">
          <ScorePanel
            name="Giocatore"
            points={round.playerPoints}
            cells={cells.map((c) => ({ label: c.label, value: c.text(c.g), win: c.g > c.b }))}
            winner={round.outcome === 'player'}
            revealed={revealed}
            done={done}
          />
          <ScorePanel
            name="Banco"
            points={round.bankPoints}
            cells={cells.map((c) => ({ label: c.label, value: c.text(c.b), win: c.b > c.g }))}
            winner={round.outcome === 'bank'}
            revealed={revealed}
            done={done}
          />
        </div>
      )}
    </GameFrame>
  );
}
