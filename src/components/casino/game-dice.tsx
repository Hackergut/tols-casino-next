'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { GameBetControls } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";

interface Props { onBack: () => void; initialBalance: number; }
type Result = null | { won: boolean; roll: number; payout: number; multiplier: number };

export function DiceGame({ onBack, initialBalance }: Props) {
  const reduced = useReducedMotion();
  const [betAmount, setBetAmount] = useState(5);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const { balance, setBalance } = useOriginalsSession("dice", { target, isOver }, betAmount, initialBalance);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [animatedRoll, setAnimatedRoll] = useState(50);
  const [history, setHistory] = useState<Array<{ roll: number; target: number; isOver: boolean; result: string; payout: number }>>([]);
  const [showPF, setShowPF] = useState(false);
  const [pfData, setPfData] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const winChance = useMemo(() => isOver ? (100 - target).toFixed(2) : target.toFixed(2), [target, isOver]);
  const potentialMultiplier = useMemo(() => winChance !== '0.00' ? (99 / Number(winChance)).toFixed(4) : '\u221e', [winChance]);
  const potentialPayout = useMemo(() => (betAmount * Number(potentialMultiplier === '\u221e' ? 0 : potentialMultiplier)).toFixed(2), [betAmount, potentialMultiplier]);

  const rollDice = useCallback(async () => {
    if (rolling || betAmount <= 0 || betAmount > balance) return;
    setRolling(true); setResult(null); setShowResult(false);
    const interval = reduced ? undefined : setInterval(() => setAnimatedRoll(Math.floor(Math.random() * 10000) / 100), 50);
    if (interval) rollIntervalRef.current = interval;
    try {
      const data = await placeOriginalsBet("dice", betAmount, { target, isOver });
      if (interval) clearInterval(interval);
      const payload = data.payload as { roll: number; target: number; isOver: boolean };
      const r = { won: data.won, roll: payload.roll, payout: data.payout, multiplier: data.multiplier };
      setResult(r); setAnimatedRoll(payload.roll); setBalance(data.newBalance);
      setPfData({ serverSeedHash: data.serverSeedHash, clientSeed: data.clientSeed, nonce: data.nonce });
      setHistory(prev => [{ roll: payload.roll, target, isOver, result: r.won ? 'win' : 'lose', payout: r.payout }, ...prev].slice(0, 15));
      setTimeout(() => setShowResult(true), 50);
    } catch { if (interval) clearInterval(interval); }
    setTimeout(() => setRolling(false), 400);
  }, [rolling, betAmount, balance, target, isOver, reduced]);

  useEffect(() => { return () => { if (rollIntervalRef.current) clearInterval(rollIntervalRef.current); }; }, []);

  const targetPct = target;
  const rollPct = animatedRoll;
  const winZoneStart = isOver ? targetPct : 0;
  const winZoneEnd = isOver ? 100 : targetPct;

  return (
    <div className="game-wrapper compact-game">
      {/* Header */}
      <div className="g-header">
        <button onClick={onBack} className="g-back" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>
        <div><h1>Dice</h1><p>Roll over or under your target</p></div>
      </div>

      <div className="game-grid">
        {/* === GAME AREA (left/top) === */}
        <div className="space-y-2">
          {/* Result Display + Slider — main game element */}
          <div className={'dice-area ' + (showResult && result?.won ? 'win' : '') + (showResult && result && !result.won ? ' loss' : '')}>
            <img
              src="/games/props/die.jpg"
              alt=""
              draggable={false}
              className={`dice-prop${rolling && !reduced ? ' rolling' : ''}`}
            />
            {/* Result number */}
            <div className="mb-3 text-center">
              <div className={'dice-result ' + (rolling ? '' : showResult && result?.won ? 'win' : showResult && result && !result.won ? 'loss' : 'idle') + (showResult && result && !reduced ? ' dice-slam' : '')}>
                {animatedRoll.toFixed(2)}
              </div>
              {showResult && result && (
                <div className="mt-1">
                  <span className={'text-xs font-bold ' + (result.won ? 'text-win' : 'text-loss')}>{result.won ? 'WIN' : 'LOSE'}</span>
                  {result.won && !reduced && (
                    <span className="dice-float-win absolute left-1/2 -translate-x-1/2 text-win text-sm font-bold whitespace-nowrap">+{result.payout.toFixed(2)}</span>
                  )}
                </div>
              )}
              {!result && !rolling && <p className="text-xs mt-1" style={{ color: 'var(--g-text-3)' }}>Set target & roll</p>}
            </div>

            {/* Slider Bar — Shuffle style horizontal */}
            <div className="w-full">
              <div className="dice-bar">
                {/* Win zone (subtle green) */}
                <div className="dice-bar-win" style={{ left: winZoneStart + '%', width: (winZoneEnd - winZoneStart) + '%' }} />
                {/* Lose zone (subtle dark) */}
                <div className="dice-bar-lose" style={{ left: (isOver ? 0 : targetPct) + '%', width: (isOver ? targetPct : 100 - targetPct) + '%' }} />
                {/* Roll result marker */}
                {showResult && result && !rolling && (
                  <div className="absolute top-0 bottom-0 z-10" style={{ left: rollPct + '%', transform: 'translateX(-50%)' }}>
                    <div className={'w-0.5 h-full ' + (result.won ? 'bg-win' : 'bg-loss')} />
                  </div>
                )}
              </div>
              {/* Slider input overlaid */}
              <input type="range" min={2} max={98} value={target}
                onChange={(e) => { setTarget(Number(e.target.value)); setResult(null); setShowResult(false); }}
                className="dice-slider" disabled={rolling}
                style={{ marginTop: '-48px', position: 'relative', zIndex: 20 }} />
              {/* Scale labels */}
              <div className="flex justify-between mt-1 px-0.5">
                <span className="text-[10px]" style={{ color: 'var(--g-text-3)', fontFamily: 'var(--g-mono)' }}>0</span>
                <span className="text-[10px]" style={{ color: 'var(--g-text-3)', fontFamily: 'var(--g-mono)' }}>100</span>
              </div>
            </div>
          </div>

          {/* Over/Under Toggle */}
          <div className="g-panel p-2">
            <div className="flex gap-2">
              <button onClick={() => { setIsOver(true); setResult(null); setShowResult(false); }} disabled={rolling}
                className={'g-btn g-btn-toggle ' + (isOver ? 'active' : 'inactive')}>Roll Over {target}</button>
              <button onClick={() => { setIsOver(false); setResult(null); setShowResult(false); }} disabled={rolling}
                className={'g-btn g-btn-toggle ' + (!isOver ? 'active' : 'inactive')}>Roll Under {target}</button>
            </div>
          </div>

          {/* Stats */}
          <div className="g-stats">
            <div className="g-stat"><p className="g-stat-label">Win Chance</p><p className="g-stat-value">{winChance}%</p></div>
            <div className="g-stat"><p className="g-stat-label">Multiplier</p><p className="g-stat-value lime">{potentialMultiplier}\u00d7</p></div>
            <div className="g-stat"><p className="g-stat-label">Payout</p><p className="g-stat-value">{'$' + potentialPayout}</p></div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="g-history">
              <div className="g-history-head">
                <h3 className="g-history-title">Recent Rolls</h3>
                <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1" style={{ color: 'var(--g-text-3)' }}><RotateCcw className="w-3 h-3" />Clear</button>
              </div>
              <div className="g-history-list">
                {history.map((h, i) => (
                  <div key={i} className="g-history-item">
                    <div className="flex items-center gap-2">
                      <span className={'g-history-badge ' + (h.result === 'win' ? 'win' : 'loss')}>{h.result}</span>
                      <span className="text-[11px]" style={{ color: 'var(--g-text-2)' }}>{h.isOver ? 'Over' : 'Under'} {h.target} \u2192 <span className="font-semibold" style={{ color: 'var(--g-text)', fontFamily: 'var(--g-mono)' }}>{h.roll.toFixed(2)}</span></span>
                    </div>
                    <span className={'text-[11px] font-bold tabular-nums ' + (h.result === 'win' ? 'text-[#00e701]' : 'text-[#ff3b3b]')} style={{ fontFamily: 'var(--g-mono)' }}>{h.result === 'win' ? '+' : '-'}{'$' + h.payout.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provably Fair */}
          <div className="g-pf">
            <button onClick={() => setShowPF(v => !v)} className="g-pf-toggle w-full">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: 'var(--g-green)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--g-text-2)' }}>Provably Fair</span>
              </div>
              {showPF ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--g-text-3)' }} />}
            </button>
            {showPF && (
              <div className="g-pf-body">
                <div className="g-pf-row"><span className="g-pf-label">Server Seed Hash</span><span className="g-pf-val">{pfData ? pfData.serverSeedHash.slice(0, 20) + '...' : '\u2014'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Client Seed</span><span className="g-pf-val">{pfData ? pfData.clientSeed : '\u2014'}</span></div>
                <div className="g-pf-row"><span className="g-pf-label">Nonce</span><span className="g-pf-val">{pfData ? pfData.nonce : '\u2014'}</span></div>
                <button className="g-pf-verify">Verify</button>
              </div>
            )}
          </div>
        </div>

        {/* === CONTROLS PANEL (right/bottom) === */}
        <div className="space-y-2">
          {/* Balance */}
          <div className="g-balance">
            <p className="g-balance-label">Balance</p>
            <p className="g-balance-value">{balance.toFixed(2)}</p>
          </div>

          {/* Bet Controls */}
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={rolling} />

          {/* Profit on Win */}
          <div className="g-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--g-text-3)' }}>Profit on Win</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--g-green)', fontFamily: 'var(--g-mono)' }}>+{(Number(potentialPayout) - betAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Roll Button */}
          <button onClick={rollDice} disabled={rolling || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
            {rolling ? 'Rolling...' : 'Roll Dice'}
          </button>
        </div>
      </div>
    </div>
  );
}
