"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Power, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const GAMES = ["crash", "dice", "mines", "wheel", "keno", "limbo", "plinko", "coinflip", "shoot"];
const MODES = [
  { id: "normal", label: "Normal (fair RNG)" },
  { id: "force_win", label: "Force win" },
  { id: "force_lose", label: "Force lose" },
  { id: "rtp", label: "RTP bias" },
  { id: "streak", label: "Forced streak" },
];

interface Control {
  id: string;
  label: string;
  scope: string;
  userId: string | null;
  username: string | null;
  gameId: string | null;
  mode: string;
  rtpTarget: number;
  winStreak: number;
  loseStreak: number;
  forcedMultiplier: number | null;
  streakPos: number;
  betsAffected: number;
  enabled: boolean;
  priority: number;
  note: string;
}

interface UserLite {
  id: string;
  username: string;
}

export function GameControlsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    label: "",
    scope: "user_game",
    userId: "",
    gameId: "crash",
    mode: "force_win",
    rtpTarget: 0.99,
    winStreak: 3,
    loseStreak: 3,
    forcedMultiplier: "",
    priority: 10,
    note: "",
  });

  const { data: controls, isLoading } = useQuery<Control[]>({
    queryKey: ["game-controls"],
    queryFn: async () => {
      const r = await fetch("/api/admin/game-controls");
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const { data: users } = useQuery<UserLite[]>({
    queryKey: ["users-lite"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users");
      const j = await r.json();
      return (j.data ?? []).map((u: { id: string; username: string }) => ({ id: u.id, username: u.username }));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/game-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          forcedMultiplier: form.forcedMultiplier ? Number(form.forcedMultiplier) : null,
          rtpTarget: Number(form.rtpTarget),
          winStreak: Number(form.winStreak),
          loseStreak: Number(form.loseStreak),
          priority: Number(form.priority),
        }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      toast.success("Control rule created");
      qc.invalidateQueries({ queryKey: ["game-controls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const r = await fetch("/api/admin/game-controls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game-controls"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/game-controls?id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
    },
    onSuccess: () => {
      toast.success("Rule removed");
      qc.invalidateQueries({ queryKey: ["game-controls"] });
    },
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const needsUser = form.scope === "user" || form.scope === "user_game";
  const needsGame = form.scope === "game" || form.scope === "user_game";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-lime)" }}>RTP &amp; Outcome Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Force win/loss, bias RTP, or run forced streaks per user and per game. Applies to live bets in real time.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: "color-mix(in oklab, var(--color-pending) 40%, transparent)", background: "color-mix(in oklab, var(--color-pending) 8%, transparent)" }}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
        <p className="text-xs text-muted-foreground">
          Internal prototype tool for scenario testing by the team. Overrides the provably-fair result, so it must never be enabled on a public, real-money deployment.
        </p>
      </div>

      {/* Create rule */}
      <div className="rounded-xl border border-border/50 p-4" style={{ background: "var(--color-surface)" }}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">New control rule</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Label">
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Cold streak test" />
          </Field>
          <Field label="Scope">
            <select value={form.scope} onChange={(e) => set("scope", e.target.value)} className="h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm">
              <option value="global">Global (all users, all games)</option>
              <option value="game">Per game (all users)</option>
              <option value="user">Per user (all games)</option>
              <option value="user_game">Per user + game</option>
            </select>
          </Field>
          {needsUser && (
            <Field label="User">
              <select value={form.userId} onChange={(e) => set("userId", e.target.value)} className="h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm">
                <option value="">Select user…</option>
                {users?.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </Field>
          )}
          {needsGame && (
            <Field label="Game">
              <select value={form.gameId} onChange={(e) => set("gameId", e.target.value)} className="h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm capitalize">
                {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          )}
          <Field label="Mode">
            <select value={form.mode} onChange={(e) => set("mode", e.target.value)} className="h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm">
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>

          {form.mode === "rtp" && (
            <Field label="RTP target (0=cold, 1=fair, 2=hot)">
              <Input type="number" step="0.05" value={form.rtpTarget} onChange={(e) => set("rtpTarget", e.target.value)} />
            </Field>
          )}
          {form.mode === "streak" && (
            <>
              <Field label="Win streak length">
                <Input type="number" value={form.winStreak} onChange={(e) => set("winStreak", e.target.value)} />
              </Field>
              <Field label="Lose streak length">
                <Input type="number" value={form.loseStreak} onChange={(e) => set("loseStreak", e.target.value)} />
              </Field>
            </>
          )}
          {(form.mode === "force_win" || form.mode === "streak" || form.mode === "rtp") && (
            <Field label="Forced multiplier (optional)">
              <Input type="number" step="0.1" value={form.forcedMultiplier} onChange={(e) => set("forcedMultiplier", e.target.value)} placeholder="auto" />
            </Field>
          )}
          <Field label="Priority">
            <Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || (needsUser && !form.userId)}
            className="btn-press font-semibold"
            style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Add rule</>}
          </Button>
        </div>
      </div>

      {/* Active rules */}
      <div className="rounded-xl border border-border/50 overflow-hidden" style={{ background: "var(--color-surface)" }}>
        <div className="border-b border-border/50 px-4 py-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Active rules</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !controls?.length ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No control rules. Bets use the fair RNG.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {controls.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.label || modeLabel(c.mode)}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "color-mix(in oklab, var(--color-lime) 15%, transparent)", color: "var(--color-lime)" }}>
                      {c.mode.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {scopeText(c)}
                    {c.mode === "streak" && ` · ${c.winStreak}W/${c.loseStreak}L (pos ${c.streakPos})`}
                    {c.mode === "rtp" && ` · target ${c.rtpTarget}`}
                    {c.forcedMultiplier ? ` · ${c.forcedMultiplier}×` : ""}
                    {` · ${c.betsAffected} bets affected`}
                  </p>
                </div>
                {c.mode === "streak" && (
                  <button onClick={() => update.mutate({ id: c.id, resetStreak: true })} title="Reset streak position" className="text-muted-foreground hover:text-lime">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => update.mutate({ id: c.id, enabled: !c.enabled })}
                  title={c.enabled ? "Disable" : "Enable"}
                  className={c.enabled ? "text-lime" : "text-muted-foreground hover:text-foreground"}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => remove.mutate(c.id)} title="Delete" className="text-muted-foreground hover:text-loss">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function modeLabel(mode: string) {
  return MODES.find((m) => m.id === mode)?.label ?? mode;
}

function scopeText(c: Control) {
  if (c.scope === "global") return "All users · all games";
  if (c.scope === "game") return `All users · ${c.gameId}`;
  if (c.scope === "user") return `${c.username ?? c.userId} · all games`;
  return `${c.username ?? c.userId} · ${c.gameId}`;
}
