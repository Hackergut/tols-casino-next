'use client';

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChainOption {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

interface DepositIntent {
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
  uri: string;
  qr: string | null;
  status: string;
  message: string;
}

interface DepositStatus {
  id: string;
  status: string;
  credited: boolean;
  amount: number;
  amountUsd: number;
}

type PanelStep = "form" | "awaiting" | "credited";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHAINS: ChainOption[] = [
  { id: "tron", name: "Tron (TRC-20)", symbol: "USDT", color: "#ff0013" },
  { id: "bsc", name: "BNB Smart Chain", symbol: "USDT", color: "#f3ba2f" },
  { id: "sol", name: "Solana", symbol: "USDT", color: "#9945ff" },
  { id: "eth", name: "Ethereum", symbol: "USDT", color: "#627eea" },
];

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];
const POLL_INTERVAL = 8000; // 8 seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DepositPanel() {
  const [step, setStep] = useState<PanelStep>("form");
  const [chain, setChain] = useState<string>(CHAINS[0].id);
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [txHash, setTxHash] = useState("");
  const [hashSubmitting, setHashSubmitting] = useState(false);
  const [hashMessage, setHashMessage] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Create deposit intent
  const handleDeposit = useCallback(async () => {
    const usd = parseFloat(amount);
    if (!usd || usd <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, amountUsd: usd }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create deposit");
      }
      setIntent(json.data);
      setStep("awaiting");
      startPolling(json.data.id);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [chain, amount]);

  // Poll deposit status
  const startPolling = useCallback((depositId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deposits/status/${depositId}`);
        if (!res.ok) return;
        const json = await res.json();
        const data: DepositStatus = json.data ?? json;
        if (data.credited) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("credited");
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLL_INTERVAL);
  }, []);

  // Attach tx hash
  const handleAttachHash = useCallback(async () => {
    if (!intent || !txHash.trim()) return;
    setHashSubmitting(true);
    setHashMessage(null);
    try {
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId: intent.id, txHash: txHash.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      setHashMessage(json.data?.message || "Transaction registered!");
      setTxHash("");
    } catch (e: any) {
      setHashMessage(e.message);
    } finally {
      setHashSubmitting(false);
    }
  }, [intent, txHash]);

  // Reset
  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep("form");
    setIntent(null);
    setError(null);
    setTxHash("");
    setHashMessage(null);
  };

  // CREDITED
  if (step === "credited") {
    return (
      <div className="bg-[#1a1d2e] rounded-xl border border-green-500/20 p-6 w-full max-w-md mx-auto text-center">
        <div className="text-4xl mb-3">\u2705</div>
        <h3 className="text-xl font-bold text-green-400 mb-2">Deposit Credited!</h3>
        <p className="text-gray-300 text-sm mb-1">
          ${intent?.amountUsd} has been added to your balance.
        </p>
        <p className="text-gray-500 text-xs mb-5">
          {intent?.amount} {intent?.symbol} on {intent?.name}
        </p>
        <button
          onClick={handleReset}
          className="px-6 py-2.5 bg-[#ccff00] text-black font-semibold rounded-lg hover:bg-[#b8e600] transition-colors text-sm"
        >
          Make Another Deposit
        </button>
      </div>
    );
  }

  // AWAITING PAYMENT
  if (step === "awaiting" && intent) {
    return (
      <div className="bg-[#1a1d2e] rounded-xl border border-white/5 p-6 w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Send Payment</h3>
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-white transition-colors">
            \u2190 Back
          </button>
        </div>

        {/* Chain badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: intent.color }} />
          <span className="text-sm text-gray-300">{intent.name}</span>
        </div>

        {/* QR Code */}
        {intent.qr && (
          <div className="flex justify-center mb-4">
            <img src={intent.qr} alt="QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
          </div>
        )}

        {/* Amount */}
        <div className="bg-[#0f1118] rounded-lg p-4 mb-3 border border-white/5">
          <p className="text-xs text-gray-400 mb-1">Send exactly:</p>
          <p className="text-xl font-bold text-[#ccff00]">
            {intent.amount} {intent.symbol}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">\u2248 ${intent.amountUsd} USD</p>
        </div>

        {/* Address */}
        <div className="bg-[#0f1118] rounded-lg p-4 mb-3 border border-white/5">
          <p className="text-xs text-gray-400 mb-1">To address:</p>
          <p className="text-sm font-mono text-white break-all select-all">{intent.address}</p>
          {intent.memo && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-gray-400">Memo/Tag:</p>
              <p className="text-sm font-mono text-yellow-300">{intent.memo}</p>
            </div>
          )}
        </div>

        {/* Copy address button */}
        <button
          onClick={() => navigator.clipboard?.writeText(intent.address)}
          className="w-full py-2 mb-4 text-xs text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          \ud83d\udccb Copy Address
        </button>

        {/* Status indicator */}
        <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg mb-4">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs text-yellow-300">Waiting for payment... auto-checking every 8s</span>
        </div>

        {/* Optional: attach tx hash */}
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
            Already sent? Paste your transaction hash to speed things up
          </summary>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="0x... or transaction hash"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="flex-1 bg-[#0f1118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ccff00]/50"
            />
            <button
              onClick={handleAttachHash}
              disabled={hashSubmitting || !txHash.trim()}
              className="px-4 py-2 bg-[#ccff00]/20 text-[#ccff00] rounded-lg text-xs font-medium hover:bg-[#ccff00]/30 disabled:opacity-50 transition-colors"
            >
              {hashSubmitting ? "..." : "Submit"}
            </button>
          </div>
          {hashMessage && (
            <p className="text-xs mt-2 text-gray-400">{hashMessage}</p>
          )}
        </details>
      </div>
    );
  }

  // DEPOSIT FORM
  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-white/5 p-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Deposit</h2>
      <p className="text-sm text-gray-400 mb-5">
        Send crypto to your account. Credited automatically after on-chain confirmation.
      </p>

      {/* Chain selector */}
      <label className="block text-sm text-gray-400 mb-1.5">Select Network</label>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChain(c.id)}
            className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
              chain === c.id
                ? "border-[#ccff00]/50 bg-[#ccff00]/10 text-[#ccff00]"
                : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <label className="block text-sm text-gray-400 mb-1.5">Amount (USD)</label>
      <input
        type="number"
        inputMode="decimal"
        placeholder="Enter amount in USD"
        value={amount}
        onChange={(e) => { setAmount(e.target.value); setError(null); }}
        className="w-full bg-[#0f1118] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#ccff00]/50 transition-colors mb-3"
      />

      {/* Preset amounts */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(String(preset))}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              amount === String(preset)
                ? "bg-[#ccff00]/20 text-[#ccff00] border border-[#ccff00]/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleDeposit}
        disabled={loading || !amount}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
          loading || !amount
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-[#ccff00] text-black hover:bg-[#b8e600] cursor-pointer"
        }`}
      >
        {loading ? "Creating deposit..." : "Generate Payment Address"}
      </button>
    </div>
  );
}
