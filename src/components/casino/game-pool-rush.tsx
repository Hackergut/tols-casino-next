"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { PostedAmount } from "@/casino/components/casino/PostedAmount";
import { GameBetControls } from "@/components/casino/game-shared";
import { placeOriginalsBet, useOriginalsSession } from "@/lib/originals-client";
import { POOL_RUSH_PAY } from "@/lib/game-engines/tables";

interface Props {
  onBack: () => void;
  initialBalance: number;
}

const BALL_COLORS = ["#f5d456", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#22c55e", "#9f1239", "#141412"];
const POCKETS = [
  { x: 8, y: 10 },
  { x: 50, y: 8 },
  { x: 92, y: 10 },
  { x: 8, y: 90 },
  { x: 50, y: 92 },
  { x: 92, y: 90 },
];

export function PoolRushGame({ onBack, initialBalance }: Props) {
  const [betAmount, setBetAmount] = useState(5);
  const { balance, setBalance } = useOriginalsSession("pool-rush", {}, betAmount, initialBalance);
  const [shooting, setShooting] = useState(false);
  const [pocketed, setPocketed] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<null | { won: boolean; count: number; multiplier: number; payout: number }>(null);
  const [history, setHistory] = useState<Array<{ count: number; result: string; payout: number }>>([]);

  const shoot = useCallback(async () => {
    if (shooting || betAmount <= 0 || betAmount > balance) return;
    setShooting(true);
    setResult(null);
    setPocketed(new Set());
    try {
      const data = await placeOriginalsBet("pool-rush", betAmount, {});
      const ids = ((data.payload as { pocketed?: number[] }).pocketed ?? []) as number[];
      for (let i = 0; i < ids.length; i++) {
        await new Promise((r) => setTimeout(r, 90));
        setPocketed((prev) => new Set([...prev, ids[i]]));
      }
      setResult({
        won: data.won,
        count: Number((data.payload as { count?: number }).count ?? ids.length),
        multiplier: data.multiplier,
        payout: data.payout,
      });
      setBalance(data.availableBalance ?? data.newBalance);
      setHistory((prev) =>
        [{ count: Number((data.payload as { count?: number }).count ?? 0), result: data.won ? "win" : "lose", payout: data.payout }, ...prev].slice(0, 10),
      );
    } catch {
      /* ignore */
    }
    setShooting(false);
  }, [shooting, betAmount, balance, setBalance]);

  const rack = useMemo(() => {
    const spots: { id: number; x: number; y: number }[] = [];
    let id = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col <= row; col++) {
        if (id >= 8) break;
        spots.push({ id, x: 58 + col * 7.2 - row * 3.6, y: 38 + row * 9 });
        id++;
      }
    }
    while (id < 8) {
      spots.push({ id, x: 42 + (id - 6) * 8, y: 64 });
      id++;
    }
    return spots;
  }, []);

  return (
    <div className="game-wrapper compact-game">
      <div className="g-header">
        <button onClick={onBack} className="g-back" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1>Pool Rush</h1>
          <p>Break the rack — more balls pocketed, bigger payout</p>
        </div>
      </div>

      <div className="game-grid">
        <div className="pool-table">
          {POCKETS.map((p, i) => (
            <span key={i} className="pool-pocket" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
          ))}
          {rack.map((b) => {
            const gone = pocketed.has(b.id);
            return (
              <span
                key={b.id}
                className={`pool-ball ${gone ? "pocketed" : ""}`}
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  backgroundColor: BALL_COLORS[b.id],
                  color: b.id === 7 ? "#fff" : "#141412",
                }}
              >
                {b.id + 1}
              </span>
            );
          })}
          <span className="pool-cue" />
          {result && (
            <div className={`bj-banner ${result.won ? "win" : "loss"} pool-banner`}>
              {result.count} pocketed · {result.multiplier}x{" "}
              {result.won ? `+$${result.payout.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="g-balance">
            <p className="g-balance-label">Balance</p>
            <PostedAmount value={balance} format={(n) => `$${n.toFixed(2)}`} className="g-balance-value" />
          </div>
          <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={shooting} />
          <button onClick={shoot} disabled={shooting || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
            {shooting ? "Breaking…" : "Break"}
          </button>
          <div className="originals-rail-card space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Payout</p>
            {POOL_RUSH_PAY.map((m, n) => (
              <div key={n} className="flex justify-between text-[11px] text-white/50">
                <span>{n} ball{n === 1 ? "" : "s"}</span>
                <span className={m > 0 ? "text-lime" : "text-white/25"}>{m > 0 ? `${m}x` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="g-history">
          <div className="g-history-head">
            <h3 className="g-history-title">Recent breaks</h3>
            <button onClick={() => setHistory([])} className="text-[10px] flex items-center gap-1" style={{ color: "var(--g-text-3)" }}>
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
          <div className="g-history-list">
            {history.map((h, i) => (
              <div key={i} className="g-history-item">
                <span className={`g-history-badge ${h.result === "win" ? "win" : "loss"}`}>{h.result}</span>
                <span className="text-[11px] text-white/50">{h.count} pocketed</span>
                <span className={`text-[11px] font-bold ${h.result === "win" ? "text-win" : "text-loss"}`}>
                  {h.result === "win" ? "+" : "-"}${h.payout.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
