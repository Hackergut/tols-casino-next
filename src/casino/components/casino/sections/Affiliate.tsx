"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, DollarSign, TrendingUp, Copy, Check, Gift, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/types";
import { useSessionStore } from "@/lib/store";
import { toast } from "sonner";

interface AffiliateData {
  referralCode: string; commissionPlan: string; commissionRate: number; cpaAmount: number;
  totalClicks: number; totalReferrals: number; totalWagered: number; totalCommission: number;
  pendingCommission: number; paidCommission: number;
  referrals: { id: string; playerAlias: string; status: string; totalWagered: number; commissionEarned: number; signupDate: string }[];
  commissionLogs: { id: string; depositAmount: number; commission: number; plan: string; rate: number; currency: string; createdAt: string }[];
}

export function Affiliate() {
  const { user } = useSessionStore();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState("revshare");
  const [rate, setRate] = useState("25");

  const { data: aff } = useQuery<AffiliateData>({
    queryKey: ["affiliate"],
    queryFn: async () => {
      const r = await fetch("/api/affiliate");
      const j = await r.json();
      return j.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPlan: plan, commissionRate: Number(rate) }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      toast.success("Affiliate settings updated");
      qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const referralLink = `https://tols.gg/r/${aff?.referralCode || "TOLS100"}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Referral link copied!");
  };

  const stats = [
    { label: "Total Clicks", value: aff?.totalClicks || 0, icon: TrendingUp, format: (v: number) => formatNumber(v) },
    { label: "Active Referrals", value: aff?.totalReferrals || 0, icon: Users, format: (v: number) => formatNumber(v) },
    { label: "Referred Wagered", value: aff?.totalWagered || 0, icon: DollarSign, format: (v: number) => formatCurrency(v) },
    { label: "Total Earned", value: aff?.totalCommission || 0, icon: Gift, format: (v: number) => formatCurrency(v) },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Users className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Affiliate Program</h1>
          <p className="text-xs text-muted-foreground">Earn lifetime commission on every player you refer.</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="rounded-xl border border-lime/20 bg-gradient-to-br from-lime/5 to-transparent p-4" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
        <div className="mb-2 flex items-center gap-1.5">
          <Link2 className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
          <span className=" text-sm font-semibold uppercase tracking-wide">Your Referral Link</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center rounded-md border border-border/60 bg-background/60 px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-foreground/90">{referralLink}</code>
          </div>
          <Button onClick={copyLink} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
            {copied ? <><Check className="mr-1.5 h-4 w-4" /> Copied</> : <><Copy className="mr-1.5 h-4 w-4" /> Copy</>}
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Referral code: <span className="font-mono font-bold text-lime" style={{ color: "var(--color-lime)" }}>{aff?.referralCode}</span> · Share and earn {aff?.commissionRate || 25}% revshare</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider">{s.label}</span>
              </div>
              <div className=" text-xl font-bold">{s.format(s.value)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Referrals table */}
        <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
          <div className="border-b border-border/40 px-3 py-2">
            <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Referrals ({aff?.referrals.length || 0})</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Wagered</th>
                  <th className="px-3 py-2 text-right font-semibold">Earned</th>
                </tr>
              </thead>
              <tbody>
                {aff?.referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.playerAlias}</div>
                      <div className="text-[9px] text-muted-foreground">{timeAgo(r.signupDate)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        r.status === "deposited" ? "bg-lime/10 text-lime" : r.status === "active" ? "bg-blue-500/10 text-blue-400" : "bg-muted text-muted-foreground"
                      }`} style={r.status === "deposited" ? { background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(r.totalWagered)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(r.commissionEarned)}</td>
                  </tr>
                ))}
                {(!aff?.referrals || aff.referrals.length === 0) && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-muted-foreground">No referrals yet. Share your link!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commission summary + settings */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-card/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Commission Balance</p>
            <div className="mb-3">
              <div className="text-[10px] uppercase text-muted-foreground">Pending</div>
              <div className=" text-2xl font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(aff?.pendingCommission || 0)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[9px] uppercase text-muted-foreground">Paid out</div>
                <div className="font-mono font-bold">{formatCurrency(aff?.paidCommission || 0)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-muted-foreground">Lifetime</div>
                <div className="font-mono font-bold">{formatCurrency(aff?.totalCommission || 0)}</div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-lg border border-border/50 bg-card/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plan Settings</p>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] uppercase">Commission Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revshare">Revshare</SelectItem>
                    <SelectItem value="cpa">CPA</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Revshare Rate (%)</Label>
                <Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min={0} max={50} className="mt-1 h-8 text-xs" />
              </div>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full text-xs uppercase"
                style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
              >
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Settings"}
              </Button>
            </div>
          </div>

          {/* Recent commissions */}
          <div className="rounded-lg border border-border/50 bg-card/40">
            <div className="border-b border-border/40 px-3 py-2">
              <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Commissions</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {aff?.commissionLogs.map((c) => (
                <div key={c.id} className="border-b border-border/30 px-3 py-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    <span className="font-mono font-bold" style={{ color: "var(--color-lime)" }}>+{formatCurrency(c.commission)}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground">on {formatCurrency(c.depositAmount)} deposit · {c.plan} {c.rate}%</div>
                </div>
              ))}
              {(!aff?.commissionLogs || aff.commissionLogs.length === 0) && (
                <div className="py-4 text-center text-[10px] text-muted-foreground">No commissions yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
