'use client';

import { useCallback, useState } from "react";
import { useBalance } from "@/hooks/use-balance";

type WithdrawalStatus = "idle" | "submitting" | "success" | "error";

interface Chain {
  id: string;
  name: string;
  symbol: string;
  color: string;
  minWithdrawal: number;
}

const SUPPORTED_CHAINS: Chain[] = [
  { id: "tron", name: "Tron (TRC-20)", symbol: "USDT", color: "#ff0013", minWithdrawal: 10 },
  { id: "bsc", name: "BNB Smart Chain", symbol: "USDT", color: "#f3ba2f", minWithdrawal: 10 },
  { id: "sol", name: "Solana", symbol: "USDT", color: "#9945ff", minWithdrawal: 10 },
  { id: "eth", name: "Ethereum", symbol: "USDT", color: "#627eea", minWithdrawal: 25 },
];

export default function WithdrawalPanel() {
  const { balance, currency, refresh } = useBalance();
  const [chain, setChain] = useState<string>(SUPPORTED_CHAINS[0].id);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<WithdrawalStatus>("idle");
  const [message, setMessage] = useState("");

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === chain) ?? SUPPORTED_CHAINS[0];
  const numAmount = parseFloat(amount) || 0;

  const canSubmit =
    status !== "submitting" &&
    numAmount >= selectedChain.minWithdrawal &&
    numAmount <= balance &&
    address.trim().length > 10;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          amount: numAmount,
          currency: selectedChain.symbol,
          walletAddress: address.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Withdrawal request failed");
      }

      setStatus("success");
      setMessage("Withdrawal submitted! It will be reviewed and processed shortly.");
      setAmount("");
      setAddress("");
      refresh(); // Update balance
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Something went wrong");
    }
  }, [canSubmit, chain, numAmount, address, selectedChain.symbol, refresh]);

  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-white/5 p-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Withdraw</h2>
      <p className="text-sm text-gray-400 mb-5">
        Available: <span className="text-white font-medium">${balance.toFixed(2)} {currency}</span>
      </p>

      {/* Chain selector */}
      <label className="block text-sm text-gray-400 mb-1.5">Network</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {SUPPORTED_CHAINS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChain(c.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
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
      <label className="block text-sm text-gray-400 mb-1.5">
        Amount <span className="text-gray-500">(min ${selectedChain.minWithdrawal})</span>
      </label>
      <div className="relative mb-4">
        <input
          type="number"
          inputMode="decimal"
          placeholder={`Min $${selectedChain.minWithdrawal}`}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setStatus("idle"); setMessage(""); }}
          className="w-full bg-[#0f1118] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#ccff00]/50 transition-colors"
        />
        <button
          onClick={() => setAmount(String(balance))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#ccff00] hover:underline"
        >
          MAX
        </button>
      </div>

      {/* Wallet address */}
      <label className="block text-sm text-gray-400 mb-1.5">Wallet Address</label>
      <input
        type="text"
        placeholder="Enter your wallet address"
        value={address}
        onChange={(e) => { setAddress(e.target.value); setStatus("idle"); setMessage(""); }}
        className="w-full bg-[#0f1118] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#ccff00]/50 transition-colors mb-4"
      />

      {numAmount > balance && (
        <p className="text-red-400 text-xs mb-3">Insufficient balance.</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
          canSubmit
            ? "bg-[#ccff00] text-black hover:bg-[#b8e600] cursor-pointer"
            : "bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
      >
        {status === "submitting" ? "Submitting..." : "Request Withdrawal"}
      </button>

      {/* Status message */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            status === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Withdrawals are reviewed manually and usually processed within 1-24 hours.
        Funds are deducted from your balance immediately upon request.
      </p>
    </div>
  );
}
