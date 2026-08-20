'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow, SegmentedControl } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import { originalsAction, placeOriginalsBet } from "@/lib/originals-client";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

const MINE_OPTIONS = [1, 3, 5, 10, 15, 24] as const;

function GemIcon({ className }: { className?: string }) {
  return <img src="/games/props/gem.jpg" alt="" draggable={false} className={`mines-prop ${className ?? ""}`} />;
}

function BombIcon({ className }: { className?: string }) {
  return <img src="/games/props/mine.jpg" alt="" draggable={false} className={`mines-prop ${className ?? ""}`} />;
}

function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  const styles = {
    left: `${x}%`,
    animationDelay: `${delay}ms`,
    backgroundColor: color,
  } as React.CSSProperties;
  return <div className="mines-confetti-particle" style={styles} />;
}

export function MinesGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet("mines", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);
  const reduced = useReducedMotion();

  const [mineCount, setMineCount] = useState(3);
  const [phase, setPhase] = useState<'betting' | 'playing' | 'done'>('betting');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [mines, setMines] = useState<Set<number>>(new Set());
  const [payout, setPayout] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(0);
  const [displayMultiplier, setDisplayMultiplier] = useState(0);
  const [result, setResult] = useState<null | { won: boolean; payout: number; hitMine: boolean }>(null);
  const [shaking, setShaking] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const roundIdRef = useRef<string | null>(null);

  const currentPicks = useMemo(() => Array.from(revealed), [revealed]);

  const mineMultiplier = useMemo(() => {
    if (phase !== 'playing') return 0;
    let m = 1;
    for (let i = 0; i < currentPicks.length; i++) {
      m *= (25 - i) / (25 - mineCount - i);
    }
    return Math.max(1, m * 0.99);
  }, [currentPicks, mineCount, phase]);

  useEffect(() => {
    if (phase !== 'playing') { setDisplayMultiplier(currentMultiplier); return; }
    const target = currentMultiplier;
    const start = displayMultiplier;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) { setDisplayMultiplier(target); return; }
    const duration = 400;
    const startTime = performance.now();
    let raf: number;
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMultiplier(start + diff * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [currentMultiplier, phase]); // eslint-disable-line

  const multiplierProgress = useMemo(() => {
    if (displayMultiplier <= 1) return 0;
    const maxExpected = mineCount <= 5 ? 50 : mineCount <= 15 ? 20 : 10;
    return Math.min((displayMultiplier - 1) / (maxExpected - 1), 1);
  }, [displayMultiplier, mineCount]);

  const startGame = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance) return;
    setRevealed(new Set());
    setMines(new Set());
    setPayout(0);
    setCurrentMultiplier(0);
    setDisplayMultiplier(0);
    setResult(null);
    setGameKey(k => k + 1);
    try {
      const data = await placeOriginalsBet('mines', betAmount, { mines: mineCount, tilesToReveal: 3 }, 'start');
      roundIdRef.current = data.roundId ?? null;
      // Use the balance from useBet's store
      setPhase('playing');
    } catch { /* ignore */ }
  }, [betAmount, balance, mineCount]);

  const revealTile = useCallback(async (idx: number) => {
    if (phase !== 'playing' || revealed.has(idx) || !roundIdRef.current) return;
    try {
      const data = await originalsAction('mines', roundIdRef.current, { type: 'reveal', cellIndex: idx });
      const payload = data.payload as { picks?: number[]; layout?: boolean[]; multiplier?: number };
      const picks = payload.picks ?? [];
      setRevealed(new Set(picks.filter((p) => !(payload.layout && payload.layout[p]))));
      if (payload.layout) {
        const minePositions = new Set<number>();
        payload.layout.forEach((m, i) => { if (m) minePositions.add(i); });
        setMines(minePositions);
      }
      const mult = Number(payload.multiplier ?? data.multiplier ?? 0);
      setCurrentMultiplier(mult);
      setPayout(betAmount * mult);

      if (!data.pending) {
        setPhase('done');
        if (!data.won) {
          setRevealed(new Set(picks));
          setResult({ won: false, payout: 0, hitMine: true });
          setShaking(true);
          setRedFlash(true);
          setTimeout(() => setShaking(false), 500);
          setTimeout(() => setRedFlash(false), 600);
        } else {
          setResult({ won: true, payout: data.payout, hitMine: false });
        }
      }
    } catch { /* ignore */ }
  }, [phase, revealed, betAmount, mineCount]);

  const cashOut = useCallback(async () => {
    if (phase !== 'playing' || revealed.size === 0 || !roundIdRef.current) return;
    try {
      const data = await originalsAction("mines", roundIdRef.current, { type: "cashout" });
      const payload = data.payload as { layout?: boolean[] };
      if (payload.layout) {
        const minePositions = new Set<number>();
        payload.layout.forEach((m, i) => { if (m) minePositions.add(i); });
        setMines(minePositions);
      }
      setPhase('done');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      setResult({ won: true, payout: data.payout, hitMine: false });
      setPayout(data.payout);
    } catch { /* ignore */ }
  }, [phase, revealed, mineCount, currentPicks]);

  const reset = useCallback(() => {
    setPhase('betting');
    setRevealed(new Set());
    setMines(new Set());
    setPayout(0);
    setCurrentMultiplier(0);
    setDisplayMultiplier(0);
    setResult(null);
    setShowConfetti(false);
  }, []);

  const confettiColors = ['var(--color-lime)', 'var(--color-win)', 'var(--color-pending)', '#c2e600', '#ff8a5c', '#f0c04a'];

  return (
    <GameFrame
      gameId="mines"
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
              <BetButton
                onClick={startGame}
                disabled={betAmount <= 0 || betAmount > balance || busy}
                busy={busy}
              >
                Start Game
              </BetButton>
            ) : phase === 'playing' ? (
              <BetButton
                onClick={cashOut}
                disabled={revealed.size === 0}
                tone="danger"
              >
                Cash Out ${(betAmount * displayMultiplier).toFixed(2)}
              </BetButton>
            ) : (
              <BetButton onClick={reset}>Play Again</BetButton>
            )
          }
        >
          {/* Mine Count */}
          {phase === 'betting' && (
            <SegmentedControl
              label="Mines"
              options={MINE_OPTIONS.map(v => ({ value: v, label: String(v) }))}
              value={mineCount}
              onChange={setMineCount}
              disabled={phase !== 'betting'}
            />
          )}

          {/* Current Multiplier (playing) */}
          {phase === 'playing' && (
            <>
              <StatRow label="Current Multiplier" value={`${displayMultiplier.toFixed(2)}×`} tone="lime" />
              <StatRow label="Potential" value={`$${(betAmount * displayMultiplier).toFixed(2)}`} tone="lime" />
              <div className="tols-stat">
                <span>Progress</span>
                <span>{revealed.size} tiles / {mineCount} mines</span>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <StatRow
              label={result.won ? "Won" : "Lost"}
              value={result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
              tone={result.won ? "lime" : "muted"}
            />
          )}

          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      {/* Red Flash Overlay */}
      {redFlash && !reduced && (
        <div
          className="mines-red-flash-overlay fixed inset-0 z-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--loss) 40%, transparent), color-mix(in srgb, var(--loss) 10%, transparent))' }}
        />
      )}

      {/* Confetti */}
      {showConfetti && !reduced && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 50} x={10 + Math.random() * 80} color={confettiColors[i % confettiColors.length]} />
          ))}
        </div>
      )}

      <div className={shaking && !reduced ? 'mines-screen-shake' : ''}>
        <div className="mines">
          {/* Result Banner */}
          {result && (
            <p className="mines__verdict" data-won={result.won || undefined}>
              {result.won ? `✓ Cashed out! +$${result.payout.toFixed(2)}` : '✕ BOOM! Hit a mine!'}
            </p>
          )}

          {/* 5x5 Grid */}
          <div className="mines__grid">
            {Array.from({ length: 25 }).map((_, i) => {
              const isRevealed = revealed.has(i);
              const isMine = mines.has(i);
              const showMine = (phase === 'done' && isMine);
              const hitMine = isRevealed && isMine;
              const showSafe = isRevealed && !isMine;
              const flipped = showSafe || hitMine || showMine;
              const row = Math.floor(i / 5);
              const col = i % 5;
              const cascadeDelay = showMine && !hitMine ? row * 0.05 + col * 0.03 : 0;

              return (
                <button
                  key={`${gameKey}-${i}`}
                  onClick={() => revealTile(i)}
                  disabled={phase !== 'playing' || isRevealed}
                  className={`mines__tile ${!isRevealed && phase === 'playing' ? 'cursor-pointer' : ''}`}
                  aria-label={`Tile ${i + 1}`}
                  data-picked={showSafe || undefined}
                  data-safe={(showSafe && !isRevealed) || undefined}
                  data-boom={(hitMine) || undefined}
                  data-mine={(showMine && !hitMine) || undefined}
                >
                  <motion.div
                    className="relative h-full w-full [transform-style:preserve-3d]"
                    initial={false}
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={skipAnim ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 30, delay: cascadeDelay }}
                  >
                    {/* cover */}
                    <div className="absolute inset-0 rounded-xl [backface-visibility:hidden]"
                      style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    />
                    {/* value face */}
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
                      style={
                        hitMine
                          ? { background: 'color-mix(in srgb, var(--loss) 35%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 50%, transparent)' }
                          : showMine
                            ? { background: 'color-mix(in srgb, var(--loss) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 25%, transparent)' }
                            : { background: 'color-mix(in oklab, var(--color-win) 25%, transparent)', border: '1px solid color-mix(in oklab, var(--color-win) 40%, transparent)' }
                      }
                    >
                      {showSafe && <GemIcon />}
                      {(hitMine || showMine) && <BombIcon />}
                      {/* sparkles */}
                      {showSafe && !skipAnim && (
                        <span className="pointer-events-none absolute inset-0">
                          {[0, 1, 2, 3, 4, 5].map(k => (
                            <motion.span
                              key={k}
                              className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
                              style={{ background: 'var(--color-lime)' }}
                              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                              animate={{ x: Math.cos((k * Math.PI) / 3) * 26, y: Math.sin((k * Math.PI) / 3) * 26, opacity: 0, scale: 0.4 }}
                              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
                            />
                          ))}
                        </span>
                      )}
                      {/* bomb shockwave */}
                      {hitMine && !skipAnim && (
                        <motion.span
                          className="pointer-events-none absolute inset-0 m-auto h-4 w-4 rounded-full border-2"
                          style={{ borderColor: 'var(--loss)' }}
                          initial={{ scale: 0.4, opacity: 1 }}
                          animate={{ scale: 5, opacity: 0 }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                        />
                      )}
                    </div>
                  </motion.div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
