"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";

/*
 * Shown instead of opening a game when a guest taps Play. Redirecting them
 * straight into a game that then silently fails the bet (no wallet, no
 * session) was the actual bug — this intercepts the click and offers the real
 * next step. The bonus amount comes from /api/promo/welcome so it can never
 * promise more than registration actually grants.
 */
export function SignupPromptModal({ onRegister, onLogin, onClose }: {
  onRegister: () => void;
  onLogin: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/promo/welcome").then((r) => r.json())
      .then((j) => { if (j.success) setAmount(j.data.amount); })
      .catch(() => {});
  }, []);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-bg/90 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-lime/20 bg-surface p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime/12">
          <Gift className="h-7 w-7 text-lime" />
        </div>

        <h2 className="font-display text-lg uppercase text-white">Sign up to play</h2>
        <p className="mt-2 text-sm text-white/60">
          {amount && amount > 0 ? (
            <>Create a free account and claim your <span className="font-bold text-lime">${amount.toFixed(2)}</span> welcome bonus — no deposit required.</>
          ) : (
            <>Create a free account to start playing TOLS Originals.</>
          )}
        </p>

        <button
          onClick={onRegister}
          className="mt-5 w-full rounded-xl bg-lime py-3 text-sm font-black uppercase tracking-wide text-bg transition-transform hover:-translate-y-0.5"
        >
          Register &amp; claim bonus
        </button>
        <button
          onClick={onLogin}
          className="mt-2 w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5"
        >
          I already have an account
        </button>

        <p className="mt-4 text-[10px] leading-relaxed text-white/25">
          18+ only. Play responsibly.
        </p>
      </div>
    </div>
  );
}
