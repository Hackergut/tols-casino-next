"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Trophy, ArrowDownToLine, ArrowUpFromLine, Gift, Package, Info, Check, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/types";

interface Notification {
  id: string;
  type: "win" | "deposit" | "withdrawal" | "card" | "bonus" | "system" | "social";
  title: string;
  message: string;
  amount?: number;
  createdAt: string;
  read: boolean;
}

const ICONS = {
  win: Trophy,
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  card: Package,
  bonus: Gift,
  system: Info,
  social: Users,
};

const COLORS = {
  win: "var(--color-lime)",
  deposit: "#10b981",
  withdrawal: "#3b82f6",
  card: "var(--color-vip)",
  bonus: "var(--color-pending)",
  system: "var(--color-muted-foreground)",
  social: "#ec4899",
};

function formatAmount(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NotificationsBell() {
  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
          aria-label={`Notifications (${unread} unread)`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[8px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-border/60 bg-popover/95 backdrop-blur-xl">
        <DropdownMenuLabel className="flex items-center justify-between uppercase tracking-wide">
          <span>Notifications</span>
          {unread > 0 && <span className="text-[10px] font-normal text-lime">{unread} new</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No notifications yet.</div>
          ) : (
            notifications.map((n) => {
              const Icon = ICONS[n.type] || Info;
              const color = COLORS[n.type] || "var(--color-muted-foreground)";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 border-b border-border/30 px-3 py-2.5 transition-colors hover:bg-secondary/30 ${!n.read ? "bg-lime/5" : ""}`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: color + "20" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{n.message}</p>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      {n.amount && (
                        <span className="font-mono text-[10px] font-bold" style={{ color }}>
                          {n.type === "withdrawal" ? "-" : "+"}{formatAmount(n.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-center text-[10px] text-muted-foreground">
          <Check className="mr-1 inline h-3 w-3" /> Notifications auto-generated from your activity
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
