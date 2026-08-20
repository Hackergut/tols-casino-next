'use client';

import { useState, useCallback } from 'react';
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import { PostedAmount } from '@/casino/components/casino/PostedAmount';
import { GameBetControls } from "@/components/casino/game-shared";

interface Props {
  onBack: () => void;
  initialBalance: number;
}



/* ── 3D Coin Component ── */
function Coin3D({ flipping, result, choice, animKey }: {
  flipping: boolean;
  result: string | null;
  choice: 'heads' | 'tails';
  animKey: number;
}) {
  const finalFace = result ?? choice;
  const reduced = useReducedMotion();
  // Tails needs to show the back face (rotated 180deg)
  const totalRotation = flipping
    ? (finalFace === 'heads' ? 360 * 8 : 360 * 8 + 180)
    : 0;
  const restRotation = finalFace === 'tails' ? 180 : 0;

  return (
    <div className="flex items-center justify-center" style={{ perspective: '800px' }}>
      <div
        key={`coin-${animKey}`}
        className="relative"
        style={{
          width: '180px',
          height: '180px',
          transformStyle: 'preserve-3d',
          transform: !flipping || reduced ? `rotateX(${restRotation}deg)` : undefined,
          animation: flipping && !reduced ? `coinFlip3D ${result === 'heads' ? '2.2s' : '2.6s'} cubic-bezier(0.22, 0.61, 0.36, 1) forwards` : 'none',
        }}
      >
        {/* Edge — dark metal disc between the faces, visible when the coin is edge-on */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(145deg, #8a6d0b, #4a3906)', transform: 'translateZ(0px)' }}
        />

        {/* Front Face - Heads (Gold) */}
        <div
          className="absolute inset-0 rounded-full flex flex-col items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'translateZ(4px)',
            background: 'linear-gradient(145deg, #f5d456, #d9a418, #b8860b)',
            boxShadow: result && !flipping
              ? (result === choice ? '0 0 30px color-mix(in oklab, var(--color-lime) 50%, transparent), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)' : '0 0 30px color-mix(in oklab, var(--color-loss) 50%, transparent)')
              : 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.4), 0 0 20px color-mix(in oklab, var(--color-pending) 20%, transparent)',
            border: '3px solid rgba(255,215,0,0.4)',
          }}
        >
          {/* Outer ring */}
          <div className="absolute inset-2 rounded-full" style={{ border: '1.5px solid rgba(255,255,255,0.15)' }} />
          {/* Crown SVG */}
          <svg width="60" height="48" viewBox="0 0 60 48" fill="none" className="mb-1">
            <path d="M6 36V16L18 24L30 8L42 24L54 16V36H6Z" fill="rgba(139,69,19,0.6)" stroke="rgba(139,69,19,0.8)" strokeWidth="1.5" />
            <circle cx="18" cy="24" r="3" fill="rgba(139,69,19,0.5)" />
            <circle cx="30" cy="14" r="3.5" fill="rgba(139,69,19,0.5)" />
            <circle cx="42" cy="24" r="3" fill="rgba(139,69,19,0.5)" />
            <rect x="6" y="34" width="48" height="4" rx="1" fill="rgba(139,69,19,0.4)" />
          </svg>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(139,69,19,0.7)', textShadow: '0 1px 1px rgba(255,255,255,0.3)' }}>HEADS</span>
        </div>

        {/* Back Face - Tails (Silver/Dark) */}
        <div
          className="absolute inset-0 rounded-full flex flex-col items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateX(180deg) translateZ(4px)',
            background: 'linear-gradient(145deg, #a8a89e, #7a7a70, #55554d)',
            boxShadow: result && !flipping
              ? (result === choice ? '0 0 30px color-mix(in oklab, var(--color-lime) 50%, transparent), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)' : '0 0 30px color-mix(in oklab, var(--color-loss) 50%, transparent)')
              : 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.4), 0 0 20px rgba(168,180,192,0.15)',
            border: '3px solid rgba(192,192,192,0.3)',
          }}
        >
          {/* Outer ring */}
          <div className="absolute inset-2 rounded-full" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
          {/* Shield SVG */}
          <svg width="50" height="56" viewBox="0 0 50 56" fill="none" className="mb-1">
            <path d="M25 4L6 14V30C6 42 25 52 25 52C25 52 44 42 44 30V14L25 4Z" fill="rgba(60,70,80,0.6)" stroke="rgba(80,90,100,0.8)" strokeWidth="1.5" />
            <path d="M25 12L14 18V28C14 36 25 42 25 42C25 42 36 36 36 28V18L25 12Z" fill="rgba(80,90,100,0.3)" />
            <line x1="25" y1="12" x2="25" y2="42" stroke="rgba(100,110,120,0.4)" strokeWidth="1" />
            <line x1="14" y1="24" x2="36" y2="24" stroke="rgba(100,110,120,0.4)" strokeWidth="1" />
          </svg>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(60,70,80,0.8)', textShadow: '0 1px 1px rgba(255,255,255,0.2)' }}>TAILS</span>
        </div>
      </div>
    </div>
  );
}

