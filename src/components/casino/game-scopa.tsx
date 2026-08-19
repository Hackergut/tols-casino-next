'use client';

/*
 * Scopa Siciliana Fast Bet — public casino surface.
 *
 * The bet settles server-side in one request; the client then replays the
 * returned `timeline` (deal + move events) as a live auto-game: cards are
 * dealt, played from the two face-up hands, captured into the two piles, and
 * the five scoring categories tally up before the outcome banner. The replay
 * is purely cosmetic — the result was already decided — and the board state is
 * rebuilt with the pure reducer in `@/lib/scopa-playback` (no strategy
 * reimplementation, so it can never disagree with the server).
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Shield, ChevronDown, ChevronUp, FastForward, Swords, Trophy } from 'lucide-react';
import { GameBetControls } from '@/components/casino/game-shared';
import { SicilianCard, SicilianCardBack } from '@/components/casino/scopa-card';
import { SCOPA_MARKETS, SCOPA_ODDS, type ScopaMarket, type Card as ScopaCard, type ScopaEvent } from '@/lib/scopa';
import {
  applyEventTo,
  emptyBoard,
  finalBoard,
  scopaCardKey,
  type ScopaBoard,
} from '@/lib/scopa-playback';

interface Props { onBack: () => void; initialBalance: number; }

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

type RoundResult = { won: boolean; payout: number; payload: ScopaPayload };
type Phase = 'idle' | 'dealing' | 'playing' | 'scoring' | 'done';

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ');

const MARKET_GROUPS: { title: string; ids: ScopaMarket[] }[] = [
  { title: 'Esito 1X2', ids: ['player', 'bank', 'draw'] },
  { title: 'Totale punti', ids: ['over', 'under'] },
  { title: 'Settebello', ids: ['settebello_player', 'settebello_bank'] },
  { title: 'Scope', ids: ['scopa_over'] },
];

/* ── Card face. `layoutId` is what lets framer-motion fly a card between the
   hand, the table and the piles with a shared-element transition. The actual
   artwork is the authentic Sicilian deck in `SicilianCard`. ── */
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

/* ── Score panel (one per side) ── */
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
        {winner && done && <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--g-green)' }} />}
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

