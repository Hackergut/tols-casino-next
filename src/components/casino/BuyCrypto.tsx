'use client';

import { useCallback, useEffect, useState } from "react";
import { getBuyConfig, buildBuyUrl } from "@/lib/buy";
import { CreditCard, ExternalLink } from "lucide-react";

/*
 * Buy crypto tab — fiat on-ramp.
 *
 * The player picks a fiat amount + currency, we open the configured provider
 * (MoonPay/Transak) pre-filled to buy USDT and deliver it to the platform's
 * USDT (ERC-20) receive address. When the purchase lands on-chain, the deposit
 * watcher credits the wallet — the player pastes the provider tx hash here so a
 * pending deposit row exists for the watcher to verify.
 */

const FIAT = ["USD", "EUR"];
const PRESETS = [50, 100, 250, 500];

export default function BuyCrypto() {
  const [fiat, setFiat] = useState("USD");
  const [amount, setAmount] = useState(100);
  const [addr, setAddr] = useState("");
  const [addrErr, setAddrErr] = useState("");
  const [txHash, setTxHash] = useState("");
  const [reg, setReg] = useState<{ ok: boolean; msg: string } | null>(null);
  const cfg = getBuyConfig();

  const load = useCallback(async () => {
    setAddrErr("");
    setReg(null);
    try {
      const r = await fetch("/api/deposits/address?chain=usdt_erc20");
      const j = await r.json();
      if (j.success) setAddr(j.data.address);
      else setAddrErr(j.error || "USDT address not configured");
    } catch { setAddrErr("Network error"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const buy = () => {
    if (!cfg.provider || !cfg.key || !addr) return;
    const url = buildBuyUrl({
      provider: cfg.provider,
      key: cfg.key,
      cryptoCode: "USDT",
      walletAddress: addr,
      fiatAmount: amount,
      fiatCurrency: fiat,
    });
    const wa = (window as any).Telegram?.WebApp;
    if (wa?.openLink) wa.openLink(url);
    else window.open(url, "_blank", "noopener");
  };

  const register = async () => {
    setReg(null);
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: "usdt_erc20", amount, currency: "USDT", txHash: txHash.trim() || undefined }),
      });
      const j = await r.json();
      setReg(j.success ? { ok: true, msg: j.data?.message || "Purchase registered — credited after on-chain confirmation." } : { ok: false, msg: j.error || "Failed" });
    } catch { setReg({ ok: false, msg: "Network error" }); }
  };

  const providerName = cfg.provider === "moonpay" ? "MoonPay" : cfg.provider === "transak" ? "Transak" : null;

  return (
    <div className="space-y-4">
      {/* Fiat amount */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">You pay</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: amount === p ? "var(--color-lime)" : "var(--color-surface-raised)", color: amount === p ? "var(--color-bg)" : "var(--color-foreground)" }}
            >
              {p}
            </button>
          ))}
          <div className="flex items-center gap-1 rounded-lg pr-2" style={{ background: "var(--color-surface-raised)" }}>
            <input
              type="number"
              min={10}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
              className="w-20 bg-transparent px-3 py-1.5 text-sm font-semibold outline-none"
              style={{ color: "var(--color-foreground)" }}
            />
            <select value={fiat} onChange={(e) => setFiat(e.target.value)} className="bg-transparent text-xs font-bold outline-none" style={{ color: "var(--color-muted-foreground)" }}>
              {FIAT.map((f) => <option key={f} value={f} style={{ color: "#000" }}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* You get */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3" style={{ background: "var(--color-bg)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">You get (approx)</span>
        <span className="font-mono text-sm font-bold" style={{ color: "var(--color-lime)" }}>≈ {amount} USDT</span>
      </div>

      {/* Provider / buy button */}
      {providerName ? (
        <button
          onClick={buy}
          disabled={!addr}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50"
          style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
        >
          <CreditCard className="h-4 w-4" /> Buy USDT with card via {providerName} <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="rounded-lg border border-border/50 px-4 py-3 text-center text-xs text-muted-foreground" style={{ background: "var(--color-bg)" }}>
          Card purchases aren&apos;t enabled yet. Set <span className="font-mono">NEXT_PUBLIC_BUY_PROVIDER</span> (moonpay/transak) + <span className="font-mono">NEXT_PUBLIC_BUY_API_KEY</span> to activate.
        </div>
      )}

      {/* Destination */}
      <div className="text-[11px] text-muted-foreground">
        {addrErr ? (
          <span style={{ color: "var(--color-loss)" }}>{addrErr} (admin must set the USDT address).</span>
        ) : addr ? (
          <span>Delivered to our USDT address: <span className="font-mono">{addr.slice(0, 10)}…{addr.slice(-6)}</span></span>
        ) : null}
      </div>

      {/* Post-purchase: register tx so the watcher credits */}
      {providerName && addr && (
        <div className="border-t border-border/50 pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">After paying, paste the tx hash to credit</div>
          <div className="flex gap-2">
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x…"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-xs outline-none"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}
            />
            <button onClick={register} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>Register</button>
          </div>
          {reg && <div className="mt-2 text-[11px]" style={{ color: reg.ok ? "var(--color-lime)" : "var(--color-loss)" }}>{reg.msg}</div>}
        </div>
      )}
    </div>
  );
}
