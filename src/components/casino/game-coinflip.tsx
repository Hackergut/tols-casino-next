'use client';

import { useState, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GameFrame, BetPanel, BetButton, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface CoinflipPayload {
  flip: string;
}

function Coin3D({ flipping, result, choice, animKey, skipAnim }: {
  flipping: boolean; result: string | null; choice: 'heads' | 'tails'; animKey: number; skipAnim: boolean;
}) {
  const finalFace = result ?? choice;
  const restRotation = finalFace === 'tails' ? 180 : 0;

  return (
    <div className="coin" style={{ perspective: '900px' }}>
      <div
        key={`coin-${animKey}`}
        className="coin__disc"
        data-face={result ?? choice}
        data-spinning={flipping && !skipAnim || undefined}
        style={{
          width: 'clamp(100px, 34vw, 142px)',
          height: 'clamp(100px, 34vw, 142px)',
          transformStyle: 'preserve-3d',
          transform: !flipping || skipAnim ? `rotateX(${restRotation}deg)` : undefined,
          animation: flipping && !skipAnim ? `coinFlip3D ${result === 'heads' ? '2.2s' : '2.6s'} cubic-bezier(0.22, 0.61, 0.36, 1) forwards` : 'none',
          backgroundImage: 'none',
          background: 'none',
        }}
      >
        {/* Edge */}
        <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(145deg, #3a3a34, #0f0f0d)', transform: 'translateZ(0px)' }} />
        {/* Front — heads */}
        <div className="absolute inset-0 rounded-full" style={{
          backfaceVisibility: 'hidden', transform: 'translateZ(4px)',
          backgroundImage: 'url(/games/props/chip-heads.jpg)', backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        {/* Back — tails */}
        <div className="absolute inset-0 rounded-full" style={{
          backfaceVisibility: 'hidden', transform: 'rotateX(180deg) translateZ(4px)',
          backgroundImage: 'url(/games/props/chip-tails.jpg)', backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
      </div>
    </div>
  );
}

export function CoinflipGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnim = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<CoinflipPayload>("coinflip", initialBalance);
  const betAmount = useGameSettings((s) => s.stake);
  const setBetAmount = useGameSettings((s) => s.setStake);

  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<null | { won: boolean; flip: string; payout: number; multiplier: number }>(null);
  const [animKey, setAnimKey] = useState(0);

  const flip = useCallback(async () => {
    if (flipping || betAmount <= 0 || betAmount > balance) return;
    setFlipping(true);
    setResult(null);
    setAnimKey(k => k + 1);
    try {
      const data = await place(betAmount, { choice });
      if (!data) { setFlipping(false); return; }
      setResult({ won: data.won, flip: data.payload.flip, payout: data.payout, multiplier: data.multiplier });
    } catch { /* ignore */ }
    setTimeout(() => setFlipping(false), 2800);
  }, [flipping, betAmount, balance, choice, place]);

  return (
    <GameFrame
      gameId="coinflip"
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
          disabled={flipping || busy}
          action={
            <BetButton onClick={flip} disabled={flipping || busy || betAmount <= 0} busy={flipping}>
              {flipping ? 'Flipping...' : 'Flip Coin'}
            </BetButton>
          }
        >
          <StatRow label="Potential Win" value={`$${(betAmount * 1.98).toFixed(2)}`} tone="lime" />
          <StatRow label="Payout" value="1.98×" />
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="coin" style={{ perspective: '900px' }}>
        <Coin3D flipping={flipping} result={result?.flip ?? null} choice={choice} animKey={animKey} skipAnim={skipAnim} />

        {result && !flipping && (
          <div style={{ animation: skipAnim ? 'none' : 'winPulse 0.6s ease' }}>
            <p className={`coin__verdict ${result.won ? 'text-win' : 'text-loss'}`} data-won={result.won || undefined}>
              {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
            </p>
            <p className="tols-note text-center mt-1">
              {result.flip === 'heads' ? 'Heads' : 'Tails'} at {result.multiplier}×
            </p>
          </div>
        )}
      </div>

      {/* Choice Cards */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto mt-4">
        {(['heads', 'tails'] as const).map(side => (
          <button
            key={side}
            onClick={() => { setChoice(side); setResult(null); }}
            disabled={flipping}
            className="keno__cell flex flex-col items-center gap-2 py-4"
            data-picked={choice === side || undefined}
          >
            <div className="h-10 w-10 rounded-full" style={{
              backgroundImage: `url(/games/props/chip-${side}.jpg)`, backgroundSize: 'cover',
              opacity: choice === side ? 1 : 0.55,
            }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: choice === side ? 'var(--color-lime)' : 'rgba(255,255,255,0.4)' }}>
              {side}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>1.98×</span>
          </button>
        ))}
      </div>
    </GameFrame>
  );
}
