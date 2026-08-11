"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Loader2, Shield, Eye, EyeOff, Code, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, timeAgo } from "@/lib/types";
import { toast } from "sonner";

interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreatedKey {
  id: string;
  key: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  message: string;
}

const SCOPE_INFO = {
  read: { label: "Read", desc: "View stats, users, bets, withdrawals", color: "#3b82f6" },
  write: { label: "Write", desc: "Approve withdrawals, update users", color: "var(--color-pending)" },
  admin: { label: "Admin", desc: "Full access including API key management", color: "var(--color-lime)" },
};

export function ApiKeyManagement() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<CreatedKey | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiresDays, setExpiresDays] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: keys } = useQuery<ApiKeyInfo[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const r = await fetch("/api/admin/api-keys");
      if (!r.ok) {
        // If not authenticated via session, try with a stored key
        const storedKey = localStorage.getItem("tols-admin-key");
        if (storedKey) {
          const r2 = await fetch("/api/admin/api-keys", {
            headers: { "x-api-key": storedKey },
          });
          const j2 = await r2.json();
          return j2.data;
        }
        return [];
      }
      const j = await r.json();
      return j.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scopes,
          expiresDays: expiresDays ? Number(expiresDays) : null,
        }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data as CreatedKey;
    },
    onSuccess: (data) => {
      setNewKey(data);
      setCreateOpen(false);
      setName("");
      setScopes(["read"]);
      setExpiresDays("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created — copy it now, it won't be shown again!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const storedKey = localStorage.getItem("tols-admin-key");
      const r = await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
        headers: storedKey ? { "x-api-key": storedKey } : {},
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      if (prev.includes(scope)) {
        // Can't remove admin if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== scope);
      }
      // Adding admin implies write+read
      if (scope === "admin") return ["read", "write", "admin"];
      if (scope === "write" && !prev.includes("read")) return ["read", "write"];
      return [...prev, scope];
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Key className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div className="flex-1">
          <h1 className=" text-xl font-bold uppercase tracking-wide">API Keys</h1>
          <p className="text-xs text-muted-foreground">Manage API keys for external admin backend integration.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
          <Plus className="mr-1.5 h-4 w-4" /> Generate Key
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <div className="flex items-start gap-2">
          <Code className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div className="text-xs">
            <p className="mb-1 font-semibold text-blue-400">How to use API keys</p>
            <p className="text-muted-foreground">
              Pass your API key in the <code className="rounded bg-background/60 px-1 font-mono text-blue-300">x-api-key</code> header
              or as <code className="rounded bg-background/60 px-1 font-mono text-blue-300">Authorization: Bearer &lt;key&gt;</code> when calling admin endpoints.
              All admin routes are prefixed with <code className="rounded bg-background/60 px-1 font-mono text-blue-300">/api/admin/</code>.
            </p>
          </div>
        </div>
      </div>

      {/* API keys table */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
        <div className="border-b border-border/40 px-3 py-2">
          <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Active Keys ({keys?.length || 0})
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {keys && keys.length > 0 ? (
            keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 border-b border-border/30 px-3 py-2.5 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-background/40">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <code className="rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{k.keyPrefix}…</code>
                    {k.active ? (
                      <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase" style={{ borderColor: "var(--color-lime)", color: "var(--color-lime)" }}>Active</Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase text-muted-foreground">Revoked</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {k.scopes.map((s) => (
                      <span key={s} className="rounded px-1 py-0.5 font-medium uppercase" style={{ background: SCOPE_INFO[s as keyof typeof SCOPE_INFO]?.color + "20", color: SCOPE_INFO[s as keyof typeof SCOPE_INFO]?.color }}>
                        {SCOPE_INFO[s as keyof typeof SCOPE_INFO]?.label}
                      </span>
                    ))}
                    <span>· Created {timeAgo(k.createdAt)}</span>
                    {k.lastUsedAt && <span>· Last used {timeAgo(k.lastUsedAt)}</span>}
                    {k.expiresAt && <span>· Expires {timeAgo(k.expiresAt)}</span>}
                  </div>
                </div>
                {k.active && (
                  <button
                    onClick={() => {
                      if (confirm(`Revoke API key "${k.name}"? This cannot be undone.`)) {
                        revokeMutation.mutate(k.id);
                      }
                    }}
                    className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" /> Revoke
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <Key className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
              <p className="text-[10px] text-muted-foreground">Generate one to connect your admin backend.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-border/60 bg-popover/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className=" text-xl font-bold uppercase tracking-wide">Generate API Key</DialogTitle>
            <DialogDescription>Create a new API key for external backend access.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Key Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Admin Dashboard, CRM Bot, Analytics"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Scopes</Label>
              <div className="mt-1.5 space-y-1.5">
                {Object.entries(SCOPE_INFO).map(([scope, info]) => {
                  const active = scopes.includes(scope);
                  return (
                    <button
                      key={scope}
                      onClick={() => toggleScope(scope)}
                      className={`flex w-full items-center gap-2 rounded-md border p-2 text-left transition-all ${
                        active ? "border-lime/40 bg-lime/5" : "border-border/50"
                      }`}
                      style={active ? { borderColor: info.color + "60", background: info.color + "10" } : {}}
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded border" style={{ borderColor: active ? info.color : "#4a5568", background: active ? info.color : "transparent" }}>
                        {active && <Check className="h-2.5 w-2.5 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold" style={{ color: active ? info.color : undefined }}>{info.label}</div>
                        <div className="text-[10px] text-muted-foreground">{info.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs">Expires After (days, optional)</Label>
              <Input
                type="number"
                value={expiresDays}
                onChange={(e) => setExpiresDays(e.target.value)}
                placeholder="Never (leave empty)"
                className="mt-1"
              />
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || createMutation.isPending}
              className="w-full uppercase"
              style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New key reveal dialog */}
      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null); }}>
        <DialogContent className="max-w-lg border-border/60 bg-popover/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-wide">
              <Shield className="h-5 w-5" style={{ color: "var(--color-lime)" }} />
              API Key Created
            </DialogTitle>
            <DialogDescription>{newKey?.message}</DialogDescription>
          </DialogHeader>

          {newKey && (
            <div className="space-y-3">
              {/* Key display */}
              <div className="rounded-lg border border-lime/30 bg-lime/5 p-3" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your API Key</span>
                  <button onClick={() => setShowKey((s) => !s)} className="text-muted-foreground hover:text-foreground">
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-xs" style={{ color: "var(--color-lime)" }}>
                    {showKey ? newKey.key : "tols_sk_" + "•".repeat(32)}
                  </code>
                  <button
                    onClick={copyKey}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 hover:bg-secondary"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-lime" style={{ color: "var(--color-lime)" }} /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Key info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-border/50 bg-background/40 p-2">
                  <div className="text-[9px] uppercase text-muted-foreground">Name</div>
                  <div className="font-semibold">{newKey.name}</div>
                </div>
                <div className="rounded border border-border/50 bg-background/40 p-2">
                  <div className="text-[9px] uppercase text-muted-foreground">Scopes</div>
                  <div className="font-semibold capitalize">{newKey.scopes.join(", ")}</div>
                </div>
              </div>

              {/* Usage example */}
              <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Usage Example</div>
                <pre className="overflow-x-auto text-[10px] leading-relaxed text-muted-foreground"><code>{`# Get platform stats
curl /api/admin/stats \\
  -H "x-api-key: ${newKey.key}"

# List users
curl /api/admin/users?limit=10 \\
  -H "x-api-key: ${newKey.key}"

# Approve withdrawal
curl -X POST /api/admin/withdrawals/ID/approve \\
  -H "x-api-key: ${newKey.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"approve"}'`}</code></pre>
              </div>

              <Button
                onClick={() => { copyKey(); setNewKey(null); }}
                className="w-full uppercase"
                style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
              >
                <Check className="mr-1.5 h-4 w-4" /> I've Saved It — Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
