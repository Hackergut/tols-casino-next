'use client';

import { useState, useCallback } from 'react';
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";
import { useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { GameBetControls, GameBalance, GameHeader } from "@/components/casino/game-shared";

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
          width: '200px',
          height: '200px',
          transformStyle: 'preserve-3d',
          transform: !flipping || reduced ? `rotateX(${restRotation}deg)` : undefined,
          animation: flipping && !reduced ? `coinFlip3D ${result === 'heads' ? '2.2s' : '2.6s'} cubic-bezier(0.22, 0.61, 0.36, 1) forwards` : 'none',
        }}
      >
        {/* Edge — dark metal disc between the faces, visible when the coin is edge-on */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(145deg, #3a3a34, #0f0f0d)', transform: 'translateZ(0px)' }}
        />

        {/* Front Face — photoreal TOLS chip (heads) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'translateZ(4px)',
            backgroundImage: 'url(/games/props/chip-heads.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: result && !flipping
              ? (result === choice ? '0 0 36px color-mix(in oklab, var(--color-lime) 55%, transparent)' : '0 0 30px color-mix(in oklab, var(--color-loss) 45%, transparent)')
              : '0 12px 28px rgb(0 0 0 / 0.45)',
          }}
        />

        {/* Back Face — photoreal TOLS chip (tails) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateX(180deg) translateZ(4px)',
            backgroundImage: 'url(/games/props/chip-tails.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: result && !flipping
              ? (result === choice ? '0 0 36px color-mix(in oklab, var(--color-lime) 55%, transparent)' : '0 0 30px color-mix(in oklab, var(--color-loss) 45%, transparent)')
              : '0 12px 28px rgb(0 0 0 / 0.45)',
          }}
        />
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
      <GameHeader title="Coinflip" subtitle="Pick a side — 1.98x payout" onBack={onBack} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Coin Area */}
        <div className="lg:col-span-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg)', border: '1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)' }}>
            {/* Coin Stage */}
            <div className="coinflip-stage flex flex-col items-center justify-center py-10 relative">
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
                    ? 'linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 14%, transparent), color-mix(in oklab, var(--color-lime) 4%, transparent))'
                    : 'rgba(255,255,255,0.02)',
                  border: choice === 'heads' ? '1.5px solid color-mix(in oklab, var(--color-lime) 40%, transparent)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: flipping ? 'default' : 'pointer',
                }}
                disabled={flipping}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--color-pending) 8%, transparent) 0%, transparent 70%)' }} />
                <div className="relative flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full"
                    style={{
                      backgroundImage: 'url(/games/props/chip-heads.jpg)',
                      backgroundSize: 'cover',
                      boxShadow: choice === 'heads' ? '0 0 20px color-mix(in oklab, var(--color-lime) 40%, transparent)' : 'none',
                      opacity: choice === 'heads' ? 1 : 0.55,
                    }}
                  />
                  <span className="text-sm font-bold tracking-wider uppercase"
                    style={{ color: choice === 'heads' ? 'var(--color-lime)' : 'rgba(255,255,255,0.4)' }}>
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
                    ? 'linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 14%, transparent), color-mix(in oklab, var(--color-lime) 4%, transparent))'
                    : 'rgba(255,255,255,0.02)',
                  border: choice === 'tails' ? '1.5px solid color-mix(in oklab, var(--color-lime) 40%, transparent)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: flipping ? 'default' : 'pointer',
                }}
                disabled={flipping}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(168,180,192,0.08) 0%, transparent 70%)' }} />
                <div className="relative flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full"
                    style={{
                      backgroundImage: 'url(/games/props/chip-tails.jpg)',
                      backgroundSize: 'cover',
                      boxShadow: choice === 'tails' ? '0 0 20px color-mix(in oklab, var(--color-lime) 40%, transparent)' : 'none',
                      opacity: choice === 'tails' ? 1 : 0.55,
                    }}
                  />
                  <span className="text-sm font-bold tracking-wider uppercase"
                    style={{ color: choice === 'tails' ? 'var(--color-lime)' : 'rgba(255,255,255,0.4)' }}>
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
          <GameBalance value={balance} />

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
            className="g-btn g-btn-play"
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
