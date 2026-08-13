'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';

/* ═══════════════════════════════════════════════════════════════════════
   Shared TOLS Original Game Components
   Neon-Glassmorphism Design System v2
   ═══════════════════════════════════════════════════════════════════════ */

// ── Neon glow presets ──
const NEON = {
  lime: '0 0 12px rgba(204,255,0,0.4), 0 0 40px rgba(204,255,0,0.1)',
  limeSubtle: '0 0 8px rgba(204,255,0,0.2)',
  win: '0 0 12px rgba(0,255,102,0.4), 0 0 40px rgba(0,255,102,0.1)',
  loss: '0 0 12px rgba(255,51,102,0.4), 0 0 40px rgba(255,51,102,0.1)',
};

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
    <div className="game-header">
      <button onClick={onBack} className="game-back-btn btn-press group" aria-label="Back">
        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
      </button>
      <div>
        <h1 className="font-display">{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

// ── Game Balance ───────────────────────────────────────────────────────
export function GameBalance({ value }: { value: number }) {
  return (
    <div className="game-balance" style={{ background: 'rgba(22,22,26,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
      <p className="game-balance-label">Balance</p>
      <PostedAmount value={value} format={(n) => `$${n.toFixed(2)}`} className="game-balance-value" />
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

// ── Game Bet Controls v2 (Glassmorphism + Neon) ───────────────────────
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

  const sliderValue = balance > 0 ? Math.min(100, Math.round((betAmount / balance) * 100)) : 0;
  const handleSlider = useCallback((pct: number) => {
    const val = Math.max(1, Math.floor((pct / 100) * balance));
    setBetAmount(clamp(val));
  }, [balance, clamp, setBetAmount]);

  return (
    <div className="game-bet-panel-v2" style={{ background: 'rgba(22,22,26,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
      {/* Quick chips — neon active state */}
      <div className="game-bet-chips">
        {BET_CHIPS.map((v) => (
          <button
            key={v}
            onClick={() => handleSet(v)}
            disabled={disabled || v > balance}
            className={`game-bet-chip ${betAmount === v ? 'active' : ''}`}
            style={betAmount === v ? { boxShadow: NEON.limeSubtle, borderColor: 'rgba(204,255,0,0.5)', color: '#ccff00' } : undefined}
          >
            ${v}
          </button>
        ))}
      </div>

      {/* Main bet display */}
      <div className="game-bet-display" style={{ background: 'rgba(15,16,21,0.8)', borderRadius: '12px', border: '1px solid rgba(204,255,0,0.15)' }}>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => handleSet(Number(e.target.value))}
          className="game-bet-amount"
          disabled={disabled}
          aria-label="Bet amount"
          style={{ color: '#ccff00', textShadow: '0 0 8px rgba(204,255,0,0.3)' }}
        />
      </div>

      {/* Scale buttons: ¼ ½ 2× 4× Max — glassmorphism pill */}
      <div className="game-bet-scale-row">
        <button onClick={() => handleScale(0.25)} disabled={disabled} className="game-bet-scale-btn">¼</button>
        <button onClick={() => handleScale(0.5)} disabled={disabled} className="game-bet-scale-btn">½</button>
        <button onClick={() => handleScale(2)} disabled={disabled} className="game-bet-scale-btn">2×</button>
        <button onClick={() => handleScale(4)} disabled={disabled} className="game-bet-scale-btn">4×</button>
        <button onClick={() => handleSet(balance)} disabled={disabled} className="game-bet-scale-btn max" style={{ color: '#ccff00', borderColor: 'rgba(204,255,0,0.3)' }}>Max</button>
      </div>

      {/* Step buttons */}
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

      {/* Slider — neon lime track */}
      <div className="game-bet-slider-row">
        <span className="text-[10px] text-white/30">Min</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(e) => handleSlider(Number(e.target.value))}
          className="game-bet-slider"
          disabled={disabled}
          aria-label="Bet scale"
          style={{ accentColor: '#ccff00' }}
        />
        <span className="text-[10px] text-white/30">Max</span>
      </div>
    </div>
  );
}

// ── Game Stats Grid (Glassmorphism) ────────────────────────────────────
export function GameStats({
  stats,
}: {
  stats: { label: string; value: string; lime?: boolean }[];
}) {
  return (
    <div className="game-stats-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: '8px' }}>
      {stats.map((s) => (
        <div key={s.label} className="game-stat" style={{ background: 'rgba(22,22,26,0.55)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 12px' }}>
          <p className="game-stat-label" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
          <p className={`game-stat-value`} style={s.lime ? { color: '#ccff00', textShadow: '0 0 8px rgba(204,255,0,0.4)', fontFamily: 'var(--g-mono)', fontWeight: 700 } : { color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--g-mono)', fontWeight: 700 }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Game Action Button (Neon Glow) ─────────────────────────────────────
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
      <button onClick={onClick} disabled={disabled} className="game-action-btn-secondary btn-press" style={{ background: 'rgba(22,22,26,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}>
        {children}
      </button>
    );
  }
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      whileHover={reduced ? undefined : { boxShadow: '0 0 24px rgba(204,255,0,0.5), 0 0 60px rgba(204,255,0,0.15)' }}
      className="game-action-btn"
      style={{ boxShadow: disabled ? 'none' : NEON.lime, transition: 'box-shadow 0.2s ease' }}
    >
      {children}
    </motion.button>
  );
}

// ── Provably Fair Panel (Glassmorphism) ────────────────────────────────
export function GameProvablyFair({
  data,
}: {
  data: { serverSeedHash: string; clientSeed: string; nonce: number } | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="game-pf-panel" style={{ background: 'rgba(22,22,26,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={() => setShow((v) => !v)} className="game-pf-header w-full" style={{ padding: '12px 14px' }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#ccff00', filter: 'drop-shadow(0 0 4px rgba(204,255,0,0.4))' }} />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Provably Fair
          </span>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="game-pf-body"
            style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="space-y-2 pt-3">
              <div className="game-pf-row flex justify-between">
                <span className="text-[11px] text-white/40">Server Seed Hash</span>
                <span className="text-[11px] font-mono text-white/60">{data ? data.serverSeedHash.slice(0, 20) + '...' : '—'}</span>
              </div>
              <div className="game-pf-row flex justify-between">
                <span className="text-[11px] text-white/40">Client Seed</span>
                <span className="text-[11px] font-mono text-white/60">{data ? data.clientSeed : '—'}</span>
              </div>
              <div className="game-pf-row flex justify-between">
                <span className="text-[11px] text-white/40">Nonce</span>
                <span className="text-[11px] font-mono text-white/60">{data ? data.nonce : '—'}</span>
              </div>
              <button className="w-full mt-2 py-2 text-xs font-bold rounded-lg transition-all" style={{ background: 'rgba(204,255,0,0.08)', color: '#ccff00', border: '1px solid rgba(204,255,0,0.2)' }}>
                Verify
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Game History (Neon badges + glass) ─────────────────────────────────
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
  React.useEffect(() => setList(items), [items]);

  if (list.length === 0) return null;

  return (
    <div className="game-history" style={{ background: 'rgba(22,22,26,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white/80">Bet History</h3>
        <button
          onClick={() => setList([])}
          className="text-xs flex items-center gap-1 transition-colors hover:text-white/60"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      </div>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
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
                className="flex items-center justify-between py-2 px-2.5 rounded-lg"
                style={{ background: 'rgba(15,16,21,0.5)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                    style={f.win
                      ? { background: 'rgba(0,255,102,0.12)', color: '#00ff66', border: '1px solid rgba(0,255,102,0.2)' }
                      : { background: 'rgba(255,51,102,0.12)', color: '#ff3366', border: '1px solid rgba(255,51,102,0.2)' }
                    }
                  >
                    {f.badge}
                  </span>
                  <span className="text-xs text-white/45">{f.detail}</span>
                </div>
                <span
                  className="text-xs font-bold font-mono tabular-nums"
                  style={f.win ? { color: '#00ff66', textShadow: '0 0 6px rgba(0,255,102,0.3)' } : { color: '#ff3366', textShadow: '0 0 6px rgba(255,51,102,0.3)' }}
                >
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

// ── History Badges (neon multiplier pills) ────────────────────────────
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
      <span className="text-xs font-medium text-white/40">History:</span>
      <AnimatePresence initial={false}>
        {items.map((h, i) => {
          const style: React.CSSProperties = h.multiplier < 2
            ? { background: 'rgba(255,51,102,0.1)', color: '#ff3366', border: '1px solid rgba(255,51,102,0.25)', boxShadow: '0 0 6px rgba(255,51,102,0.15)' }
            : h.multiplier < 5
              ? { background: 'rgba(255,181,46,0.1)', color: '#ffb52e', border: '1px solid rgba(255,181,46,0.25)', boxShadow: '0 0 6px rgba(255,181,46,0.15)' }
              : { background: 'rgba(204,255,0,0.1)', color: '#ccff00', border: '1px solid rgba(204,255,0,0.3)', boxShadow: '0 0 8px rgba(204,255,0,0.2)' };
          return (
            <motion.span
              key={`${h.multiplier}-${i}`}
              initial={reduced ? false : { opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="rounded-md px-2.5 py-1 font-mono text-xs font-bold tabular-nums"
              style={style}
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

// ── Game Controls Panel (right sidebar — glassmorphism) ──────────────
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
