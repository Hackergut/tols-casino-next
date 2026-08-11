"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, Clock, DollarSign, TrendingDown, Gamepad2, AlertTriangle, Loader2, Check, Ban, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, timeAgo } from "@/lib/types";
import { toast } from "sonner";

interface Limit {
  id: string;
  type: string;
  limitValue: number;
  period: string;
  active: boolean;
  excludeUntil: string | null;
  createdAt: string;
}

const LIMIT_TYPES = [
  { id: "deposit", label: "Deposit Limit", icon: DollarSign, desc: "Cap how much you can deposit in a period." },
  { id: "loss", label: "Loss Limit", icon: TrendingDown, desc: "Stop playing once you lose a set amount." },
  { id: "wager", label: "Wager Limit", icon: Gamepad2, desc: "Cap the total amount you can bet." },
  { id: "session", label: "Session Time", icon: Clock, desc: "Limit how long you can play per session (minutes)." },
];

const PERIODS = ["daily", "weekly", "monthly", "permanent"];

export function ResponsibleGaming() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("limits");
  const [type, setType] = useState("deposit");
  const [period, setPeriod] = useState("daily");
  const [value, setValue] = useState("");

  const { data: limits } = useQuery<Limit[]>({
    queryKey: ["limits"],
    queryFn: async () => {
      const r = await fetch("/api/limits");
      const j = await r.json();
      return j.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { type, period };
      if (type === "session") payload.limitValue = Number(value);
      else if (type === "self_exclusion") payload.excludeUntil = value;
      else payload.limitValue = Number(value);
      const r = await fetch("/api/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      toast.success("Limit set successfully");
      qc.invalidateQueries({ queryKey: ["limits"] });
      setValue("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (limit: { id: string; active: boolean }) => {
      const r = await fetch("/api/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: limit.id, active: !limit.active }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["limits"] });
      toast.success("Limit updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!value && type !== "self_exclusion") {
      toast.error("Enter a value");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Shield className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Responsible Gaming</h1>
          <p className="text-xs text-muted-foreground">Stay in control. Set limits, take breaks, or self-exclude.</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-xs">
            <p className="mb-1 font-semibold text-amber-500">Need help? Gambling should be fun, not stressful.</p>
            <p className="text-muted-foreground">
              If gambling is affecting your life, reach out to a helpline. TOLS is a demo platform with no real money, but these tools
              mirror real-world responsible gaming features. Set limits below to practice safe play habits.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Limits" value={limits?.filter((l) => l.active).length || 0} icon={Shield} />
        <StatCard label="Deposit Cap" value={limits?.find((l) => l.type === "deposit" && l.active) ? formatCurrency(limits.find((l) => l.type === "deposit")!.limitValue) : "None"} icon={DollarSign} />
        <StatCard label="Session Cap" value={limits?.find((l) => l.type === "session" && l.active) ? `${limits.find((l) => l.type === "session")!.limitValue} min` : "None"} icon={Clock} />
        <StatCard label="Self-Excluded" value={limits?.some((l) => l.type === "self_exclusion" && l.active) ? "Yes" : "No"} icon={Ban} highlight={limits?.some((l) => l.type === "self_exclusion" && l.active)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Set limit form */}
        <div className="rounded-lg border border-border/50 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Set a Limit</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Limit Type</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {LIMIT_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex items-center gap-1.5 rounded-md border p-2 text-left transition-all ${
                        active ? "border-lime/50 bg-lime/5" : "border-border/50"
                      }`}
                      style={active ? { borderColor: "color-mix(in oklab, var(--color-lime) 50%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" } : {}}
                    >
                      <Icon className="h-3.5 w-3.5" style={active ? { color: "var(--color-lime)" } : {}} />
                      <span className="text-[11px] font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs">Period</Label>
              <div className="mt-1.5 flex gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 rounded-md border py-1.5 text-[11px] font-medium capitalize transition-all ${
                      period === p ? "border-lime/50 bg-lime/5 text-lime" : "border-border/50 text-muted-foreground"
                    }`}
                    style={period === p ? { borderColor: "color-mix(in oklab, var(--color-lime) 50%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)", color: "var(--color-lime)" } : {}}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">
                {type === "session" ? "Minutes" : type === "self_exclusion" ? "Excluded Until (date)" : "Amount (USDT)"}
              </Label>
              <Input
                type={type === "self_exclusion" ? "date" : "number"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "session" ? "60" : type === "self_exclusion" ? "" : "100"}
                className="mt-1"
              />
            </div>

            <Button
              onClick={submit}
              disabled={createMutation.isPending}
              className="w-full text-sm font-semibold uppercase tracking-wide"
              style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Set ${LIMIT_TYPES.find((t) => t.id === type)?.label}`}
            </Button>
          </div>
        </div>

        {/* Active limits list */}
        <div className="rounded-lg border border-border/50 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Your Limits</h3>
          {limits && limits.length > 0 ? (
            <div className="space-y-2">
              {limits.map((l) => {
                const meta = LIMIT_TYPES.find((t) => t.id === l.type);
                const Icon = meta?.icon || Shield;
                return (
                  <div key={l.id} className={`flex items-center gap-2 rounded-md border p-2.5 ${l.active ? "border-border/50 bg-background/40" : "border-border/30 bg-background/20 opacity-60"}`}>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold capitalize">{l.type.replace("_", " ")}</span>
                        <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase">{l.period}</Badge>
                        {l.active ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-lime" style={{ color: "var(--color-lime)" }}>
                            <Check className="h-2.5 w-2.5" /> Active
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground">Inactive</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.type === "session" ? `${l.limitValue} min` : l.type === "self_exclusion" ? `Until ${l.excludeUntil?.split("T")[0]}` : formatCurrency(l.limitValue)} · {timeAgo(l.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleMutation.mutate({ id: l.id, active: l.active })}
                      className="rounded border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase transition-colors hover:bg-secondary"
                    >
                      {l.active ? "Pause" : "Resume"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No limits set yet.</p>
              <p className="text-[10px] text-muted-foreground">Protect yourself by setting a limit above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Self-exclusion CTA */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <h3 className=" text-sm font-semibold uppercase tracking-wide text-red-500">Self-Exclusion</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Need a break? Self-exclusion blocks you from all gambling activity for a set period. This action is serious —
              you won't be able to bet until the exclusion period ends.
            </p>
          </div>
          <Button
            onClick={() => { setType("self_exclusion"); setPeriod("permanent"); }}
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
          >
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Exclude
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={` text-lg font-bold ${highlight ? "text-red-500" : ""}`}>{value}</div>
    </div>
  );
}
