"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy, TrendingUp, TrendingDown, Gamepad2, Package, Star, Zap, Calendar, ChevronRight, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/types";
import { useUIStore } from "@/lib/store";

interface ProfileData {
  id: string;
  username: string;
  avatarColor: string;
  level: number;
  xp: number;
  role: string;
  joinedAt: string;
  isOwn: boolean;
  stats: {
    totalWagered: number;
    totalWon: number;
    netProfit: number;
    wins: number;
    losses: number;
    winRate: number;
    biggestWin: number;
    betCount: number;
    favoriteGame: string;
    cardsCount: number;
    mythicCount: number;
  };
  wallet: { balance: number; vipLevel: number } | null;
  affiliate: { referralCode: string; totalReferrals: number; totalCommission: number } | null;
  recentBets: Array<{ gameName: string; amount: number; multiplier: number; payout: number; result: string; createdAt: string }>;
  achievements: Array<{ id: string; name: string; desc: string; icon: string; unlocked: boolean; category: string; progress: number; target: number }>;
}

export function UserProfile() {
  const { setActiveSection } = useUIStore();

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const r = await fetch("/api/profile");
      const j = await r.json();
      return j.data;
    },
  });

  if (!profile) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading profile…</div>;
  }

  const { stats } = profile;
  const xpProgress = (profile.xp % 1000) / 10;
  const unlockedAchievements = profile.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <div className="relative overflow-hidden rounded-xl border border-lime/20 p-5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
        <div className="absolute inset-0 bg-grid-lime opacity-20" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime/10 blur-3xl animate-pulse-scale" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Avatar with level ring */}
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 animate-spin-slow border-dashed" style={{ borderColor: profile.avatarColor }} />
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold" style={{ background: profile.avatarColor, color: "var(--color-bg)" }}>
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-background px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
              LVL {profile.level}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className=" text-2xl font-bold uppercase tracking-wide">{profile.username}</h1>
              {profile.role === "admin" && <Badge variant="outline" className="text-[9px] uppercase" style={{ borderColor: "var(--color-lime)", color: "var(--color-lime)" }}>Admin</Badge>}
              {profile.wallet && profile.wallet.vipLevel >= 3 && (
                <Badge variant="outline" className="text-[9px] uppercase" style={{ borderColor: "var(--color-pending)", color: "var(--color-pending)" }}>
                  <Crown className="mr-0.5 h-2.5 w-2.5" /> VIP {profile.wallet.vipLevel}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Joined {timeAgo(profile.joinedAt)} · {stats.betCount} bets placed
            </p>
            {/* XP progress */}
            <div className="mt-2 max-w-xs">
              <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>XP {formatNumber(profile.xp)}</span>
                <span>{xpProgress.toFixed(0)}% to Lvl {profile.level + 1}</span>
              </div>
              <Progress value={xpProgress} className="h-1.5" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }} />
            </div>
          </div>

          {profile.isOwn && (
            <Button onClick={() => setActiveSection("wallet")} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
              My Wallet <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Wagered" value={formatCurrency(stats.totalWagered)} icon={TrendingUp} />
        <StatCard label="Won" value={formatCurrency(stats.totalWon)} icon={Trophy} color="var(--color-lime)" />
        <StatCard label="Net Profit" value={`${stats.netProfit >= 0 ? "+" : ""}${formatCurrency(stats.netProfit)}`} icon={stats.netProfit >= 0 ? TrendingUp : TrendingDown} color={stats.netProfit >= 0 ? "var(--color-lime)" : "var(--color-loss)"} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={Zap} />
        <StatCard label="Biggest Win" value={formatCurrency(stats.biggestWin)} icon={Star} color="var(--color-pending)" />
        <StatCard label="Cards" value={formatNumber(stats.cardsCount)} icon={Package} color="var(--color-vip)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent bets */}
        <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
          <div className="border-b border-border/40 px-3 py-2">
            <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Bets</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {profile.recentBets.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No bets yet.</div>
            ) : (
              profile.recentBets.map((b, i) => {
                const won = b.result === "win";
                return (
                  <div key={i} className="flex items-center gap-2 border-b border-border/30 px-3 py-2 text-xs">
                    <span className="flex-1 truncate font-medium">{b.gameName}</span>
                    <span className="font-mono text-muted-foreground">{formatCurrency(b.amount)}</span>
                    <span className="font-mono font-bold" style={{ color: won ? "var(--color-lime)" : "var(--color-muted-foreground)" }}>
                      {b.multiplier > 0 ? `${b.multiplier.toFixed(2)}×` : "—"}
                    </span>
                    <span className="w-16 text-right font-mono font-bold" style={{ color: won ? "var(--color-lime)" : "var(--color-loss)" }}>
                      {won ? "+" + formatCurrency(b.payout) : "—"}
                    </span>
                    <span className="w-12 text-right text-[10px] text-muted-foreground">{timeAgo(b.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Favorite game + affiliate */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-card/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Gamepad2 className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">Favorite Game</span>
            </div>
            <div className=" text-lg font-bold">{stats.favoriteGame}</div>
          </div>
          {profile.affiliate && (
            <div className="rounded-lg border border-border/50 bg-card/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Affiliate</div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono font-bold" style={{ color: "var(--color-lime)" }}>{profile.affiliate.referralCode}</span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Referrals</span>
                <span className="font-mono">{formatNumber(profile.affiliate.totalReferrals)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Earned</span>
                <span className="font-mono font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(profile.affiliate.totalCommission)}</span>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border/50 bg-card/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">Win / Loss</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold text-lime" style={{ color: "var(--color-lime)" }}>{stats.wins}W</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono font-bold text-red-400">{stats.losses}L</span>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className=" text-sm font-semibold uppercase tracking-wide">Achievements</h3>
          <span className="text-xs text-muted-foreground">{unlockedAchievements}/{profile.achievements.length} unlocked</span>
        </div>
        {(["General", "Games", "Milestones", "Collection", "Progression"] as const).map((category) => {
          const catAchievements = profile.achievements.filter((a) => a.category === category);
          if (catAchievements.length === 0) return null;
          const catUnlocked = catAchievements.filter((a) => a.unlocked).length;
          return (
            <div key={category} className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <h4 className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">{category}</h4>
                <span className="text-[10px] text-muted-foreground">{catUnlocked}/{catAchievements.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {catAchievements.map((a) => {
                  const pct = Math.min(100, (a.progress / a.target) * 100);
                  return (
                  <div
                    key={a.id}
                    className={`relative overflow-hidden rounded-lg border p-3 text-center transition-all ${
                      a.unlocked ? "border-lime/30 bg-lime/5 hover:scale-105" : "border-border/30 bg-card/20"
                    }`}
                    style={a.unlocked ? { borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" } : {}}
                    title={a.desc}
                  >
                    <div className="mb-1 text-2xl">
                      {a.unlocked ? a.icon : <Lock className="mx-auto h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className={`truncate text-[10px] font-semibold ${a.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{a.name}</div>
                    <div className="truncate text-[8px] text-muted-foreground">{a.desc}</div>
                    {a.unlocked ? (
                      <div className="absolute right-1 top-1">
                        <Check className="h-3 w-3" style={{ color: "var(--color-lime)" }} />
                      </div>
                    ) : (
                      <div className="mt-1.5">
                        <div className="mb-0.5 text-[8px] font-mono text-muted-foreground">{a.progress}/{a.target}</div>
                        <div className="h-1 overflow-hidden rounded-full bg-background/60">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--color-lime)" }} />
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <div className=" text-base font-bold" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}
