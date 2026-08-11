"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Power, Loader2, TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GameRtp {
  gameId: string;
  gameName: string;
  baseRtp: number;
  rtpTarget: number;
  enabled: boolean;
  ruleId: string | null;
  betsAffected: number;
  recentBets: number;
  recentWins: number;
  recentWagered: number;
  recentReturned: number;
  actualRtp: number | null;
  winRate: number | null;
}

function rtpLabel(t: number): string {
  if (t === 1) return "Normal";
  if (t > 1.3) return "Very Hot";
  if (t > 1.1) return "Hot";
  if (t > 1.0) return "Warm";
  if (t < 0.7) return "Very Cold";
  if (t < 0.9) return "Cold";
  if (t < 1.0) return "Cool";
  return "Normal";
}

function rtpColor(t: number): string {
  if (t > 1.1) return "var(--color-win, #4ade80)";
  if (t < 0.9) return "var(--color-loss, #ff4d5e)";
  return "var(--color-lime, #ccff00)";
}

export function RtpControlPage() {
  const qc = useQueryClient();
  const [sliders, setSliders] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery<{ games: GameRtp[] }>({
    queryKey: ["rtp-control"],
    queryFn: async () => {
      const r = await fetch("/api/admin/rtp-control");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 15_000,
  });

  const setRtp = useMutation({
    mutationFn: async (params: { gameId: string; rtpTarget: number }) => {
      const r = await fetch("/api/admin/rtp-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.gameId} RTP set to ${vars.rtpTarget}`);
      qc.invalidateQueries({ queryKey: ["rtp-control"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetRtp = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch("/api/admin/rtp-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "reset" }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (_d, gameId) => {
      toast.success(`${gameId} RTP reset to normal`);
      qc.invalidateQueries({ queryKey: ["rtp-control"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSlider = useCallback((gameId: string, val: number) => {
    setSliders((s) => ({ ...s, [gameId]: val }));
  }, []);

  const applyRtp = useCallback((game: GameRtp) => {
    const val = sliders[game.gameId] ?? game.rtpTarget;
    if (val === game.rtpTarget && game.enabled) return;
    setRtp.mutate({ gameId: game.gameId, rtpTarget: Math.round(val * 100) / 100 });
  }, [sliders, setRtp]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const games = data?.games ?? [];
  const activeCount = games.filter((g) => g.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">RTP Control Center</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust the Return-to-Player for each Originals game in real time.
            Bias above 1.0 heats (more wins), below 1.0 cools (fewer wins).
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{
            background: activeCount > 0 ? "color-mix(in oklab, var(--color-lime) 12%, transparent)" : "var(--color-surface-raised, #2a2a2a)",
            color: activeCount > 0 ? "var(--color-lime, #ccff00)" : "var(--muted-foreground)",
          }}
        >
          <Activity className="h-4 w-4" />
          {activeCount} active {activeCount === 1 ? "rule" : "rules"}
        </div>
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl border p-4 text-sm"
        style={{
          background: "color-mix(in oklab, var(--color-vip, #9184d9) 8%, transparent)",
          borderColor: "color-mix(in oklab, var(--color-vip, #9184d9) 20%, transparent)",
        }}
      >
        <p className="font-medium mb-1">How RTP bias works</p>
        <p className="text-muted-foreground">
          The slider sets a multiplier on the fair win probability. At <strong>1.00</strong> the game
          runs with its natural house edge. Pushing above <strong>1.00</strong> gives players more wins
          (hot); below <strong>1.00</strong> gives fewer wins (cold). This biases outcomes while keeping
          the provably-fair seed system intact — outcomes are still verifiable.
        </p>
      </div>

      {/* Game grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => {
          const sliderVal = sliders[game.gameId] ?? game.rtpTarget;
          const adjustedRtp = Math.round(game.baseRtp * sliderVal * 10000) / 100;
          const isActive = game.enabled && game.rtpTarget !== 1;
          const isDirty = sliderVal !== game.rtpTarget;

          return (
            <div
              key={game.gameId}
              className="rounded-2xl border p-5 transition-all"
              style={{
                background: "var(--color-surface, #1a1a1a)",
                borderColor: isActive
                  ? "color-mix(in oklab, " + rtpColor(game.rtpTarget) + " 30%, transparent)"
                  : "var(--border, #333)",
                boxShadow: isActive ? `0 0 20px color-mix(in oklab, ${rtpColor(game.rtpTarget)} 8%, transparent)` : "none",
              }}
            >
              {/* Game name + status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold capitalize">{game.gameName}</h3>
                  <p className="text-xs text-muted-foreground">Base RTP: {(game.baseRtp * 100).toFixed(1)}%</p>
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: isActive ? `color-mix(in oklab, ${rtpColor(game.rtpTarget)} 15%, transparent)` : "var(--color-surface-raised, #2a2a2a)",
                    color: isActive ? rtpColor(game.rtpTarget) : "var(--muted-foreground)",
                  }}
                >
                  {sliderVal > 1 ? <TrendingUp className="h-3 w-3" /> : sliderVal < 1 ? <TrendingDown className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                  {rtpLabel(sliderVal)}
                </div>
              </div>

              {/* Slider */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">RTP Bias</span>
                  <span className="font-mono font-bold" style={{ color: rtpColor(sliderVal) }}>
                    {sliderVal.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={sliderVal}
                  onChange={(e) => handleSlider(game.gameId, Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right,
                      color-mix(in oklab, var(--color-loss, #ff4d5e) 40%, transparent) 0%,
                      var(--color-surface-raised, #2a2a2a) 50%,
                      color-mix(in oklab, var(--color-win, #4ade80) 40%, transparent) 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0× Cold</span>
                  <span>1× Normal</span>
                  <span>2× Hot</span>
                </div>
              </div>

              {/* Adjusted RTP display */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg p-3" style={{ background: "var(--color-surface-raised, #2a2a2a)" }}>
                  <p className="text-[10px] text-muted-foreground mb-1">Adjusted RTP</p>
                  <p className="text-xl font-bold font-mono" style={{ color: rtpColor(sliderVal) }}>
                    {adjustedRtp.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ background: "var(--color-surface-raised, #2a2a2a)" }}>
                  <p className="text-[10px] text-muted-foreground mb-1">House Edge</p>
                  <p className="text-xl font-bold font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {(100 - adjustedRtp).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Live stats */}
              {game.actualRtp !== null && (
                <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Actual RTP</p>
                    <p className="font-mono font-semibold">{game.actualRtp.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Win Rate</p>
                    <p className="font-mono font-semibold">{game.winRate?.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recent</p>
                    <p className="font-mono font-semibold">{game.recentBets}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!isDirty || setRtp.isPending}
                  onClick={() => applyRtp(game)}
                  className="flex-1 font-semibold"
                  style={isDirty ? { background: "var(--color-lime, #ccff00)", color: "var(--color-bg, #0a0a0a)" } : {}}
                >
                  {setRtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {isDirty ? "Apply" : "Active"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isActive || resetRtp.isPending}
                  onClick={() => resetRtp.mutate(game.gameId)}
                >
                  {resetRtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                </Button>
              </div>

              {isActive && (
                <p className="mt-2 text-[10px] text-center text-muted-foreground">
                  {game.betsAffected} bets affected
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}