"use client";

import { useMemo, useState } from "react";
import { useAutoBet } from "@/hooks/useAutoBet";
import { GAME_META } from "@/shared/constants";
import type { AutoAdjustMode, OriginalGameId } from "@/shared/types";

const MODES: AutoAdjustMode[] = ["reset", "increase", "decrease", "fixed"];

export function AutoBetPanel({
  gameId,
  defaultBet,
  gameParams,
}: {
  gameId: string;
  defaultBet: number;
  gameParams?: Record<string, unknown>;
}) {
  const { status, running, error, start, stop, lastBet } = useAutoBet(gameId);
  const [rounds, setRounds] = useState(10);
  const [baseBet, setBaseBet] = useState(defaultBet);
  const [onWin, setOnWin] = useState<AutoAdjustMode>("reset");
  const [onLoss, setOnLoss] = useState<AutoAdjustMode>("increase");
  const [onWinPercent, setOnWinPercent] = useState(100);
  const [onLossPercent, setOnLossPercent] = useState(100);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);

  const extras = useMemo(() => buildExtras(gameId, gameParams), [gameId, gameParams]);

  return (
    <div className="originals-rail-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Auto Bet</h3>
        {status && (
          <span className={`text-[10px] font-bold uppercase ${status.status === "running" ? "text-lime" : "text-white/40"}`}>
            {status.status} · {status.roundsPlayed}/{status.params.rounds}
          </span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">Rounds</span>
        <input type="number" min={1} max={1000} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={running} className="g-bet-display w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">Base bet</span>
        <input type="number" min={0.01} value={baseBet} onChange={(e) => setBaseBet(Number(e.target.value))} disabled={running} className="g-bet-display w-full" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <AdjustField label="On win" mode={onWin} setMode={setOnWin} percent={onWinPercent} setPercent={setOnWinPercent} disabled={running} />
        <AdjustField label="On loss" mode={onLoss} setMode={setOnLoss} percent={onLossPercent} setPercent={setOnLossPercent} disabled={running} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">Stop loss</span>
          <input type="number" min={0} value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} disabled={running} className="g-bet-display w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">Take profit</span>
          <input type="number" min={0} value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} disabled={running} className="g-bet-display w-full" />
        </label>
      </div>

      {status && (
        <div className="flex justify-between text-xs tabular-nums text-white/50">
          <span>Profit</span>
          <span className={status.currentProfit >= 0 ? "text-win" : "text-loss"}>
            {status.currentProfit >= 0 ? "+" : ""}${status.currentProfit.toFixed(2)}
          </span>
        </div>
      )}
      {lastBet && (
        <p className="text-[11px] text-white/40">
          Last: {lastBet.won ? "WIN" : "LOSE"} {lastBet.multiplier.toFixed(2)}x
        </p>
      )}
      {error && <p className="text-[11px] text-loss">{error}</p>}

      {running ? (
        <button onClick={() => void stop()} className="g-btn g-btn-secondary">
          Stop auto
        </button>
      ) : (
        <button
          onClick={() =>
            void start({
              rounds,
              baseBet,
              onWin,
              onLoss,
              onWinPercent,
              onLossPercent,
              stopLoss,
              takeProfit,
              gameParams: extras,
            })
          }
          className="g-btn g-btn-play"
        >
          Start auto
        </button>
      )}
    </div>
  );
}

function AdjustField({
  label,
  mode,
  setMode,
  percent,
  setPercent,
  disabled,
}: {
  label: string;
  mode: AutoAdjustMode;
  setMode: (m: AutoAdjustMode) => void;
  percent: number;
  setPercent: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <select value={mode} onChange={(e) => setMode(e.target.value as AutoAdjustMode)} disabled={disabled} className="g-bet-display mb-1 w-full text-xs">
        {MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {(mode === "increase" || mode === "decrease") && (
        <input type="number" min={0} value={percent} onChange={(e) => setPercent(Number(e.target.value))} disabled={disabled} className="g-bet-display w-full" />
      )}
    </label>
  );
}

function buildExtras(gameId: string, incoming?: Record<string, unknown>): Record<string, unknown> {
  const defaults = GAME_META[gameId as OriginalGameId]?.defaultParams ?? {};
  return { ...defaults, ...incoming };
}
