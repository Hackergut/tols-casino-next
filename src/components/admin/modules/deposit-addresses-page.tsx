"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface AddrRow {
  chain: string;
  name: string;
  symbol: string;
  address: string;
  memo: string;
  minConfirmations: number;
  enabled: boolean;
}

export function DepositAddressesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: AddrRow[] }>({
    queryKey: ["admin-deposit-addresses"],
    queryFn: async () => {
      const r = await fetch("/api/admin/deposit-addresses");
      return r.json();
    },
  });

  const [drafts, setDrafts] = useState<Record<string, Partial<AddrRow>>>({});
  const rows = data?.data ?? [];

  const save = useMutation({
    mutationFn: async (row: AddrRow) => {
      const body = { ...row, ...drafts[row.chain] };
      const r = await fetch("/api/admin/deposit-addresses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "Save failed");
      return j;
    },
    onSuccess: () => {
      toast.success("Address saved");
      qc.invalidateQueries({ queryKey: ["admin-deposit-addresses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useCallback((chain: string, field: keyof AddrRow, value: string | number | boolean) => {
    setDrafts((d) => ({ ...d, [chain]: { ...d[chain], [field]: value } }));
  }, []);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading addresses…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/10">
          <Wallet className="h-5 w-5 text-lime" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Deposit addresses</h2>
          <p className="text-sm text-muted-foreground">Public receive addresses only — never paste a seed.</p>
        </div>
      </div>
      {rows.map((row) => {
        const d = { ...row, ...drafts[row.chain] };
        return (
          <Card key={row.chain} className="border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>
                  {row.name} <span className="text-muted-foreground">({row.symbol})</span>
                </span>
                <Switch checked={Boolean(d.enabled)} onCheckedChange={(v) => patch(row.chain, "enabled", v)} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={String(d.address ?? "")}
                onChange={(e) => patch(row.chain, "address", e.target.value)}
                placeholder="Public receive address"
                className="font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={String(d.memo ?? "")}
                  onChange={(e) => patch(row.chain, "memo", e.target.value)}
                  placeholder="Memo / tag (optional)"
                />
                <Input
                  type="number"
                  min={0}
                  max={64}
                  value={Number(d.minConfirmations ?? 2)}
                  onChange={(e) => patch(row.chain, "minConfirmations", Number(e.target.value))}
                />
              </div>
              <Button size="sm" onClick={() => save.mutate(row)} disabled={save.isPending}>
                Save {row.symbol}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
