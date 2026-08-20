"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { useProvablyFair } from "@/hooks/useProvablyFair";

export function ProvablyFairPanel() {
  const { active, revealed, busy, setClientSeed, rotate, verify } = useProvablyFair();
  const [seedInput, setSeedInput] = useState("");
  const [serverSeed, setServerSeed] = useState("");
  const [nonce, setNonce] = useState("1");
  const [result, setResult] = useState<{ serverSeedHash: string; float: number } | null>(null);

  return (
    <div className="originals-rail-card space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-lime" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Provably Fair</h3>
      </div>

      <div className="space-y-1 text-[11px]">
        <Row label="Server hash" value={active ? `${active.serverSeedHash.slice(0, 18)}…` : "—"} />
        <Row label="Client seed" value={active?.clientSeed ?? "—"} />
        <Row label="Nonce" value={active ? String(active.nonce) : "—"} />
      </div>

      <div className="flex gap-2">
        <input
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="New client seed"
          className="g-bet-display flex-1 text-xs"
        />
        <button disabled={busy || !seedInput.trim()} onClick={() => void setClientSeed(seedInput.trim())} className="g-btn g-btn-secondary px-3 text-[11px]">
          Set
        </button>
      </div>
      <button disabled={busy} onClick={() => void rotate()} className="g-btn g-btn-secondary text-[11px]">
        Rotate & reveal server seed
      </button>

      {revealed[0] && (
        <p className="break-all font-mono text-[10px] text-white/40">
          Last revealed: {revealed[0].serverSeed}
        </p>
      )}

      <div className="border-t border-white/5 pt-3">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-white/35">Verify a round</p>
        <input value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} placeholder="Revealed server seed" className="g-bet-display mb-2 w-full text-xs" />
        <input value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder="Nonce" className="g-bet-display mb-2 w-full text-xs" />
        <button
          disabled={!serverSeed || !active}
          onClick={async () => {
            const out = await verify(serverSeed, active?.clientSeed || "", Number(nonce));
            setResult(out ?? null);
          }}
          className="g-pf-verify"
        >
          Verify HMAC
        </button>
        {result && (
          <div className="mt-2 text-[11px] text-white/70">
            <p>SHA-256 matches: {active && result.serverSeedHash === revealed[0]?.serverSeedHash ? "check previous hash" : result.serverSeedHash.slice(0, 16)}…</p>
            <p className="font-mono text-lime">float = {result.float.toFixed(10)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/35">{label}</span>
      <span className="truncate font-mono text-white/70">{value}</span>
    </div>
  );
}
