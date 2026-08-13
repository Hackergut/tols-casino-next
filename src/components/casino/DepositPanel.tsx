'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAINS, CHAIN_IDS } from "@/lib/chains";

/*
 * Deposit panel — pick a USD amount + network, lock a UNIQUE crypto amount, and
 * the balance credits itself once the payment lands. No tx hash required: the
 * server fingerprints each deposit's amount and the watcher matches it on-chain
 * (pasting a hash is offered only to speed things up).
 *
 * Fully responsive: the card, QR and controls scale from a narrow phone modal
 * up to desktop. All colours come from theme tokens.
 */

const PRESETS = [10, 25, 50, 100];

// Format a crypto amount without rounding away the unique fingerprint.
function fmtCrypto(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return parseFloat(n.toFixed(8)).toString();
}

type Preview = {
  amountCrypto: number | null;
  priceUsd: number | null;
  priceUnavailable?: boolean;
  addressAvailable: boolean;
  error?: string;
};

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

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [intent, setIntent] = useState<Intent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");

  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [attach, setAttach] = useState<{ ok: boolean; msg: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [status, setStatus] = useState<"waiting" | "credited">("waiting");

  const [stars, setStars] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTg =
    typeof window !== "undefined" && !!(window as any).Telegram?.WebApp && !!(window as any).Telegram?.WebApp?.initData;

  const meta = CHAINS[chain];

  // Preview (approximate) crypto amount for the current selection. No record.
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const r = await fetch(`/api/deposits/address?chain=${chain}&amount=${amount}`);
      const j = await r.json();
      if (j.success) {
        setPreview({
          amountCrypto: j.data.amountCrypto,
          priceUsd: j.data.priceUsd,
          priceUnavailable: j.data.priceUnavailable,
          addressAvailable: true,
        });
      } else {
        setPreview({ amountCrypto: null, priceUsd: null, addressAvailable: false, error: j.error });
      }
    } catch {
      setPreview({ amountCrypto: null, priceUsd: null, addressAvailable: false, error: "Network error" });
    }
    setPreviewLoading(false);
  }, [chain, amount]);

  // Reload the preview whenever the selection changes and no address is locked.
  useEffect(() => {
    if (!intent) loadPreview();
  }, [chain, amount, intent, loadPreview]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  // Poll deposit history until this intent is credited.
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

  const generate = async () => {
    setGenErr("");
    setGenerating(true);
    setAttach(null);
    setTxHash("");
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, amountUsd: amount, currency: meta?.symbol || "USDT" }),
      });
      const j = await r.json();
      if (j.success) {
        setIntent(j.data);
        setStatus("waiting");
        startPolling(j.data.id);
      } else {
        setGenErr(j.error || "Could not generate a deposit address");
      }
    } catch {
      setGenErr("Network error");
    }
    setGenerating(false);
  };

  const reset = () => {
    stopPolling();
    setIntent(null);
    setStatus("waiting");
    setAttach(null);
    setTxHash("");
    setCopied(false);
  };

  const copy = async () => {
    if (!intent?.address) return;
    try { await navigator.clipboard.writeText(intent.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const copyAmount = async () => {
    if (!intent) return;
    try { await navigator.clipboard.writeText(fmtCrypto(intent.amount)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const registerHash = async () => {
    if (!intent || !txHash.trim()) return;
    setAttaching(true);
    setAttach(null);
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId: intent.id, txHash: txHash.trim() }),
      });
      const j = await r.json();
      setAttach(j.success ? { ok: true, msg: j.data?.message || "Transaction registered." } : { ok: false, msg: j.error || "Failed" });
    } catch { setAttach({ ok: false, msg: "Network error" }); }
    setAttaching(false);
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

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* ── Selection view (no locked address yet) ── */}
      {!intent && (
        <>
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

          {/* Network */}
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
                      background: active ? lime : raised,
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

          {/* Estimate + generate */}
          <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">You send ≈</div>
                <div className="text-lg font-extrabold" style={{ color: "var(--color-foreground)" }}>
                  {preview?.addressAvailable === false
                    ? "—"
                    : previewLoading || preview?.amountCrypto == null
                      ? "…"
                      : `${fmtCrypto(preview.amountCrypto)} ${meta?.symbol}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Credited</div>
                <div className="text-lg font-extrabold" style={{ color: lime }}>${amount}</div>
              </div>
            </div>

            {preview?.addressAvailable === false ? (
              <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: raised, color: "var(--color-muted-foreground)" }}>
                {meta?.name} deposits aren’t available yet.
              </div>
            ) : (
              <button
                onClick={generate}
                disabled={generating}
                className="btn-press mt-3 w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
                style={{ background: lime, color: "var(--color-bg)" }}
              >
                {generating ? "Generating…" : `Generate ${meta?.symbol} address`}
              </button>
            )}
            {genErr && <div className="mt-2 text-[11px]" style={{ color: "var(--color-loss)" }}>{genErr}</div>}
            <div className="mt-2 text-center text-[11px] text-muted-foreground">
              Rate updates live · no tx hash needed · auto-credited on confirmation
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
        </>
      )}

      {/* ── Locked deposit view ── */}
      {intent && (
        <div className="overflow-hidden rounded-2xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4">
            <button onClick={reset} className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">‹ Change</button>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: intent.color }}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: intent.color }} />
              {intent.name}
            </div>
          </div>

          {/* Status banner */}
          {status === "credited" ? (
            <div className="mx-4 mt-3 rounded-lg px-3 py-2 text-center text-sm font-bold" style={{ background: "color-mix(in oklab, var(--color-lime) 15%, transparent)", color: lime }}>
              ✓ Payment received — balance credited
            </div>
          ) : (
            <div className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs font-semibold" style={{ background: raised, color: "var(--color-muted-foreground)" }}>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: intent.color }} />
              Waiting for your transfer…
            </div>
          )}

          {/* QR */}
          <div className="flex flex-col items-center px-4 py-4">
            <div className="relative rounded-2xl bg-white p-3" style={{ boxShadow: `0 0 0 2px ${intent.color}55, 0 12px 30px rgba(0,0,0,.4)` }}>
              {intent.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={intent.qr} alt="Deposit QR" className="h-44 w-44 sm:h-52 sm:w-52" />
              ) : (
                <div className="h-44 w-44 sm:h-52 sm:w-52" />
              )}
              <div
                className="absolute -left-2 -top-2 flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-extrabold"
                style={{ background: intent.color, color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}
              >
                {intent.symbol?.slice(0, 3)}
              </div>
            </div>

            {/* Exact amount — the headline the player must send */}
            <button
              onClick={copyAmount}
              className="mt-4 w-full rounded-xl px-3 py-3 text-center transition-colors"
              style={{ background: raised, border: `1px solid ${intent.color}44` }}
            >
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Send exactly · tap to copy</div>
              <div className="mt-0.5 break-all font-mono text-xl font-extrabold" style={{ color: "var(--color-foreground)" }}>
                {fmtCrypto(intent.amount)} {intent.symbol}
              </div>
              <div className="text-xs font-semibold" style={{ color: lime }}>≈ ${intent.amountUsd}</div>
            </button>

            {/* Address */}
            <button onClick={copy} className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left" style={{ background: raised }}>
              <span className="truncate font-mono text-xs" style={{ color: "var(--color-foreground)" }}>{intent.address}</span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: copied ? lime : "var(--color-muted-foreground)" }}>{copied ? "Copied" : "Copy"}</span>
            </button>

            <div className="mt-3 w-full space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <div>
                Send the <b style={{ color: "var(--color-foreground)" }}>exact amount</b> above — the unique figure is how we match the payment to you automatically.
              </div>
              {intent.memo ? <div style={{ color: "var(--color-loss)" }}>⚠ Memo/Tag required: <b>{intent.memo}</b></div> : null}
              <div>{intent.minConfirmations} network confirmations required. Credited automatically — no action needed.</div>
            </div>
          </div>

          {/* Optional: speed it up with a tx hash */}
          <div className="border-t px-4 py-3" style={{ borderColor: "var(--color-border-strong)" }}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Optional — paste tx hash to speed it up</div>
            <div className="flex gap-2">
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x… / tx id"
                className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-xs outline-none"
                style={{ background: raised, color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}
              />
              <button
                onClick={registerHash}
                disabled={attaching || !txHash.trim()}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60"
                style={{ background: lime, color: "var(--color-bg)" }}
              >
                {attaching ? "…" : "Register"}
              </button>
            </div>
            {attach && <div className="mt-2 text-[11px]" style={{ color: attach.ok ? lime : "var(--color-loss)" }}>{attach.msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
