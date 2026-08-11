"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, UserPlus, UserCheck, Share2, Heart, MessageCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, timeAgo } from "@/lib/types";
import { toast } from "sonner";

interface FollowedUser {
  id: string;
  username: string;
  avatarColor: string;
  level: number;
  isFollowing: boolean;
}

interface FeedItem {
  id: string;
  username: string;
  avatarColor: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  createdAt: string;
  isFollowed: boolean;
}

interface SocialData {
  followed: FollowedUser[];
  feed: FeedItem[];
  followingCount: number;
}

export function SocialFeed() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data } = useQuery<SocialData>({
    queryKey: ["social"],
    queryFn: async () => {
      const r = await fetch("/api/social");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 10000,
  });

  const followMutation = useMutation({
    mutationFn: async (vars: { userId: string; action: "follow" | "unfollow" }) => {
      const r = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (data) => {
      toast.success(data.action === "follow" ? `Following ${data.username}` : `Unfollowed ${data.username}`);
      qc.invalidateQueries({ queryKey: ["social"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const followed = data?.followed || [];
  const feed = data?.feed || [];

  const shareWin = (item: FeedItem) => {
    const text = `🚀 ${item.username} just won ${formatCurrency(item.payout)} on ${item.gameName} at ${item.multiplier.toFixed(2)}×! #TOLSGaming`;
    navigator.clipboard.writeText(text);
    toast.success("Win copied to clipboard — share it!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Users className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Social Feed</h1>
          <p className="text-xs text-muted-foreground">Follow players, see big wins, share the action.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Following</span>
          </div>
          <div className=" text-lg font-bold">{data?.followingCount || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Feed Items</span>
          </div>
          <div className=" text-lg font-bold">{feed.length}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Heart className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Biggest Win</span>
          </div>
          <div className=" text-lg font-bold" style={{ color: "var(--color-lime)" }}>
            {feed.length > 0 ? formatCurrency(Math.max(...feed.map((f) => f.payout))) : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Feed */}
        <div className="space-y-2">
          <h3 className=" text-sm font-semibold uppercase tracking-wide">Recent Big Wins</h3>
          {feed.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/30 py-12 text-center text-sm text-muted-foreground">
              No wins yet. Follow players to see their wins here!
            </div>
          ) : (
            feed.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-3 transition-colors hover:border-lime/30"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: item.avatarColor, color: "var(--color-bg)" }}
                >
                  {item.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{item.username}</span>
                    {item.isFollowed && (
                      <span className="rounded bg-lime/10 px-1 text-[8px] font-bold uppercase text-lime" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" }}>
                        Following
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Won <span className="font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(item.payout)}</span> on {item.gameName}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Bet {formatCurrency(item.amount)} · {item.multiplier.toFixed(2)}× · {timeAgo(item.createdAt)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => shareWin(item)}
                    className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase transition-colors hover:border-lime/40 hover:text-lime"
                    title="Share this win"
                  >
                    <Share2 className="h-2.5 w-2.5" /> Share
                  </button>
                  {!item.isFollowed && (
                    <button
                      onClick={() => {
                        // Find user by username — for demo we use the leaderboard to get IDs
                        // This is a simplified follow; in production we'd have user IDs in the feed
                        toast.info("Follow from Leaderboard or Profile");
                      }}
                      className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase transition-colors hover:border-lime/40 hover:text-lime"
                    >
                      <UserPlus className="h-2.5 w-2.5" /> Follow
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Following list */}
        <aside className="space-y-2">
          <h3 className=" text-sm font-semibold uppercase tracking-wide">
            Following ({followed.length})
          </h3>
          {followed.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/30 p-4 text-center text-xs text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="mb-1">Not following anyone yet.</p>
              <p>Visit the Leaderboard to find players to follow!</p>
            </div>
          ) : (
            followed.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 p-2"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: u.avatarColor, color: "var(--color-bg)" }}
                >
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{u.username}</div>
                  <div className="text-[9px] text-muted-foreground">Level {u.level}</div>
                </div>
                <button
                  onClick={() => followMutation.mutate({ userId: u.id, action: "unfollow" })}
                  className="rounded border border-border/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  Unfollow
                </button>
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
