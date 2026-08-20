'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { GameFrame, BetPanel, BetButton, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import { placeOriginalsBet } from "@/lib/originals-client";
import { KENO_TABLES } from "@/lib/game-engines/tables";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface KenoPayload {
  drawn: number[];
  hits: number;
}

const PAYOUT_TABLE = KENO_TABLES.classic;

function DrawBall({ number, isHit, delay }: { number: number; isHit: boolean; delay: number }) {
  return (
    <div
      className="keno-ball-art flex items-center justify-center rounded-full font-bold text-xs"
      style={{
        width: 32, height: 32,
        border: isHit ? '1.5px solid var(--color-lime)' : '1px solid transparent',
        color: isHit ? 'var(--color-lime)' : '#fff',
        animation: 'keno-ball-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ' + delay + 'ms both',
        boxShadow: isHit ? '0 0 12px color-mix(in oklab, var(--color-lime) 40%, transparent)' : 'none',
      }}
    >{number}</div>
  );
}

function HitRing({ hits, total }: { hits: number; total: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? hits / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg viewBox="0 0 68 68" className="w-16 h-16">
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="34" cy="34" r={r} fill="none"
        stroke={pct > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.1)'}
        strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
      />
      <text x="34" y="31" textAnchor="middle" fill={pct > 0 ? 'var(--color-pending)' : 'rgba(255,255,255,0.4)'} fontSize="14" fontWeight="800">{hits}</text>
      <text x="34" y="43" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="500">/{total}</text>
    </svg>
  );
}

export function KenoGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<KenoPayload>("keno", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [drawnOrder, setDrawnOrder] = useState<number[]>([]);
  const [phase, setPhase] = useState<'betting' | 'drawing' | 'done'>('betting');
  const [result, setResult] = useState<null | { won: boolean; payout: number; hits: number }>(null);
  const [currentDrawBall, setCurrentDrawBall] = useState<number | null>(null);

  const hits = useMemo(() => {
    if (drawn.size === 0) return 0;
    let count = 0;
    selected.forEach(n => { if (drawn.has(n)) count++; });
    return count;
  }, [selected, drawn]);

  const potentialMultiplier = useMemo(() => {
    const table = PAYOUT_TABLE[selected.size];
    if (!table || selected.size === 0) return 0;
    return table[Math.min(hits, table.length - 1)] || 0;
  }, [selected.size, hits]);

  const toggleNumber = useCallback((n: number) => {
    if (phase !== 'betting') return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < 10) next.add(n);
      return next;
    });
  }, [phase]);

  const play = useCallback(async () => {
    if (selected.size < 1 || betAmount <= 0 || betAmount > balance) return;
    setPhase('drawing');
    setResult(null);
    setDrawn(new Set());
    setDrawnOrder([]);
    try {
      const data = await place(betAmount, { picks: Array.from(selected), risk: "classic" });
      if (!data) { setPhase('betting'); return; }
      const arr = (data.payload.drawn ?? []).slice(0, 10);
      if (skipAnim) {
        setDrawn(new Set(arr));
        setDrawnOrder(arr);
      } else {
        for (let i = 0; i < arr.length; i++) {
          setCurrentDrawBall(arr[i]);
          await new Promise(r => setTimeout(r, 120));
          setDrawn(prev => new Set([...prev, arr[i]]));
          setDrawnOrder(prev => [...prev, arr[i]]);
        }
      }
      setCurrentDrawBall(null);
      const hitCount = Number(data.payload.hits ?? 0);
      setPhase('done');
      setResult({ won: data.won, payout: data.payout, hits: hitCount });
    } catch { setPhase('betting'); }
  }, [selected, betAmount, balance, skipAnim, place]);

  const reset = useCallback(() => {
    setPhase('betting');
    setSelected(new Set());
    setDrawn(new Set());
    setDrawnOrder([]);
    setResult(null);
    setCurrentDrawBall(null);
  }, []);

  const currentPayoutRow = result ? hits : -1;

  return (
    <GameFrame
      gameId="keno"
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
          disabled={phase !== 'betting' || busy}
          action={
            phase === 'betting' ? (
              <BetButton onClick={play} disabled={selected.size < 1 || betAmount <= 0 || betAmount > balance || busy} busy={busy}>
                Play Keno
              </BetButton>
            ) : phase === 'drawing' ? (
              <div className="tols-btn" data-tone="primary" data-busy style={{ opacity: 0.7, cursor: 'wait' }}>
                Drawing Numbers...
              </div>
            ) : (
              <BetButton onClick={reset}>Play Again</BetButton>
            )
          }
        >
          <StatRow label="Selected" value={`${selected.size}/10`} />
          {(phase === 'drawing' || phase === 'done') && (
            <StatRow label="Hits" value={`${hits}/${selected.size}`} tone={hits > 0 ? "lime" : "muted"} />
          )}
          {phase === 'done' && potentialMultiplier > 0 && (
            <StatRow label="Multiplier" value={`${potentialMultiplier}×`} tone="lime" />
          )}
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="keno">
        {/* Drawn balls strip */}
        {(phase === 'drawing' || (phase === 'done' && drawnOrder.length > 0)) && (
          <div className="w-full tols-note">
            <div className="flex items-center gap-2 mb-2">
              {phase === 'drawing' && currentDrawBall && (
                <div className="keno-ball-art keno-bounce w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ color: 'var(--color-lime)' }}
                >{currentDrawBall}</div>
              )}
              <span className="text-xs font-medium">
                {phase === 'drawing' ? `Drawing ${drawnOrder.length}/10...` : `Drawn ${drawnOrder.length}/10`}
              </span>
              <span className="text-xs ml-auto">Hits: <span className={hits > 0 ? 'text-lime' : ''}>{hits}/{selected.size}</span></span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {drawnOrder.map((n, i) => <DrawBall key={n} number={n} isHit={selected.has(n)} delay={i * 15} />)}
            </div>
          </div>
        )}

        {/* 40-number grid */}
        <div className="keno__grid">
          {Array.from({ length: 40 }, (_, i) => i + 1).map(n => {
            const isSelected = selected.has(n);
            const isDrawn = drawn.has(n);
            const isHit = isSelected && isDrawn;
            return (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                disabled={phase !== 'betting'}
                className="keno__cell"
                data-picked={isSelected || undefined}
                data-hit={isHit || undefined}
                data-drawn={isDrawn && !isSelected || undefined}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Payout table */}
        {selected.size > 0 && (
          <div className="w-full tols-note">
            <p className="text-xs font-medium mb-2 opacity-50">Payout Table ({selected.size} picks)</p>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {Array.from({ length: selected.size + 1 }, (_, i) => i).map(h => {
                const table = PAYOUT_TABLE[selected.size];
                const m = table ? table[h] || 0 : 0;
                const isHighlighted = phase === 'done' && h === currentPayoutRow;
                return (
                  <div key={h} className="tols-stat" style={isHighlighted ? { background: 'color-mix(in oklab, var(--color-pending) 12%, transparent)', borderRadius: 8, padding: '4px 8px' } : {}}>
                    <span style={{ color: isHighlighted ? '#fff' : undefined }}>{h} hit{h !== 1 ? 's' : ''}</span>
                    <span data-tone={m > 0 ? "lime" : "muted"}>{m > 0 ? `${m}×` : '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
