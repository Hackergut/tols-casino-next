"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History, TrendingUp, Award, Hexagon, Diamond, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useUIStore, useSessionStore } from "@/lib/store";
import { formatCurrency, formatNumber, shortAddress, timeAgo } from "@/lib/types";

interface WalletData {
  balance: number; currency: string; vipLevel: number; xp: number;
  totalWagered: number; totalWon: number; depositAddresses: string;
  deposits: { id: string; chain: string; txHash: string; amount: number; currency: string; status: string; createdAt: string }[];
  withdrawals: { id: string; amount: number; currency: string; walletAddress: string; chain: string; status: string; txHash: string; createdAt: string; processedDate: string | null }[];
}

const CHAINS = [
  { id: "solana", name: "Solana", icon: Coins, color: "#9945FF" },
  { id: "ethereum", name: "Ethereum", icon: Hexagon, color: "#627EEA" },
  { id: "polygon", name: "Polygon", icon: Diamond, color: "#8247E5" },
];

export function WalletSection() {
  const { setDepositOpen } = useUIStore();
  const { balance } = useSessionStore();

  const { data: wallet } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet");
      const j = await r.json();
      return j.data;
    },
  });

  let depositAddresses: Record<string, string> = {};
  try { depositAddresses = JSON.parse(wallet?.depositAddresses || "{}"); } catch {}

  const vipProgress = ((wallet?.xp || 0) % 1000) / 10;
  const totalTransactions = (wallet?.deposits.length || 0) + (wallet?.withdrawals.length || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Wallet className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">My Wallet</h1>
          <p className="text-xs text-muted-foreground">Manage your balance, deposits, and withdrawals.</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-xl border border-lime/20 p-5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
        <div className="absolute inset-0 bg-grid-lime opacity-20" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime/10 blur-3xl" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Balance</p>
            <p className=" text-4xl font-bold text-glow-lime" style={{ color: "var(--color-lime)" }}>{formatCurrency(balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{wallet?.currency} · {totalTransactions} transactions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setDepositOpen(true)} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
              <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Deposit
            </Button>
            <Button onClick={() => setDepositOpen(true)} variant="outline" className=" uppercase border-lime/40 text-lime" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", color: "var(--color-lime)" }}>
              <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Wagered", value: wallet?.totalWagered || 0, icon: TrendingUp, color: "var(--color-lime)" },
          { label: "Total Won", value: wallet?.totalWon || 0, icon: Award, color: "#10b981" },
          { label: "VIP Level", value: wallet?.vipLevel || 1, icon: Award, color: "var(--color-vip)", isNumber: true },
          { label: "XP", value: wallet?.xp || 0, icon: TrendingUp, color: "#3b82f6", isNumber: true },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider">{s.label}</span>
              </div>
              <div className=" text-xl font-bold" style={{ color: s.color }}>
                {s.isNumber ? formatNumber(s.value) : formatCurrency(s.value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* VIP progress */}
      <div className="rounded-lg border border-border/50 bg-card/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className=" text-sm font-semibold uppercase tracking-wide">VIP Tier {wallet?.vipLevel || 1}</span>
          <span className="text-xs text-muted-foreground">{vipProgress.toFixed(0)}% to next tier</span>
        </div>
        <Progress value={vipProgress} className="h-2" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }} />
        <p className="mt-2 text-[10px] text-muted-foreground">Wager more to unlock rakeback, weekly bonuses, and a dedicated VIP host.</p>
      </div>

      {/* Deposit addresses */}
      <div className="rounded-lg border border-border/50 bg-card/40 p-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide">Deposit Addresses</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHAINS.map((c) => {
            const Icon = c.icon;
            const addr = depositAddresses[c.id] || `tols-${c.id}-` + "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
            return (
              <div key={c.id} className="rounded-md border border-border/50 bg-background/40 p-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                  <span className="text-xs font-medium">{c.name}</span>
                </div>
                <code className="block truncate font-mono text-[10px] text-muted-foreground">{shortAddress(addr, 8)}</code>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction history */}
      <Tabs defaultValue="deposits">
        <TabsList className="bg-background/60">
          <TabsTrigger value="deposits" className="gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5" /> Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="pt-3">
          <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Chain</th>
                    <th className="px-3 py-2 font-semibold">Tx Hash</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet?.deposits.map((d) => (
                    <tr key={d.id} className="border-t border-border/30">
                      <td className="px-3 py-2 capitalize">{d.chain}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{shortAddress(d.txHash, 6)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "var(--color-lime)" }}>+{formatCurrency(d.amount)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-lime/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-lime" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" }}>{d.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">{timeAgo(d.createdAt)}</td>
                    </tr>
                  ))}
                  {(!wallet?.deposits || wallet.deposits.length === 0) && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">No deposits yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="pt-3">
          <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Chain</th>
                    <th className="px-3 py-2 font-semibold">Address</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet?.withdrawals.map((w) => (
                    <tr key={w.id} className="border-t border-border/30">
                      <td className="px-3 py-2 capitalize">{w.chain}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{shortAddress(w.walletAddress, 6)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-red-400">-{formatCurrency(w.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          w.status === "completed" ? "bg-lime/10 text-lime" : w.status === "pending" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                        }`} style={w.status === "completed" ? { background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">{timeAgo(w.createdAt)}</td>
                    </tr>
                  ))}
                  {(!wallet?.withdrawals || wallet.withdrawals.length === 0) && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">No withdrawals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
