"use client";

import { useEffect, useState } from "react";
import { AutoBetPanel } from "@/components/casino/bet/AutoBetPanel";
import { ProvablyFairPanel } from "@/components/casino/provably-fair/ProvablyFairPanel";
import { HistoryPanel } from "@/components/casino/history/HistoryPanel";

type Tab = "auto" | "fair" | "history";

export function OriginalsRail({ gameId }: { gameId: string }) {
  const [tab, setTab] = useState<Tab>("auto");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [bet, setBet] = useState(5);

  useEffect(() => {
    const onParams = (e: Event) => {
      const detail = (e as CustomEvent).detail as { gameId?: string; params?: Record<string, unknown>; bet?: number };
      if (detail?.gameId && detail.gameId !== gameId) return;
      if (detail?.params) setParams(detail.params);
      if (typeof detail?.bet === "number") setBet(detail.bet);
    };
    window.addEventListener("tols:game-params", onParams);
    return () => window.removeEventListener("tols:game-params", onParams);
  }, [gameId]);

  return (
    <aside className="originals-rail">
      <div className="originals-rail-tabs">
        {(["auto", "fair", "history"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>
            {t === "auto" ? "Auto Bet" : t === "fair" ? "Fair" : "History"}
          </button>
        ))}
      </div>
      {tab === "auto" && <AutoBetPanel gameId={gameId} defaultBet={bet} gameParams={params} />}
      {tab === "fair" && <ProvablyFairPanel />}
      {tab === "history" && <HistoryPanel gameId={gameId} />}
    </aside>
  );
}
