'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';

/* ═══════════════════════════════════════════════════════════════════════
   Shared TOLS Original Game Components
   Eliminates ~300 lines of duplicated UI across 9 game files.
   ═══════════════════════════════════════════════════════════════════════ */

// ── Game Header ─────────────────────────────────────────────────────────
export function GameHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="g-header">
      <button onClick={onBack} className="g-back" aria-label="Back">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

// ── Game Balance ───────────────────────────────────────────────────────
export function GameBalance({ value }: { value: number }) {
  return (
    <div className="g-balance">
      <p className="g-balance-label">Balance</p>
      <PostedAmount value={value} format={(n) => `$${n.toFixed(2)}`} className="g-balance-value" />
    </div>
  );
}

// ── Quick Bet Buttons ──────────────────────────────────────────────────
const QUICK_BETS = [1, 5, 10, 50, 100];

// ── useGameBet Hook ───────────────────────────────────────────────────
// Centralized bet state management — clamp, step, scale, all in one place.
export function useGameBet(initial: number, max: number) {
  const [bet, setBet] = useState(initial);
  const maxRef = useRef(max);
  maxRef.current = max;

  const set = useCallback((v: number) => {
    setBet(Math.max(0, Math.min(maxRef.current, Math.floor(v))));
  }, []);

  const step = useCallback((delta: number) => {
    setBet((prev) => Math.max(0, Math.min(maxRef.current, Math.floor(prev + delta))));
  }, []);

  const scale = useCallback((factor: number) => {
    setBet((prev) => Math.max(0, Math.min(maxRef.current, Math.floor(prev * factor))));
  }, []);

  const setMax = useCallback(() => setBet(maxRef.current), []);
  const setMin = useCallback(() => setBet(1), []);

  return { bet, set, step, scale, setMax, setMin };
}

// ── Game Bet Controls v2 ──────────────────────────────────────────────
// Optimized: slider + step buttons + scale buttons + quick chips.
// One component, used by all games — no per-game reimplementation.
const BET_CHIPS = [1, 5, 10, 50, 100];
const BET_STEPS = [-100, -10, 10, 100];

export function GameBetControls({
  betAmount,
  setBetAmount,
  balance,
  disabled,
}: {
  betAmount: number;
  setBetAmount: (v: number) => void;
  balance: number;
  disabled?: boolean;
}) {
  const clamp = useCallback((v: number) => Math.max(0, Math.min(balance, Math.floor(v))), [balance]);
  const handleSet = useCallback((v: number) => setBetAmount(clamp(v)), [clamp, setBetAmount]);
  const handleStep = useCallback((delta: number) => setBetAmount(clamp(betAmount + delta)), [betAmount, clamp, setBetAmount]);
  const handleScale = useCallback((factor: number) => setBetAmount(clamp(betAmount * factor)), [betAmount, clamp, setBetAmount]);

  // Slider: map bet to 0-100 range, log scale for better low-end resolution
  const sliderValue = balance > 0 ? Math.min(100, Math.round((betAmount / balance) * 100)) : 0;
  const handleSlider = useCallback((pct: number) => {
    const val = Math.max(1, Math.floor((pct / 100) * balance));
    setBetAmount(clamp(val));
  }, [balance, clamp, setBetAmount]);

  return (
    <div className="game-bet-panel-v2">
      {/* Quick chips */}
      <div className="game-bet-chips">
        {BET_CHIPS.map((v) => (
          <button
            key={v}
            onClick={() => handleSet(v)}
            disabled={disabled || v > balance}
            className={`game-bet-chip ${betAmount === v ? 'active' : ''}`}
          >
            ${v}
          </button>
        ))}
      </div>

      {/* Main bet display (editable) */}
      <div className="game-bet-display">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => handleSet(Number(e.target.value))}
          className="game-bet-amount"
          disabled={disabled}
          aria-label="Bet amount"
        />
      </div>

      {/* Scale buttons: ¼ ½ 2× 4× Max */}
      <div className="game-bet-scale-row">
        <button onClick={() => handleScale(0.25)} disabled={disabled} className="game-bet-scale-btn">¼</button>
        <button onClick={() => handleScale(0.5)} disabled={disabled} className="game-bet-scale-btn">½</button>
        <button onClick={() => handleScale(2)} disabled={disabled} className="game-bet-scale-btn">2×</button>
        <button onClick={() => handleScale(4)} disabled={disabled} className="game-bet-scale-btn">4×</button>
        <button onClick={() => handleSet(balance)} disabled={disabled} className="game-bet-scale-btn max">Max</button>
      </div>

      {/* Step buttons: -100 -10 +10 +100 */}
      <div className="game-bet-step-row">
        {BET_STEPS.map((s) => (
          <button
            key={s}
            onClick={() => handleStep(s)}
            disabled={disabled || (s < 0 && betAmount + s < 0) || (s > 0 && betAmount + s > balance)}
            className="game-bet-step-btn"
          >
            {s > 0 ? '+' : ''}{s}
          </button>
        ))}
      </div>

      {/* Slider for quick scaling */}
      <div className="game-bet-slider-row">
        <span className="text-[10px] text-muted-foreground/50">Min</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(e) => handleSlider(Number(e.target.value))}
          className="game-bet-slider"
          disabled={disabled}
          aria-label="Bet scale"
        />
        <span className="text-[10px] text-muted-foreground/50">Max</span>
      </div>
    </div>
  );
}

