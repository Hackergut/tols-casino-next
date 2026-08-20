"use client";

import { useState } from "react";
import { Shield, Eye, Copy, Check, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/types";

interface VerifyResult {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  roll: number;
  hash: string;
}

export function ProvablyFairModal({
  open,
  onOpenChange,
  lastBet,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lastBet?: { clientSeed: string; serverSeedHash: string; nonce: number } | null;
}) {
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState(lastBet?.clientSeed || "");
  const [nonce, setNonce] = useState(String(lastBet?.nonce ?? 0));
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [hash, setHash] = useState("");
  const [roll, setRoll] = useState<number | null>(null);

  const verify = async () => {
    if (!serverSeed || !clientSeed) return;
    const res = await fetch("/api/fair", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverSeed, clientSeed, nonce: Number(nonce) }),
    });
    const json = await res.json();
    if (!json.success) return;
    const nextHash = String(json.data.serverSeedHash);
    const nextRoll = Math.floor(Number(json.data.float) * 10000) / 100;
    setHash(nextHash);
    setRoll(nextRoll);
    setResult({
      serverSeed,
      clientSeed,
      nonce: Number(nonce),
      roll: nextRoll,
      hash: nextHash,
    });
  };

  const copyHash = () => {
    if (hash) {
      navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/60 bg-popover/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-wide">
            <Shield className="h-5 w-5" style={{ color: "var(--color-lime)" }} />
            Provably Fair
          </DialogTitle>
          <DialogDescription>
            Verify that every bet is fair. The server seed hash is shown before you bet; the seed is revealed after.
          </DialogDescription>
        </DialogHeader>

        {/* Explanation */}
        <div className="rounded-lg border border-lime/20 bg-lime/5 p-3 text-xs" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <p className="mb-1.5 font-semibold" style={{ color: "var(--color-lime)" }}>How it works</p>
          <ol className="list-inside list-decimal space-y-0.5 text-muted-foreground">
            <li>Before each bet, we show you the <strong className="text-foreground">hash</strong> of the server seed.</li>
            <li>You provide a <strong className="text-foreground">client seed</strong> (or we generate one).</li>
            <li>Each bet increments a <strong className="text-foreground">nonce</strong>.</li>
            <li>After the bet, you can verify the roll using the revealed seed.</li>
          </ol>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Server Seed (revealed)</Label>
            <Input
              value={serverSeed}
              onChange={(e) => { setServerSeed(e.target.value); setResult(null); }}
              placeholder="Paste the revealed server seed…"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Client Seed</Label>
            <Input
              value={clientSeed}
              onChange={(e) => { setClientSeed(e.target.value); setResult(null); }}
              placeholder="Your client seed"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Nonce (bet number)</Label>
            <Input
              type="number"
              value={nonce}
              onChange={(e) => { setNonce(e.target.value); setResult(null); }}
              placeholder="0"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>

        {/* Computed hash */}
        {serverSeed && (
          <div className="rounded-lg border border-border/50 bg-background/60 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Computed hash (SHA-256)</span>
              <button onClick={copyHash} className="flex items-center gap-1 text-[10px] text-lime hover:underline" style={{ color: "var(--color-lime)" }}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <code className="block break-all font-mono text-[10px] text-foreground/80">{hash || "—"}</code>
          </div>
        )}

        {/* Result */}
        {roll !== null && (
          <div className="rounded-lg border border-lime/30 bg-lime/5 p-4 text-center" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
            <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <Calculator className="h-3 w-3" />
              Verified Roll
            </div>
            <div className="font-mono text-4xl font-bold text-glow-lime" style={{ color: "var(--color-lime)" }}>
              {formatNumber(roll, 2)}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Compare this to the roll shown in your game — they match!
            </p>
          </div>
        )}

        <Button
          onClick={verify}
          disabled={!serverSeed || !clientSeed}
          className="w-full text-sm font-semibold uppercase tracking-wide"
          style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
        >
          <Eye className="mr-1.5 h-4 w-4" /> Verify Bet
        </Button>

        {lastBet && (
          <p className="text-center text-[10px] text-muted-foreground">
            Last bet: client seed <code className="font-mono text-foreground/80">{lastBet.clientSeed}</code> · nonce <code className="font-mono text-foreground/80">{lastBet.nonce}</code>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
