"use client";

import React, { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Users,
  DollarSign, Zap, RefreshCw, CheckCircle2, Ban, Flame, Snowflake, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface LiveStats {
  summary: {
    total_players: number;
    active_alerts: number;
    wagered_24h: number;
    revenue_24h: number;
    house_edge_24h: string;
  };
  house_edge_by_game: Array<{
    game_id: string;
    game_name: string;
    current_rtp: number;
    house_edge: number;
    total_bets: number;
    total_wagered: number;
    actual_house_edge_pct: number;
    wins: number;
    losses: number;
  }>;
  active_streaks: Array<{
    id: string;
    username: string;
    game_name: string;
    current_win_streak: number;
    current_loss_streak: number;
    last_outcome: string;
  }>;
  unresolved_alerts: Array<{
    id: string;
    alert_type: string;
    message: string;
    current_value: number;
    created_at: string;
    players: { username: string };
  }>;
  daily_revenue: Array<{
    date: string;
    total_wagered: number;
    gross_revenue: number;
    total_bets: number;
  }>;
  rtp_history: Array<{
    game_id: string;
    old_rtp: number;
    new_rtp: number;
    changed_by: string;
    reason: string;
    created_at: string;
    games: { name: string };
  }>;
  recent_results: Array<{
    id: string;
    bet_amount: number;
    win_amount: number;
    outcome: "win" | "loss" | "push";
    forced_outcome: boolean;
    created_at: string;
    players: { username: string };
    games: { name: string };
  }>;
  players: Array<{
    id: string;
    username: string;
    balance: number;
    total_wagered: number;
    admin_override: string | null;
    is_banned: boolean;
    win_rate_pct: number;
  }>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function fmtAmount(n: number) {
  if (!n) return "0";
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}

const ALERT_COLORS: Record<string, string> = {
  loss_streak: "destructive",
  win_streak: "default",
  large_win: "secondary",
  suspicious_activity: "destructive",
  rapid_betting: "outline",
};

const GAME_COLORS = ["#ccff00", "#4ade80", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#f87171"];

export function LiveMonitorPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: LiveStats }>({
    queryKey: ["supabase-live-stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/supabase-live");
      return r.json();
    },
    refetchInterval: 5_000,
  });

  const stats = data?.data;

  const resolveAlert = useMutation({
    mutationFn: async (alert_id: string) => {
      const r = await fetch("/api/admin/supabase-live?action=resolve-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      toast.success("Alert resolved");
      qc.invalidateQueries({ queryKey: ["supabase-live-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatRtpHistory = useCallback(() => {
    if (!stats?.rtp_history) return [];
    return stats.rtp_history.map((r) => ({
      time: new Date(r.created_at).toLocaleTimeString(),
      rtp: Number(r.new_rtp),
      game: r.games?.name || "Unknown",
      reason: r.reason,
    }));
  }, [stats]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const summary = stats?.summary;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: "var(--color-lime, #ccff00)" }} />
            Live Monitor
          </h2>
          <p className="text-sm text-muted-foreground">Real-time game and player monitoring · auto-refresh 5s</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Players", value: summary?.total_players ?? 0, icon: Users, color: "var(--color-lime, #ccff00)" },
          { label: "Active Alerts", value: summary?.active_alerts ?? 0, icon: AlertTriangle, color: (summary?.active_alerts ?? 0) > 0 ? "var(--color-loss, #ff4d5e)" : "#4ade80" },
          { label: "Wagered 24h", value: fmtAmount(summary?.wagered_24h ?? 0), icon: DollarSign, color: "var(--color-lime, #ccff00)", prefix: "\u20bf " },
          { label: "House Edge 24h", value: `${summary?.house_edge_24h ?? "0.00"}%`, icon: TrendingUp, color: parseFloat(summary?.house_edge_24h ?? "0") > 0 ? "#4ade80" : "var(--color-loss, #ff4d5e)" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-white/5 bg-white/3">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: `${s.color}18` }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold tabular-nums">{s.prefix}{s.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: "var(--color-lime, #ccff00)" }} />
            House Edge by Game
          </CardTitle>
          <CardDescription className="text-xs">Configured vs actual edge — last 1000 bets per game</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.house_edge_by_game && stats.house_edge_by_game.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.house_edge_by_game} layout="vertical" margin={{ left: 16, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} unit="%" />
                <YAxis dataKey="game_name" type="category" tick={{ fontSize: 11, fill: "#ccc" }} width={72} />
                <Tooltip contentStyle={{ background: "#1a1b20", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${Number(v).toFixed(2)}%`]} />
                <Bar dataKey="actual_house_edge_pct" name="Actual Edge" radius={[0, 4, 4, 0]}>
                  {stats.house_edge_by_game.map((entry, i) => (
                    <Cell key={i} fill={Number(entry.actual_house_edge_pct) >= Number(entry.house_edge) ? "#4ade80" : "var(--color-loss, #ff4d5e)"} />
                  ))}
                </Bar>
                <Bar dataKey="house_edge" name="Target Edge" fill="rgba(255,255,255,0.12)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No game data yet</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              Unresolved Alerts
              {(stats?.unresolved_alerts?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{stats?.unresolved_alerts?.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-56">
              {stats?.unresolved_alerts && stats.unresolved_alerts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Player</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Value</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {stats.unresolved_alerts.map((a) => (
                        <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-white/5">
                          <TableCell className="text-xs font-medium py-2">{a.players?.username ?? "\u2014"}</TableCell>
                          <TableCell className="py-2">
                            <Badge variant={(ALERT_COLORS[a.alert_type] as "default" | "destructive" | "secondary" | "outline") || "outline"} className="text-xs capitalize">{a.alert_type.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums py-2">{Number(a.current_value).toFixed(4)}</TableCell>
                          <TableCell className="py-2 text-right">
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-green-400 hover:text-green-300" onClick={() => resolveAlert.mutate(a.id)} disabled={resolveAlert.isPending}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />Resolve
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <p className="text-sm text-muted-foreground">No active alerts ✓</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "var(--color-lime, #ccff00)" }} />
              Active Streaks ≥ 3
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-56">
              {stats?.active_streaks && stats.active_streaks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Player</TableHead>
                      <TableHead className="text-xs">Game</TableHead>
                      <TableHead className="text-xs text-center">🔥 Win</TableHead>
                      <TableHead className="text-xs text-center">❄️ Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.active_streaks.map((s) => (
                      <TableRow key={s.id} className="border-b border-white/5">
                        <TableCell className="text-xs font-medium py-2">{s.username}</TableCell>
                        <TableCell className="text-xs capitalize py-2">{s.game_name}</TableCell>
                        <TableCell className="text-center py-2">
                          {s.current_win_streak > 0 ? <span className="text-green-400 font-bold text-sm">{s.current_win_streak}</span> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center py-2">
                          {s.current_loss_streak > 0 ? <span className="text-red-400 font-bold text-sm">{s.current_loss_streak}</span> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                  <Snowflake className="w-8 h-8 text-blue-400" />
                  <p className="text-sm text-muted-foreground">No notable streaks</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "var(--color-lime, #ccff00)" }} />
            RTP Change History
          </CardTitle>
          <CardDescription className="text-xs">Last 20 RTP adjustments across all games</CardDescription>
        </CardHeader>
        <CardContent>
          {formatRtpHistory().length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={formatRtpHistory()} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rtpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-lime, #ccff00)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-lime, #ccff00)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: "#888" }} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1b20", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v, _n, p) => [`${Array.isArray(v) ? v.join(", ") : v}% (${p?.payload?.game ?? ""})`, p?.payload?.reason || "RTP"]} />
                <Area type="monotone" dataKey="rtp" stroke="var(--color-lime, #ccff00)" strokeWidth={2} fill="url(#rtpGrad)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No RTP changes recorded yet</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--color-lime, #ccff00)" }} />
            Live Results Feed
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {stats?.recent_results && stats.recent_results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Player</TableHead>
                    <TableHead className="text-xs">Game</TableHead>
                    <TableHead className="text-xs text-right">Bet</TableHead>
                    <TableHead className="text-xs text-right">Win</TableHead>
                    <TableHead className="text-xs text-center">Result</TableHead>
                    <TableHead className="text-xs text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {stats.recent_results.slice(0, 50).map((r) => (
                      <motion.tr key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="border-b border-white/5">
                        <TableCell className="text-xs font-medium py-1.5">{r.players?.username ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 capitalize">{r.games?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums py-1.5 text-right">₿{fmtAmount(r.bet_amount)}</TableCell>
                        <TableCell className="text-xs tabular-nums py-1.5 text-right">
                          {r.win_amount > 0 ? <span className="text-green-400">₿{fmtAmount(r.win_amount)}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant={r.outcome === "win" ? "default" : "destructive"} className="text-xs px-1.5 py-0" style={r.outcome === "win" ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" } : {}}>{r.outcome}</Badge>
                            {r.forced_outcome && <Badge variant="outline" className="text-xs px-1 py-0 border-yellow-500/40 text-yellow-400">forced</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-1.5 text-right">{timeAgo(r.created_at)}</TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No results yet — start playing!</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
