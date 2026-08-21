"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Crown, Gift, Headphones, Loader2, Lock, Percent, RefreshCw } from "lucide-react";

interface Rank {
  level: number;
  name: string;
  family: string;
  color: string;
  xp: number;
  rakeback: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  host: boolean;
  benefits: string[];
}

interface Offer {
  kind: string;
  periodKey: string;
  amount: number;
  rate: number;
  wagered: number;
  eligible: boolean;
  claimed: boolean;
  available: boolean;
  unlocksAt?: string;
  label: string;
  detail: string;
}

interface VipPayload {
  xp: number;
  level: number;
  wagered: number;
  progress: number;
  tier: Rank;
  next: Rank | null;
  families: Array<{ id: string; ranks: Rank[] }>;
  offers: Offer[];
  xpRule: string;
  updatedAt: string;
}

const CARD: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--color-surface), var(--color-bg))",
  border: "1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)",
};

const fmtXp = (n: number) => Math.floor(n).toLocaleString("en-US");

export function VipClub({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<VipPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/vip")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data as VipPayload);
          setOpenFamily((j.data as VipPayload).tier.family === "player" ? "seed" : (j.data as VipPayload).tier.family);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async (offer: Offer) => {
    if (!offer.available || busy) return;
    setBusy(offer.kind + offer.periodKey);
    setMsg(null);
    try {
      const r = await fetch("/api/vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: offer.kind, periodKey: offer.periodKey }),
      });
      const j = await r.json();
      if (j.success) {
        setMsg(`Claimed $${Number(j.data.amount).toFixed(2)} as ${j.data.as === "real" ? "real balance" : "bonus money"}.`);
        load();
      } else {
        setMsg(j.error || "Could not claim.");
      }
    } catch {
      setMsg("Could not reach the server.");
    }
    setBusy(null);
  };

  const tier = data?.tier;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
            <Crown className="h-5 w-5 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">VIP Club</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Everything you need to know about the TOLS.fun VIP programme</p>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-10 text-sm text-white/40"><RefreshCw className="h-4 w-4 animate-spin" /> Loading VIP…</div>
      ) : (
        <>
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ ...CARD, borderColor: tier ? `${tier.color}55` : undefined }}>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Current rank</p>
            <p className="mt-1 font-display text-3xl font-black uppercase" style={{ color: tier?.color }}>{tier?.name ?? "Player"}</p>
            <p className="mt-1 text-sm text-white/50">
              {fmtXp(data?.xp ?? 0)} XP · {tier?.rakeback ?? 0}% rakeback
              {data?.next ? ` · next ${data.next.name} at ${fmtXp(data.next.xp)} XP` : " · max rank"}
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/6">
              <div className="h-full rounded-full" style={{ width: `${data?.progress ?? 0}%`, background: `linear-gradient(90deg, ${tier?.color}, ${data?.next?.color ?? "var(--color-lime)"})` }} />
            </div>
            <p className="mt-3 text-[11px] text-white/35">{data?.xpRule}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.offers ?? []).filter((o) => o.kind !== "reload" || o.available || o.claimed).map((offer) => (
              <div key={offer.kind + offer.periodKey} className="rounded-2xl p-4" style={CARD}>
                <div className="flex items-center gap-2">
                  {offer.kind === "rakeback" ? <Percent className="h-4 w-4 text-lime" /> :
                    offer.kind === "reload" ? <Gift className="h-4 w-4 text-vip" /> :
                      <Crown className="h-4 w-4 text-lime" />}
                  <p className="text-sm font-bold text-white">{offer.label}</p>
                </div>
                <p className="mt-2 font-mono text-2xl font-black text-lime">${offer.amount.toFixed(2)}</p>
                <p className="mt-1 text-[11px] text-white/40">{offer.rate}% of ${offer.wagered.toFixed(2)} wagered · {offer.detail}</p>
                <button
                  type="button"
                  disabled={!offer.available || Boolean(busy)}
                  onClick={() => void claim(offer)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-black uppercase disabled:opacity-35"
                  style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
                >
                  {busy === offer.kind + offer.periodKey && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {offer.claimed ? "Claimed" : !offer.eligible ? "Locked" : offer.available ? "Claim" : "Not ready"}
                </button>
              </div>
            ))}
          </div>
          {msg && <p className="text-sm text-white/70">{msg}</p>}

          <article className="rounded-2xl p-5 space-y-4 text-sm leading-relaxed text-white/65" style={CARD}>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Updated 22 January 2026</p>
            <h2 className="font-display text-lg text-white">What is the TOLS.fun VIP programme?</h2>
            <p>The TOLS.fun VIP programme is open to every player. There are more than 50 ranks to unlock as you play. Each rank unlocks new rewards and perks.</p>
            <h3 className="font-bold text-white">What are the rewards?</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-white">Daily bonus</strong> — Copper and above. Paid every day at 00:00 UTC from the last 24 hours of bets.</li>
              <li><strong className="text-white">Weekly bonus</strong> — Iron and above. Paid every Thursday at 11:00 UTC onto this page.</li>
              <li><strong className="text-white">Rakeback</strong> — every VIP member. A percentage of your casino wagers, claimable any time.</li>
              <li><strong className="text-white">Reload</strong> — as you climb ranks. A fixed bonus based on recent betting activity, claimed here.</li>
              <li><strong className="text-white">Monthly bonus</strong> — from your recent wagers, added to this page each month.</li>
              <li><strong className="text-white">VIP Host</strong> — unlocked at Pearl and above.</li>
            </ul>
          </article>

          <div className="rounded-2xl p-5" style={CARD}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">Ranks and XP</p>
            <div className="space-y-2">
              {(data?.families ?? []).map((fam) => {
                const open = openFamily === fam.id;
                const current = fam.ranks.some((r) => r.level === data?.level);
                return (
                  <div key={fam.id} className="overflow-hidden rounded-xl" style={{ border: current ? `1px solid ${fam.ranks[0]?.color}` : "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => setOpenFamily(open ? null : fam.id)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                      style={{ background: current ? `color-mix(in oklab, ${fam.ranks[0]?.color} 12%, transparent)` : "rgba(255,255,255,0.03)" }}
                    >
                      <span className="text-sm font-bold capitalize" style={{ color: fam.ranks[0]?.color }}>{fam.id}</span>
                      <span className="text-[11px] text-white/40">{fmtXp(fam.ranks[0]?.xp ?? 0)} – {fmtXp(fam.ranks[fam.ranks.length - 1]?.xp ?? 0)} XP</span>
                    </button>
                    {open && (
                      <div className="space-y-1 px-3 py-2">
                        {fam.ranks.map((r) => {
                          const unlocked = (data?.level ?? 0) >= r.level;
                          const isCurrent = r.level === data?.level;
                          return (
                            <div key={r.level} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5" style={{ background: isCurrent ? `color-mix(in oklab, ${r.color} 14%, transparent)` : "transparent" }}>
                              <div className="flex min-w-0 items-center gap-2">
                                {unlocked ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: r.color }} /> : <Lock className="h-3.5 w-3.5 shrink-0 text-white/25" />}
                                <span className="text-sm font-semibold" style={{ color: unlocked ? r.color : "rgba(255,255,255,0.45)" }}>{r.name}</span>
                                {r.host && <Headphones className="h-3 w-3 text-white/40" />}
                              </div>
                              <span className="shrink-0 font-mono text-[11px] text-white/40">{fmtXp(r.xp)} XP · {r.rakeback}% RB</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