export function CoinflipGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const { balance, setBalance } = useOriginalsSession("coinflip", { choice }, betAmount, initialBalance);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; flip: string; payout: number; multiplier: number }>(null);
  const [history, setHistory] = useState<Array<{ result: string; payout: number; choice: string; flip: string }>>([]);
  const [animKey, setAnimKey] = useState(0);

  const flip = useCallback(async () => {
    if (flipping || betAmount <= 0 || betAmount > balance) return;
    setFlipping(true);
    setResult(null);
    setAnimKey(k => k + 1);

    try {
      const data = await placeOriginalsBet("coinflip", betAmount, { choice });
      const payload = data.payload as { flip: string };
      const r = { won: data.won, flip: payload.flip, payout: data.payout, multiplier: data.multiplier };
      setResult(r);
      setBalance(data.newBalance);
      setHistory(prev => [{ result: r.won ? 'win' : 'lose', payout: r.payout, choice, flip: payload.flip }, ...prev].slice(0, 10));
    } catch { /* ignore */ }
    setTimeout(() => setFlipping(false), 2800);
  }, [flipping, betAmount, balance, choice]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Coinflip</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick a side — 1.98x payout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Coin Area */}
        <div className="lg:col-span-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            {/* Coin Stage */}
            <div className="flex flex-col items-center justify-center py-10 relative">
              {/* Ambient light */}
              <div className="absolute inset-0" style={{
                background: result && !flipping
                  ? result.won
                    ? 'radial-gradient(ellipse at center, color-mix(in oklab, var(--color-lime) 6%, transparent) 0%, transparent 60%)'
                    : 'radial-gradient(ellipse at center, color-mix(in oklab, var(--color-loss) 6%, transparent) 0%, transparent 60%)'
                  : 'radial-gradient(ellipse at center, color-mix(in oklab, var(--color-lime) 3%, transparent) 0%, transparent 60%)',
                transition: 'background 0.5s ease',
              }} />

              <Coin3D flipping={flipping} result={result?.flip ?? null} choice={choice} animKey={animKey} />

              {/* Result text below coin */}
              {result && !flipping && (
                <div className="mt-6 text-center" style={{ animation: 'winPulse 0.6s ease' }}>
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <span className={`text-3xl font-black tabular-nums font-mono ${result.won ? 'text-lime' : 'text-loss'}`}>
                      {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 justify-center">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: result.flip === 'heads' ? 'color-mix(in oklab, var(--color-pending) 15%, transparent)' : 'rgba(168,180,192,0.15)',
                        color: result.flip === 'heads' ? '#f5d456' : '#a8a89e',
                      }}
                    >
                      {result.flip === 'heads' ? 'Heads' : 'Tails'}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>at {result.multiplier}x</span>
                  </div>
                </div>
              )}
            </div>

            {/* Choice Cards */}
            <div className="grid grid-cols-2 gap-4 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Heads Card */}
              <button
                onClick={() => { setChoice('heads'); setResult(null); }}
                className="group relative py-5 rounded-xl transition-all overflow-hidden"
                style={{
                  background: choice === 'heads'
                    ? 'linear-gradient(135deg, color-mix(in oklab, var(--color-pending) 15%, transparent), color-mix(in oklab, var(--color-pending) 5%, transparent))'
                    : 'rgba(255,255,255,0.02)',
                  border: choice === 'heads' ? '1.5px solid color-mix(in oklab, var(--color-pending) 40%, transparent)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: flipping ? 'default' : 'pointer',
                }}
                disabled={flipping}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--color-pending) 8%, transparent) 0%, transparent 70%)' }} />
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: choice === 'heads' ? 'linear-gradient(145deg, #f5d456, #d9a418)' : 'linear-gradient(145deg, #888, #666)',
                      boxShadow: choice === 'heads' ? '0 0 20px color-mix(in oklab, var(--color-pending) 30%, transparent)' : 'none',
                    }}
                  >
                    <svg width="20" height="16" viewBox="0 0 60 48" fill="none">
                      <path d="M6 36V16L18 24L30 8L42 24L54 16V36H6Z" fill="rgba(139,69,19,0.7)" />
                      <rect x="6" y="34" width="48" height="4" rx="1" fill="rgba(139,69,19,0.5)" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold tracking-wider uppercase"
                    style={{ color: choice === 'heads' ? '#f5d456' : 'rgba(255,255,255,0.4)' }}>
                    Heads
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>1.98x</span>
                </div>
              </button>

              {/* Tails Card */}
              <button
                onClick={() => { setChoice('tails'); setResult(null); }}
                className="group relative py-5 rounded-xl transition-all overflow-hidden"
                style={{
                  background: choice === 'tails'
                    ? 'linear-gradient(135deg, rgba(168,180,192,0.15), rgba(168,180,192,0.05))'
                    : 'rgba(255,255,255,0.02)',
                  border: choice === 'tails' ? '1.5px solid rgba(168,180,192,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: flipping ? 'default' : 'pointer',
                }}
                disabled={flipping}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(168,180,192,0.08) 0%, transparent 70%)' }} />
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: choice === 'tails' ? 'linear-gradient(145deg, #a8a89e, #7a7a70)' : 'linear-gradient(145deg, #888, #666)',
                      boxShadow: choice === 'tails' ? '0 0 20px rgba(168,180,192,0.3)' : 'none',
                    }}
                  >
                    <svg width="18" height="20" viewBox="0 0 50 56" fill="none">
                      <path d="M25 4L6 14V30C6 42 25 52 25 52C25 52 44 42 44 30V14L25 4Z" fill="rgba(60,70,80,0.7)" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold tracking-wider uppercase"
                    style={{ color: choice === 'tails' ? '#a8a89e' : 'rgba(255,255,255,0.4)' }}>
                    Tails
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>1.98x</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Balance */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="mt-1 text-2xl font-bold text-lime" />
          </div>

          {/* Bet Amount */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={flipping} />

{/* Potential Win */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Potential Win</p>
            <p className="text-xl font-bold tabular-nums mt-1 font-mono text-win">${(betAmount * 1.98).toFixed(2)}</p>
          </div>

          {/* Flip Button */}
          <button onClick={flip}
            disabled={flipping || betAmount <= 0 || betAmount > balance}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{
              background: flipping ? 'color-mix(in oklab, var(--color-lime) 30%, transparent)' : 'var(--color-lime)',
              color: 'var(--color-bg)',
              boxShadow: flipping ? 'none' : '0 0 20px color-mix(in oklab, var(--color-lime) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            {flipping ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(12,14,23,0.3)', borderTopColor: 'var(--color-bg)' }} />
                Flipping...
              </span>
            ) : (
              'Flip Coin'
            )}
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Bet History</h3>
            <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in oklab, var(--color-lime) 20%, transparent) transparent' }}>
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${h.result === 'win' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                    {h.result.toUpperCase()}
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Picked {h.choice} → {h.flip}
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${h.result === 'win' ? 'text-win' : 'text-loss'}`}>
                  {h.result === 'win' ? '+' : '-'}${h.payout.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
