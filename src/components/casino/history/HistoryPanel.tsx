"use client";

import { useEffect, useState } from "react";

interface Row {
  id: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  createdAt: string;
}

export function HistoryPanel({ gameId }: { gameId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const q = gameId ? `?game=${gameId}&limit=20` : "?limit=20";
    const res = await fetch(`/api/bets/history${q}`);
    const json = await res.json();
    if (json.success) setRows(json.data.bets);
  };

  useEffect(() => {
    void load();
    const onBet = () => void load();
    window.addEventListener("tols:bet", onBet);
    return () => window.removeEventListener("tols:bet", onBet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return (
    <div className="originals-rail-card">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">History</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-white/35">No bets yet</p>
      ) : (
        <div className="g-history-list max-h-56">
          {rows.map((r) => (
            <div key={r.id} className="g-history-item">
              <div className="flex items-center gap-2">
                <span className={`g-history-badge ${r.result === "win" ? "win" : "loss"}`}>{r.result}</span>
                <span className="text-[11px] text-white/45">
                  {r.gameName} · {r.multiplier.toFixed(2)}x
                </span>
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${r.result === "win" ? "text-win" : "text-loss"}`}>
                {r.result === "win" ? "+" : "-"}${Math.abs(r.payout || r.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
