'use client';

import { useCallback, useEffect, useState } from "react";
import { CHAINS, CHAIN_IDS } from "@/lib/chains";

/*
 * Unified deposit panel — Shuffle.com-style crypto QR + Telegram Stars.
 *
 * Two rails share one amount:
 *   1. Crypto: a branded QR card (chain pill, big QR, address + copy, memo
 *      warning, min confirmations). The address is the admin-configured receive
 *      address (watch-only, no private key). The player registers the tx after
 *      sending; the on-chain watcher auto-credits when confirmed.
 *   2. Telegram Stars (the in-app wallet): only shown inside Telegram. Creates
 *      an XTR invoice, opens it via WebApp.openInvoice, and polls the backend
 *      until the webhook credits the balance.
 */

const PRESETS = [10, 25, 50, 100];

export default function DepositPanel() {
  const [chain, setChain] = useState("btc");
  const [amount, setAmount] = useState(50);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addrErr, setAddrErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [reg, setReg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [stars, setStars] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });

  const isTg =
    typeof window !== "undefined" && !!(window as any).Telegram?.WebApp && !!(window as any).Telegram?.WebApp?.initData;

  const load = useCallback(async () => {
    setLoading(true);
    setAddrErr("");
    setReg(null);
    try {
      const r = await fetch(`/api/deposits/address?chain=${chain}&amount=${amount}`);
      const j = await r.json();
      if (j.success) setData(j.data);
      else { setData(null); setAddrErr(j.error || "Address not configured for this chain"); }
    } catch { setAddrErr("Network error"); }
    setLoading(false);
  }, [chain, amount]);

  useEffect(() => { load(); }, [chain, amount]);

  const copy = async () => {
    if (!data?.address) return;
    try { await navigator.clipboard.writeText(data.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const register = async () => {
    setReg(null);
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, amount, currency: data?.symbol || "USDT", txHash: txHash.trim() || undefined }),
      });
      const j = await r.json();
      setReg(j.success ? { ok: true, msg: j.data?.message || "Deposit registered. Credited after on-chain confirmation." } : { ok: false, msg: j.error || "Failed" });
    } catch { setReg({ ok: false, msg: "Network error" }); }
  };

  const payWithStars = async () => {
    const wa = (window as any).Telegram?.WebApp;
    if (!wa) return setStars({ busy: false, msg: "Open this inside Telegram to pay with Stars." });
    setStars({ busy: true, msg: "Creating invoice..." });
    try {
      const r = await fetch("/api/payments/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdt: amount }),
      });
      const j = await r.json();
      if (!j.success) return setStars({ busy: false, msg: j.error || "Invoice failed" });
      const { invoiceLink, depositId } = j.data;
      setStars({ busy: true, msg: "Awaiting Stars payment..." });
      // openInvoice reports status from Telegram itself; we still confirm via
      // the server (the webhook credits), polling status until paid.
      wa.openInvoice?.(invoiceLink, (status: string) => {
        if (status === "paid") pollStars(depositId);
        else setStars({ busy: false, msg: status === "cancelled" ? "Payment cancelled." : "Payment pending." });
      });
    } catch { setStars({ busy: false, msg: "Network error" }); }
  };

  const pollStars = async (depositId: string) => {
    setStars({ busy: true, msg: "Confirming on server..." });
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      try {
        const r = await fetch(`/api/payments/stars/status?depositId=${depositId}`);
        const j = await r.json();
        if (j?.data?.status === "paid") { setStars({ busy: false, msg: "Paid! Balance credited." }); window.location.reload(); return; }
        if (j?.data?.status === "failed") { setStars({ busy: false, msg: "Payment failed." }); return; }
      } catch {}
    }
    setStars({ busy: false, msg: "Confirmation timed out — your balance updates once the webhook lands." });
  };

  const meta = CHAINS[chain];

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {/* Amount */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (USDT)</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{
                background: amount === p ? "var(--color-lime)" : "var(--color-surface-raised)",
                color: amount === p ? "var(--color-bg)" : "var(--color-foreground)",
              }}
            >
              {p}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
            className="w-24 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none"
            style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}
          />
        </div>
      </div>

      {/* Chain pills */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Network</div>
        <div className="flex flex-wrap gap-2">
          {CHAIN_IDS.map((id) => {
            const c = CHAINS[id];
            const active = id === chain;
            return (
              <button
                key={id}
                onClick={() => setChain(id)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: active ? "var(--color-lime)" : "var(--color-surface-raised)",
                  color: active ? "var(--color-bg)" : "var(--color-foreground)",
                  boxShadow: active ? `0 0 0 2px ${c.color}66` : "none",
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telegram Stars rail (only inside Telegram) */}
      {isTg && (
        <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Pay with Telegram Stars</div>
              <div className="text-xs text-muted-foreground">Telegram's in-app wallet · instant</div>
            </div>
            <button
              onClick={payWithStars}
              disabled={stars.busy}
              className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
              style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
            >
              {stars.busy ? "..." : `⭐ Pay`}
            </button>
          </div>
          {stars.msg && <div className="mt-2 text-xs text-muted-foreground">{stars.msg}</div>}
        </div>
      )}

      {/* Crypto QR card (Shuffle-style) */}
      <div className="overflow-hidden rounded-2xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="text-sm font-bold">Deposit {amount} {meta?.symbol ?? ""}</div>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: meta?.color }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta?.color }} />
            {meta?.name}
          </div>
        </div>

        <div className="flex flex-col items-center px-4 py-5">
          {addrErr ? (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl text-center text-xs text-muted-foreground" style={{ background: "var(--color-surface-raised)" }}>
              {addrErr}<br />(admin must set the {meta?.name} address)
            </div>
          ) : loading ? (
            <div className="h-56 w-56 animate-pulse rounded-xl" style={{ background: "var(--color-surface-raised)" }} />
          ) : (
            <div className="relative rounded-2xl bg-white p-3" style={{ boxShadow: `0 0 0 2px ${meta?.color}55, 0 12px 30px rgba(0,0,0,.4)` }}>
              {data?.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.qr} alt="Deposit QR" className="h-48 w-48" />
              ) : null}
              <div
                className="absolute -left-2 -top-2 flex h-10 w-10 items-center justify-center rounded-xl text-xs font-extrabold"
                style={{ background: meta?.color, color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}
              >
                {meta?.symbol?.slice(0, 3)}
              </div>
            </div>
          )}

          {/* Address */}
          {data?.address && (
            <button onClick={copy} className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left" style={{ background: "var(--color-surface-raised)" }}>
              <span className="truncate font-mono text-xs" style={{ color: "var(--color-foreground)" }}>{data.address}</span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: copied ? "var(--color-lime)" : "var(--color-muted-foreground)" }}>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}

          <div className="mt-3 w-full space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <div>Send exactly <b style={{ color: "var(--color-foreground)" }}>{amount} {meta?.symbol}</b> to the address above.</div>
            {data?.memo ? <div style={{ color: "var(--color-loss)" }}>⚠ Memo required: <b>{data.memo}</b></div> : null}
            <div>Minimum {data?.minConfirmations ?? 2} network confirmations. Credited automatically once verified on-chain.</div>
          </div>
        </div>

        {/* Register sent payment */}
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--color-border-strong)" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Already sent? Paste your tx hash</div>
          <div className="flex gap-2">
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x… / tx id"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-xs outline-none"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}
            />
            <button onClick={register} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>Register</button>
          </div>
          {reg && <div className="mt-2 text-[11px]" style={{ color: reg.ok ? "var(--color-lime)" : "var(--color-loss)" }}>{reg.msg}</div>}
        </div>
      </div>
    </div>
  );
}