export function ScopaGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(5);
  const [market, setMarket] = useState<ScopaMarket>('player');
  const [betting, setBetting] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [board, setBoard] = useState<ScopaBoard>(emptyBoard());
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState<{ id: number; kind: 'scopa' | 'sweep' } | null>(null);
  const [lastActor, setLastActor] = useState<0 | 1 | null>(null);
  const [history, setHistory] = useState<Array<{ market: ScopaMarket; outcome: string; result: string; payout: number }>>([]);
  const [showPF, setShowPF] = useState(false);
  const [pfData, setPfData] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);

  const cancelRef = useRef<{ done: boolean }>({ done: false });
  const timersRef = useRef<number[]>([]);

  const odds = SCOPA_ODDS[market] ?? 2;
  const potentialPayout = betAmount * odds;
  const marketLabel = useMemo(() => SCOPA_MARKETS.find((m) => m.id === market)?.label ?? market, [market]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  /* ── Replay the returned timeline (scheduling only — state resets happen in
     `place`, and the timeline steps fire from timers, never synchronously). ── */
  useEffect(() => {
    if (!result || reduced) return;
    const timeline = result.payload.timeline;
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
  }, [result, reduced, clearTimers]);

  // Auto-dismiss the "Scopa!" / "Raccolta" flash.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  const skip = useCallback(() => {
    if (!result) return;
    cancelRef.current.done = true;
    clearTimers();
    setBoard(finalBoard(result.payload.timeline));
    setRevealed(5);
    setFlash(null);
    setPhase('done');
  }, [result, clearTimers]);

  const place = useCallback(async () => {
    if (betting || betAmount <= 0 || betAmount > balance) return;
    setBetting(true);
    setResult(null);
    setFlash(null);
    setLastActor(null);
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'scopa', amount: betAmount, payload: { market } }),
      });
      const data = await res.json();
      if (data.success) {
        const payload = data.data.payload as ScopaPayload;
        if (reduced) {
          setBoard(finalBoard(payload.timeline));
          setRevealed(5);
          setPhase('done');
        } else {
          setBoard(emptyBoard());
          setRevealed(0);
          setPhase('dealing');
        }
        setResult({ won: data.data.won, payout: data.data.payout, payload });
        setBalance(data.data.newBalance);
        setPfData({ serverSeedHash: data.data.serverSeedHash, clientSeed: data.data.clientSeed, nonce: data.data.nonce });
        setHistory((prev) =>
          [
            {
              market,
              outcome: payload.outcome === 'draw' ? 'Pareggio' : payload.outcome === 'player' ? 'Giocatore' : 'Banco',
              result: data.data.won ? 'win' : 'lose',
              payout: data.data.payout,
            },
            ...prev,
          ].slice(0, 15)
        );
      }
    } catch {
      /* connection errors are surfaced by the global GameFeedback wrapper */
    }
    setBetting(false);
  }, [betting, betAmount, balance, market, reduced]);

  const busy = betting || (phase !== 'idle' && phase !== 'done');
  const payload = result?.payload;
  const remaining = payload
    ? 40 - (board.hands[0].length + board.hands[1].length + board.table.length + board.piles[0].length + board.piles[1].length)
    : 40;

  const cells = payload
    ? [
        { label: 'Carte', g: payload.playerCardsCount, b: payload.bankCardsCount, text: (v: number) => String(v) },
        { label: 'Denari', g: payload.playerDenari, b: payload.bankDenari, text: (v: number) => String(v) },
        { label: 'Settebello', g: payload.playerSettebello ? 1 : 0, b: payload.bankSettebello ? 1 : 0, text: (v: number) => (v ? '✓' : '—') },
        { label: 'Primiera', g: payload.playerPrimiera, b: payload.bankPrimiera, text: (v: number) => String(v) },
        { label: 'Scope', g: payload.playerScopa, b: payload.bankScopa, text: (v: number) => String(v) },
      ]
    : [];

  return (
    <div className="game-wrapper compact-game">
      {/* Header */}
      <div className="g-header">
        <button onClick={onBack} className="g-back" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>
        <div><h1>Scopa Siciliana</h1><p>Fast Bet · partita automatica con strategia fissa, provably fair</p></div>
      </div>

      <div className="game-grid">
        {/* === GAME AREA === */}
        <div className="space-y-2">
          <div className={cx('scopa-area', phase === 'done' && (result?.won ? 'win' : payload?.outcome === 'draw' ? 'draw' : 'loss'))}>
            <div className="scopa-deck">
              <div className="scopa-deck-stack">
                <SicilianCardBack />
                <SicilianCardBack style={{ position: 'absolute', top: '0.1rem', left: '0.1rem', zIndex: 1 }} />
              </div>
              <span>× {remaining}</span>
            </div>
            {busy && !reduced && (
              <button onClick={skip} className="scopa-skip" aria-label="Salta animazione">
                <FastForward className="h-3 w-3" /> Salta
              </button>
            )}

            <div className="scopa-felt">
              {/* Giocatore hand */}
              <div className={cx('scopa-hand-row', lastActor === 0 && busy && 'active')}>
                <span className="scopa-hand-name">Giocatore</span>
                <div className="scopa-hand">
                  {board.hands[0].map((c) => (
                    <ScopaCardFace key={scopaCardKey(c)} card={c} size="sm" layoutId={`scopa-${scopaCardKey(c)}`} />
                  ))}
                </div>
              </div>

              {/* Table + piles */}
              <div className="scopa-table">
                <div className="scopa-pile">
                  <span className="scopa-pile-name">Giocatore</span>
                  <div className="scopa-pile-stack">
                    {board.piles[0].map((c, i) => (
                      <ScopaCardFace
                        key={scopaCardKey(c)}
                        card={c}
                        size="sm"
                        layoutId={`scopa-${scopaCardKey(c)}`}
                        style={{ position: 'absolute', top: `${Math.min(i, 14) * 0.12}rem`, left: 0, zIndex: i }}
                      />
                    ))}
                  </div>
                  <span className="scopa-pile-count">{board.piles[0].length} carte</span>
                </div>

                <div className="scopa-table-cards">
                  {board.table.map((c) => (
                    <ScopaCardFace key={scopaCardKey(c)} card={c} size="md" layoutId={`scopa-${scopaCardKey(c)}`} />
                  ))}
                </div>

                <div className="scopa-pile">
                  <span className="scopa-pile-name">Banco</span>
                  <div className="scopa-pile-stack">
                    {board.piles[1].map((c, i) => (
                      <ScopaCardFace
                        key={scopaCardKey(c)}
                        card={c}
                        size="sm"
                        layoutId={`scopa-${scopaCardKey(c)}`}
                        style={{ position: 'absolute', top: `${Math.min(i, 14) * 0.12}rem`, left: 0, zIndex: i }}
                      />
                    ))}
                  </div>
                  <span className="scopa-pile-count">{board.piles[1].length} carte</span>
                </div>
              </div>

              {/* Banco hand */}
              <div className={cx('scopa-hand-row', lastActor === 1 && busy && 'active')}>
                <span className="scopa-hand-name">Banco</span>
                <div className="scopa-hand">
                  {board.hands[1].map((c) => (
                    <ScopaCardFace key={scopaCardKey(c)} card={c} size="sm" layoutId={`scopa-${scopaCardKey(c)}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Idle hint */}
            {!result && (
              <div className="scopa-idle">
                <Swords className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span>{betting ? 'Piazzamento in corso…' : 'Scegli un mercato e piazza la scommessa'}</span>
              </div>
            )}

            {/* Flash overlay (Scopa! / Raccolta) */}
            <AnimatePresence>
              {flash && phase !== 'done' && (
                <motion.div
                  key={flash.id}
                  className="scopa-flash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className={cx('scopa-flash-badge', flash.kind === 'sweep' && 'green')}
                    style={{ animation: 'scopa-flash 0.8s ease forwards' }}
                  >
                    {flash.kind === 'scopa' ? 'SCOPA!' : 'RACCOLTA'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Outcome overlay */}
            <AnimatePresence>
              {phase === 'done' && payload && (
                <motion.div className="scopa-outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div
                    className={cx(
                      'scopa-outcome-title',
                      result?.won ? 'win' : payload.outcome === 'draw' ? 'draw' : 'loss'
                    )}
                    style={{ animation: 'scopa-outcome-pop 0.5s cubic-bezier(0.16,1,0.3,1)' }}
                  >
                    {result?.won ? 'Vittoria' : payload.outcome === 'draw' ? 'Pareggio' : 'Sconfitta'}
                  </div>
                  <div className="scopa-outcome-sub">
                    Giocatore {payload.playerPoints} · Banco {payload.bankPoints} · {marketLabel}
                  </div>
                  {result?.won && <div className="scopa-outcome-payout">+${result.payout.toFixed(2)}</div>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scoreboard */}
          {payload && (
            <div className="scopa-scoreboard">
              <ScorePanel
                name="Giocatore"
                points={payload.playerPoints}
                cells={cells.map((c) => ({ label: c.label, value: c.text(c.g), win: c.g > c.b }))}
                winner={payload.outcome === 'player'}
                revealed={revealed}
                done={phase === 'done'}
              />
              <ScorePanel
                name="Banco"
                points={payload.bankPoints}
                cells={cells.map((c) => ({ label: c.label, value: c.text(c.b), win: c.b > c.g }))}
                winner={payload.outcome === 'bank'}
                revealed={revealed}
                done={phase === 'done'}
              />
            </div>
          )}

          {/* Stats */}
          <div className="g-stats">
            <div className="g-stat"><p className="g-stat-label">Mercato</p><p className="g-stat-value" style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>{marketLabel}</p></div>
            <div className="g-stat"><p className="g-stat-label">Quota</p><p className="g-stat-value lime">{odds.toFixed(2)}×</p></div>
            <div className="g-stat"><p className="g-stat-label">RTP target</p><p className="g-stat-value">96%</p></div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="g-history">
              <div className="g-history-head">
                <h3 className="g-history-title">Round recenti</h3>
                <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1" style={{ color: 'var(--g-text-3)' }}><RotateCcw className="w-3 h-3" />Clear</button>
              </div>
              <div className="g-history-list">
                {history.map((h, i) => (
                  <div key={i} className="g-history-item">
                    <div className="flex items-center gap-2">
                      <span className={'g-history-badge ' + (h.result === 'win' ? 'win' : 'loss')}>{h.result}</span>
                      <span className="text-[11px]" style={{ color: 'var(--g-text-2)' }}>
                        {SCOPA_MARKETS.find((m) => m.id === h.market)?.label ?? h.market} → <span className="font-semibold" style={{ color: 'var(--g-text)' }}>{h.outcome}</span>
                      </span>
                    </div>
                    <span className={'text-[11px] font-bold tabular-nums ' + (h.result === 'win' ? 'text-[#00e701]' : 'text-[#ff3b3b]')} style={{ fontFamily: 'var(--g-mono)' }}>
                      {h.result === 'win' ? '+' : '-'}${h.payout.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provably Fair */}
          <div className="g-pf">
            <button onClick={() => setShowPF((v) => !v)} className="g-pf-toggle w-full">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: 'var(--g-green)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--g-text-2)' }}>Provably Fair</span>
              </div>
              {showPF ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} />}
            </button>
            {showPF && (
              <div className="g-pf-body">
                <div className="g-pf-row"><span className="g-pf-label">Server Seed Hash</span><span className="g-pf-val">{pfData ? pfData.serverSeedHash.slice(0, 20) + '...' : '—'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Client Seed</span><span className="g-pf-val">{pfData ? pfData.clientSeed : '—'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Nonce</span><span className="g-pf-val">{pfData ? pfData.nonce : '—'}</span></div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--g-text-3)' }}>
                  Ricalcola HMAC-SHA256(serverSeed, clientSeed:nonce:cursor), mescola il mazzo e rigioca la partita per verificare l'esito.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* === CONTROLS PANEL === */}
        <div className="space-y-2">
          <div className="g-balance">
            <p className="g-balance-label">Balance</p>
            <p className="g-balance-value">{balance.toFixed(2)}</p>
          </div>

          {/* Market picker */}
          <div className="g-panel p-3 space-y-2">
            {MARKET_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--g-text-3)' }}>{g.title}</p>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${g.ids.length}, minmax(0, 1fr))` }}>
                  {g.ids.map((id) => {
                    const m = SCOPA_MARKETS.find((x) => x.id === id);
                    return (
                      <button
                        key={id}
                        onClick={() => setMarket(id)}
                        disabled={busy}
                        className={'g-btn g-btn-toggle ' + (market === id ? 'active' : 'inactive')}
                        style={{ fontSize: '10px', padding: '0.35rem 0.25rem' }}
                      >
                        <span className="block truncate">{m?.label ?? id}</span>
                        <span className="block text-[9px] opacity-70">{SCOPA_ODDS[id]?.toFixed(2)}×</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={busy} />

          {/* Profit on win */}
          <div className="g-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--g-text-3)' }}>Vincita potenziale</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--g-green)', fontFamily: 'var(--g-mono)' }}>
                +{potentialPayout.toFixed(2)}
              </span>
            </div>
          </div>

          <button onClick={place} disabled={busy || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
            {busy ? 'Giocando...' : `Punta ${marketLabel} @ ${odds.toFixed(2)}×`}
          </button>
        </div>
      </div>
    </div>
  );
}