// ── Game Stats Grid ────────────────────────────────────────────────────
export function GameStats({
  stats,
}: {
  stats: { label: string; value: string; lime?: boolean }[];
}) {
  return (
    <div className="game-stats-grid">
      {stats.map((s) => (
        <div key={s.label} className="game-stat">
          <p className="game-stat-label">{s.label}</p>
          <p className={`game-stat-value ${s.lime ? 'game-stat-value-lime' : ''}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Game Action Button ─────────────────────────────────────────────────
export function GameActionButton({
  onClick,
  disabled,
  children,
  variant = 'primary',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const reduced = useReducedMotion();
  if (variant === 'secondary') {
    return (
      <button onClick={onClick} disabled={disabled} className="g-btn g-btn-secondary">
        {children}
      </button>
    );
  }
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className="g-btn g-btn-play"
    >
      {children}
    </motion.button>
  );
}

// ── Provably Fair Panel ────────────────────────────────────────────────
export function GameProvablyFair({
  data,
}: {
  data: { serverSeedHash: string; clientSeed: string; nonce: number } | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="game-pf-panel">
      <button onClick={() => setShow((v) => !v)} className="game-pf-header w-full">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-lime)' }} />
          <span className="text-sm font-semibold" style={{ color: 'oklch(from var(--foreground) l c h / 0.7)' }}>
            Provably Fair
          </span>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {show && (
        <div className="game-pf-body">
          <div className="game-pf-row">
            <span className="game-pf-label">Server Seed Hash</span>
            <span className="game-pf-value">{data ? data.serverSeedHash.slice(0, 20) + '...' : '—'}</span>
          </div>
          <div className="game-pf-row">
            <span className="game-pf-label">Client Seed</span>
            <span className="game-pf-value">{data ? data.clientSeed : '—'}</span>
          </div>
          <div className="game-pf-row">
            <span className="game-pf-label">Nonce</span>
            <span className="game-pf-value">{data ? data.nonce : '—'}</span>
          </div>
          <button className="game-pf-verify-btn btn-press">Verify</button>
        </div>
      )}
    </div>
  );
}

// ── Game History ──────────────────────────────────────────────────────
export function GameHistory<T extends { id?: string; result: string; payout: number }>({
  items,
  emptyText = 'No bets yet',
  formatItem,
}: {
  items: T[];
  emptyText?: string;
  formatItem: (item: T) => { badge: string; detail: string; payout: string; win: boolean };
}) {
  const [list, setList] = useState(items);
  // Sync external items with internal state for clear button
  React.useEffect(() => setList(items), [items]);

  if (list.length === 0) return null;

  return (
    <div className="game-history">
      <div className="flex items-center justify-between mb-3">
        <h3 className="game-history-title">Bet History</h3>
        <button
          onClick={() => setList([])}
          className="text-xs flex items-center gap-1 transition-colors hover:text-foreground/60"
          style={{ color: 'oklch(from var(--muted-foreground) l c h / 0.4)' }}
        >
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      </div>
      <div className="game-history-list">
        <AnimatePresence initial={false}>
          {list.map((item, i) => {
            const f = formatItem(item);
            return (
              <motion.div
                key={item.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="game-history-item"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`game-history-badge ${f.win ? 'game-history-badge-win' : 'game-history-badge-loss'}`}>
                    {f.badge}
                  </span>
                  <span className="text-xs" style={{ color: 'oklch(from var(--muted-foreground) l c h / 0.5)' }}>
                    {f.detail}
                  </span>
                </div>
                <span className={`game-history-payout ${f.win ? 'text-win' : 'text-loss'}`}>
                  {f.win ? '+' : '-'}{f.payout}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── History Badges (crash-style multiplier badges) ────────────────────
export function GameHistoryBadges({
  items,
  formatValue,
}: {
  items: { multiplier: number }[];
  formatValue: (v: number) => string;
}) {
  const reduced = useReducedMotion();
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">History:</span>
      <AnimatePresence initial={false}>
        {items.map((h, i) => {
          const cls =
            h.multiplier < 2
              ? 'game-history-badge-low'
              : h.multiplier < 5
                ? 'game-history-badge-mid'
                : 'game-history-badge-high';
          return (
            <motion.span
              key={`${h.multiplier}-${i}`}
              initial={reduced ? false : { opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className={`rounded-md border px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${cls}`}
            >
              {formatValue(h.multiplier)}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Game Layout Wrapper ───────────────────────────────────────────────
export function GameLayout({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="game-wrapper compact-game">
      <GameHeader title={title} subtitle={subtitle} onBack={onBack} />
      {children}
    </div>
  );
}

// ── Game Controls Panel (right sidebar) ──────────────────────────────
export function GameControlsPanel({
  balance,
  betAmount,
  setBetAmount,
  disabled,
  stats,
  actionButton,
  extraControls,
}: {
  balance: number;
  betAmount: number;
  setBetAmount: (v: number) => void;
  disabled?: boolean;
  stats?: { label: string; value: string; lime?: boolean }[];
  actionButton: React.ReactNode;
  extraControls?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <GameBalance value={balance} />
      {stats && <GameStats stats={stats} />}
      <GameBetControls
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        balance={balance}
        disabled={disabled}
      />
      {extraControls}
      {actionButton}
    </div>
  );
}
