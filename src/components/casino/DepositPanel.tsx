'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAINS, CHAIN_IDS } from "@/lib/chains";
import CoinIcon from "./CoinIcon";

/*
 * Deposit panel — pick a USD amount + network and the deposit address is shown
 * statically right there (it's the platform's fixed receive address, not a
 * per-user wallet). Each deposit gets a UNIQUE crypto amount so the balance
 * credits itself once the payment lands — no tx hash required from the player.
 *
 * Fully responsive; original coin logos; all colours from theme tokens.
 */

const PRESETS = [10, 25, 50, 100];

// Format a crypto amount without rounding away the unique fingerprint.
function fmtCrypto(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return parseFloat(n.toFixed(8)).toString();
}

type Intent = {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  color: string;
  address: string;
  memo: string | null;
  minConfirmations: number;
  amount: number;
  amountUsd: number;
  qr: string | null;
  userRef: string;
};

export default function DepositPanel() {
  const [chain, setChain] = useState("btc");
  const [amount, setAmount] = useState(50);

  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [copied, setCopied] = useState<null | "addr" | "amt">(null);
  const [status, setStatus] = useState<"waiting" | "credited">("waiting");
  const [stars, setStars] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTg =
    typeof window !== "undefined" && !!(window as any).Telegram?.WebApp && !!(window as any).Telegram?.WebApp?.initData;

  const meta = CHAINS[chain];

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Poll deposit history until the current intent is credited.
  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/deposits");
        const j = await r.json();
        const row = Array.isArray(j?.data) ? j.data.find((d: any) => d.id === id) : null;
        if (row?.credited) {
          setStatus("credited");
          stopPolling();
          setTimeout(() => window.location.reload(), 2200);
        }
      } catch { /* keep polling */ }
    }, 15000);
  }, []);

  // Load (or reuse) the deposit intent for the current selection. The address
  // is static; only the unique amount + QR are (re)issued per selection.
  const loadIntent = useCallback(async (ch: string, usd: number) => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: ch, amountUsd: usd }),
      });
      const j = await r.json();
      if (j.success) {
        setIntent(j.data);
        setStatus("waiting");
        startPolling(j.data.id);
      } else {
        setIntent(null);
        setErr(j.error || "Deposits for this network aren’t available yet");
      }
    } catch {
      setIntent(null);
      setErr("Network error");
    }
    setLoading(false);
  }, [startPolling]);

  // Debounced reload whenever the selection changes (so typing a custom amount
  // doesn't fire a request per keystroke).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadIntent(chain, amount), 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [chain, amount, loadIntent]);

  useEffect(() => () => stopPolling(), []);

  const copyText = async (text: string, which: "addr" | "amt") => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 1500); } catch {}
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
      wa.openInvoice?.(invoiceLink, (st: string) => {
        if (st === "paid") pollStars(depositId);
        else setStars({ busy: false, msg: st === "cancelled" ? "Payment cancelled." : "Payment pending." });
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

  const lime = "var(--color-lime)";
  const raised = "var(--color-surface-raised)";
  const color = intent?.color ?? meta?.color;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* Amount */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (USD)</div>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className="rounded-lg py-2 text-sm font-bold transition-colors"
              style={{
                background: amount === p ? lime : raised,
                color: amount === p ? "var(--color-bg)" : "var(--color-foreground)",
              }}
            >
              ${p}
            </button>
          ))}
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
            className="w-full rounded-lg py-2 pl-7 pr-3 text-sm font-semibold outline-none"
            style={{ background: raised, color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}
          />
        </div>
      </div>

      {/* Network — original coin logos */}
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
                className="flex items-center gap-1.5 rounded-lg py-1.5 pl-1.5 pr-2.5 text-xs font-semibold transition-all"
                style={{
                  background: active ? lime : raised,
                  color: active ? "var(--color-bg)" : "var(--color-foreground)",
                  boxShadow: active ? `0 0 0 2px ${c.color}66` : "none",
                }}
              >
                <CoinIcon chain={id} size={18} />
                {c.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telegram Stars (only inside Telegram) */}
      {isTg && (
        <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Pay with Telegram Stars</div>
              <div className="text-xs text-muted-foreground">Telegram’s in-app wallet · instant</div>
            </div>
            <button
              onClick={payWithStars}
              disabled={stars.busy}
              className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
              style={{ background: lime, color: "var(--color-bg)" }}
            >
              {stars.busy ? "..." : `⭐ Pay`}
            </button>
          </div>
          {stars.msg && <div className="mt-2 text-xs text-muted-foreground">{stars.msg}</div>}
        </div>
      )}

      {/* Deposit card — static address + unique amount, shown directly */}
      <div className="overflow-hidden rounded-2xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <CoinIcon chain={chain} size={22} />
            <span className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>{meta?.name}</span>
          </div>
          {loading ? (
            <span className="text-[11px] font-semibold text-muted-foreground">Updating…</span>
          ) : status === "credited" ? (
            <span className="text-[11px] font-bold" style={{ color: lime }}>✓ Credited</span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: color }} />
              Awaiting transfer
            </span>
          )}
        </div>

        {err && !intent ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{err}</div>
        ) : (
          <div className="flex flex-col items-center px-4 py-4">
            {/* QR */}
            <div className="relative rounded-2xl bg-white p-3" style={{ boxShadow: `0 0 0 2px ${color}55, 0 12px 30px rgba(0,0,0,.4)` }}>
              {intent?.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={intent.qr} alt="Deposit QR" className="h-44 w-44 sm:h-52 sm:w-52" style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }} />
              ) : (
                <div className="h-44 w-44 animate-pulse rounded-lg bg-black/10 sm:h-52 sm:w-52" />
              )}
              <div
                className="absolute -left-2 -top-2 h-9 w-9 overflow-hidden rounded-full"
                style={{ boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}
              >
                <CoinIcon chain={chain} size={36} />
              </div>
            </div>

            {/* Exact amount to send — the headline */}
            <div
              onClick={() => intent && copyText(fmtCrypto(intent.amount), "amt")}
              className="mt-4 w-full cursor-pointer rounded-xl px-3 py-3 text-center transition-colors"
              style={{ background: raised, border: `1px solid ${color}44` }}
            >
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Send exactly · {copied === "amt" ? "copied!" : "tap to copy"}
              </div>
              <div className="mt-0.5 break-all font-mono text-xl font-extrabold" style={{ color: "var(--color-foreground)" }}>
                {intent ? `${fmtCrypto(intent.amount)} ${intent.symbol}` : "…"}
              </div>
              <div className="text-xs font-semibold" style={{ color: lime }}>≈ ${intent?.amountUsd ?? amount}</div>
            </div>

            {/* Static address */}
            <button
              onClick={() => intent && copyText(intent.address, "addr")}
              disabled={!intent}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left"
              style={{ background: raised }}
            >
              <span className="truncate font-mono text-xs" style={{ color: "var(--color-foreground)" }}>{intent?.address ?? "…"}</span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: copied === "addr" ? lime : "var(--color-muted-foreground)" }}>
                {copied === "addr" ? "Copied" : "Copy"}
              </span>
            </button>

            <div className="mt-3 w-full space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <div>
                Send the <b style={{ color: "var(--color-foreground)" }}>exact amount</b> above — the unique figure is how the payment is matched to you automatically.
              </div>
              {intent?.memo ? <div style={{ color: "var(--color-loss)" }}>⚠ Memo/Tag required: <b>{intent.memo}</b></div> : null}
              <div>{intent?.minConfirmations ?? 2} network confirmations required. Credited automatically — no action needed.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
