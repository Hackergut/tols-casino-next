"use client";

/*
 * Profile section pages — each item in the header profile menu routes here.
 * Data-backed pages (Wallet, VIP, Notifications, Transactions, Affiliate,
 * Play Responsibly) read from the existing Prisma/SQL API routes. The rest are
 * TOLS-styled section scaffolds ready to wire to their endpoints.
 */

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Wallet, Crown, Vault, Coins, Share2, Bell, Receipt, Ticket,
  Settings, ShieldCheck, LifeBuoy, Copy, Check, RefreshCw, Gift, Flame, Trophy,
} from "lucide-react";
import { VIP_TIERS, vipLevelForWager, vipProgress } from "@/lib/vip";
import { useLocale } from "@/lib/use-locale";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { useGameSettings } from "@/lib/game-settings";
import { setSoundEnabled } from "@/lib/game-audio";

const PROFILE_SECTIONS = new Set([
  "wallet", "vip", "cassaforte", "token", "affiliate", "notifications",
  "transactions", "riscatta-codice", "settings", "play-responsibly", "live-support",
  "rewards",
]);
export function isProfileSection(id: string): boolean {
  return PROFILE_SECTIONS.has(id);
}

const CARD =
  "rounded-2xl p-5 relative overflow-hidden";
const CARD_STYLE: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--color-surface), var(--color-bg))",
  border: "1px solid color-mix(in oklab, var(--color-lime) 8%, transparent)",
};

function useJson<T>(url: string | null): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (alive) setData(j.success ? (j.data as T) : null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [url, tick]);
  return { data, loading, reload: () => { setLoading(true); setTick((t) => t + 1); } };
}

function Shell({ title, subtitle, icon: Icon, onBack, children }: {
  title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>;
  onBack: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
            <Icon className="w-5 h-5 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Money({ n }: { n: number }) {
  return <span className="font-mono tabular-nums">${n.toFixed(2)}</span>;
}

/* ── Wallet ── */
function WalletSection({ onBack }: { onBack: () => void }) {
  const wallet = useJson<{ balance: number; currency: string; vipLevel: number; totalWagered: number; totalWon: number; depositAddresses: string }>("/api/wallet");
  const deposits = useJson<Array<{ id: string; amount?: number; status?: string; createdAt?: string }>>("/api/deposits");
  const w = wallet.data;
  let addresses: Record<string, string> = {};
  try { addresses = w?.depositAddresses ? JSON.parse(w.depositAddresses) : {}; } catch { /* ignore */ }

  return (
    <Shell title="Wallet" subtitle="Balance, deposit addresses and history" icon={Wallet} onBack={onBack}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={CARD} style={CARD_STYLE}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Balance</p>
          <p className="mt-1 text-2xl font-bold text-lime"><Money n={w?.balance ?? 0} /></p>
        </div>
        <div className={CARD} style={CARD_STYLE}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Total Wagered</p>
          <p className="mt-1 text-2xl font-bold text-white"><Money n={w?.totalWagered ?? 0} /></p>
        </div>
        <div className={CARD} style={CARD_STYLE}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Total Won</p>
          <p className="mt-1 text-2xl font-bold text-white"><Money n={w?.totalWon ?? 0} /></p>
        </div>
      </div>

      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Deposit Addresses</p>
        {Object.keys(addresses).length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            No deposit addresses configured. Set them via the admin panel (PUT /api/admin/deposit-addresses).
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(addresses).map(([chain, addr]) => (
              <div key={chain} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-xs font-bold uppercase text-lime">{chain}</span>
                <span className="text-xs font-mono truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{addr}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          Deposits/withdrawals are financial actions — perform them yourself in-app; this page is read-only.
        </p>
      </div>

      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Recent Deposits</p>
        {deposits.loading ? <Loading /> : !deposits.data || deposits.data.length === 0 ? (
          <Empty label="No deposits yet" />
        ) : (
          <div className="space-y-1.5">
            {deposits.data.slice(0, 8).map((d) => (
              <Row key={d.id} left={new Date(d.createdAt ?? Date.now()).toLocaleString()} mid={d.status ?? "—"} right={d.amount != null ? `$${d.amount.toFixed(2)}` : "—"} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ── VIP ── */
const fmtPts = (n: number) => Math.floor(n).toLocaleString("it-IT");

function VipSection({ onBack }: { onBack: () => void }) {
  const wallet = useJson<{ vipLevel: number; xp: number; totalWagered: number }>("/api/wallet");
  const w = wallet.data;
  const wagered = w?.totalWagered ?? 0;
  const points = Math.floor(wagered);
  // Level derives from wager (source of truth), matching server auto-promotion.
  const level = vipLevelForWager(wagered);
  const current = VIP_TIERS[level - 1];
  const next = VIP_TIERS[level] ?? null;
  const pct = vipProgress(wagered);

  return (
    <Shell title="Livello VIP" subtitle="Il tuo livello, i progressi e i vantaggi" icon={Crown} onBack={onBack}>
      {/* Current tier + progress */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Livello attuale</p>
            <p className="mt-1 text-3xl font-black" style={{ color: current.color }}>
              {current.level} · {current.name}
            </p>
          </div>
          <Crown className="h-10 w-10" style={{ color: current.color }} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span>{fmtPts(points)} punti</span>
            <span>{next ? `Prossimo: ${next.name} · ${fmtPts(next.points)} pt` : "Livello massimo"}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${current.color}, ${next?.color ?? "var(--color-lime)"})` }} />
          </div>
        </div>
      </div>

      {/* Tier ladder with per-level benefits */}
      <div className={CARD} style={CARD_STYLE}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
          Livelli e vantaggi
        </p>
        <div className="flex flex-col gap-2">
          {VIP_TIERS.map((t) => {
            const isCurrent = t.level === level;
            const unlocked = t.level <= level;
            return (
              <div
                key={t.name}
                className="rounded-xl p-3"
                style={{
                  background: isCurrent ? `color-mix(in oklab, ${t.color} 12%, transparent)` : "rgba(255,255,255,0.03)",
                  border: isCurrent ? `1px solid ${t.color}` : "1px solid rgba(255,255,255,0.06)",
                  opacity: unlocked ? 1 : 0.55,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ background: t.color, color: "#0f1015" }}>{t.level}</span>
                    <div className="min-w-0">
                      <p className="font-bold" style={{ color: t.color }}>{t.name}</p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{fmtPts(t.points)} punti richiesti</p>
                    </div>
                  </div>
                  {isCurrent
                    ? <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: t.color, color: "#0f1015" }}>ATTUALE</span>
                    : unlocked ? <Check className="h-4 w-4 shrink-0" style={{ color: t.color }} /> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.benefits.map((b) => (
                    <span key={b} className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.72)" }}>{b}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          I punti si guadagnano puntando (1 punto per ogni $1 giocato). Il livello si aggiorna automaticamente.
        </p>
      </div>
    </Shell>
  );
}

/* ── Notifications ── */
function NotificationsSection({ onBack }: { onBack: () => void }) {
  const { data, loading } = useJson<{ notifications: Array<{ id: string; type: string; title: string; message: string; createdAt: string; read: boolean }>; unreadCount: number }>("/api/notifications");
  return (
    <Shell title="Notifications" subtitle={`${data?.unreadCount ?? 0} unread`} icon={Bell} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        {loading ? <Loading /> : !data || data.notifications.length === 0 ? <Empty label="No notifications" /> : (
          <div className="space-y-2">
            {data.notifications.map((n) => (
              <div key={n.id} className="flex gap-3 rounded-lg p-3" style={{ background: n.read ? "rgba(255,255,255,0.02)" : "color-mix(in oklab, var(--color-lime) 6%, transparent)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "var(--color-lime)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{n.message}</p>
                  <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ── Transactions (bet history) ── */
function TransactionsSection({ onBack }: { onBack: () => void }) {
  const { data, loading } = useJson<{ total: number; bets: Array<{ id: string; gameName: string; amount: number; multiplier: number; payout: number; result: string; createdAt: string }> }>("/api/bets/history?limit=40");
  return (
    <Shell title="Transactions" subtitle={`${data?.total ?? 0} total bets`} icon={Receipt} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        {loading ? <Loading /> : !data || data.bets.length === 0 ? <Empty label="No transactions yet" /> : (
          <div className="space-y-1.5">
            {data.bets.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white">{b.gameName}</span>
                  <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{new Date(b.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{b.multiplier.toFixed(2)}x</span>
                  <span className={`text-sm font-bold font-mono tabular-nums ${b.result === "win" ? "text-win" : "text-loss"}`}>
                    {b.result === "win" ? "+" : "-"}${(b.result === "win" ? b.payout - b.amount : b.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ── Affiliate ── */
function AffiliateSection({ onBack }: { onBack: () => void }) {
  const { data, loading } = useJson<{ referralCode: string; commissionRate: number; totalClicks: number; totalReferrals: number; totalWagered: number; totalCommission: number; pendingCommission: number; paidCommission: number }>("/api/affiliate");
  const [copied, setCopied] = useState(false);
  const link = data ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${data.referralCode}` : "";
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <Shell title="Affiliate Program" subtitle="Refer players and earn commission" icon={Share2} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Your Referral Link</p>
        {loading ? <Loading /> : (
          <div className="flex items-center gap-2">
            <input readOnly value={link} className="flex-1 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Clicks" value={data?.totalClicks ?? 0} />
        <Stat label="Referrals" value={data?.totalReferrals ?? 0} />
        <Stat label="Commission" value={`$${(data?.totalCommission ?? 0).toFixed(2)}`} />
        <Stat label="Pending" value={`$${(data?.pendingCommission ?? 0).toFixed(2)}`} />
      </div>
    </Shell>
  );
}

/* ── Play Responsibly ── */
function PlayResponsiblySection({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="Play Responsibly" subtitle="Tools and limits to stay in control" icon={ShieldCheck} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          Gambling should be entertainment, not a way to make money. Only play with what you can afford to lose,
          set limits, and take breaks. If it stops being fun, step away.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["Set a deposit limit", "Set a wager limit", "Set a session time-out", "Self-exclude"].map((t) => (
            <div key={t} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{t}</span>
              <span className="text-[10px] uppercase tracking-wider text-lime">Configure</span>
            </div>
          ))}
        </div>
      </div>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Need help? Contact your local support organisation. Limits are enforced server-side via <code className="text-lime">/api/limits</code>.
        </p>
      </div>
    </Shell>
  );
}

/* ── Riscatta Codice (redeem code) ── */
function RiscattaCodiceSection({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redeem = useCallback(async () => {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 404) { setMsg("Redeem endpoint not yet available (POST /api/redeem)."); }
      else { const j = await res.json(); setMsg(j.success ? "Code redeemed!" : (j.error || "Invalid code")); }
    } catch { setMsg("Something went wrong."); }
    setBusy(false);
  }, [code]);
  return (
    <Shell title="Riscatta Codice" subtitle="Redeem a bonus or promo code" icon={Ticket} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Enter Code</p>
        <div className="flex items-center gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TOLS-XXXX"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm font-mono uppercase text-white outline-none tracking-widest"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <button onClick={redeem} disabled={busy || !code.trim()} className="rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-30" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
            {busy ? "…" : "Redeem"}
          </button>
        </div>
        {msg && <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{msg}</p>}
      </div>
    </Shell>
  );
}

/* ── Settings ── */
function PreferenceToggle({ label, description, active, onToggle }: {
  label: string;
  description?: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <span className="min-w-0">
        <span className="block" style={{ color: "rgba(255,255,255,0.72)" }}>{label}</span>
        {description && <span className="mt-0.5 block text-[10px]" style={{ color: "rgba(255,255,255,0.32)" }}>{description}</span>}
      </span>
      <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: active ? "var(--color-lime)" : "rgba(255,255,255,0.15)" }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: active ? "18px" : "2px" }} />
      </span>
    </button>
  );
}

function SettingsSection({ onBack }: { onBack: () => void }) {
  const me = useJson<{ balance: number; currency: string }>("/api/wallet");
  const [toggles, setToggles] = useState({ emailPromos: true, hideBalance: false });
  const soundEnabled = useGameSettings((s) => s.soundEnabled);
  const toggleSound = useGameSettings((s) => s.toggleSound);
  const quickPlay = useGameSettings((s) => s.quickPlay);
  const setQuickPlay = useGameSettings((s) => s.setQuickPlay);
  const showProfit = useGameSettings((s) => s.showProfit);
  const setShowProfit = useGameSettings((s) => s.setShowProfit);
  const { locale, setLocale } = useLocale();
  return (
    <Shell title="Settings" subtitle="Account and preferences" icon={Settings} onBack={onBack}>
      {/* Language — auto-detected from region, overridable here */}
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Lingua / Language</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
              style={locale === l
                ? { background: "color-mix(in oklab, var(--color-lime) 15%, transparent)", color: "var(--color-lime)", border: "1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)" }
                : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          Rilevata automaticamente dalla tua zona. Puoi cambiarla qui.
        </p>
      </div>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Account</p>
        <div className="space-y-2 text-sm">
          <Row left="Username" mid="" right="TOLSPlayer" />
          <Row left="Display currency" mid="" right={me.data?.currency ?? "USDT"} />
        </div>
      </div>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Preferences</p>
        <div className="space-y-2">
          <PreferenceToggle
            label="Game sounds"
            description="Sound effects for all TOLS Originals"
            active={soundEnabled}
            onToggle={() => {
              const next = !soundEnabled;
              toggleSound();
              setSoundEnabled(next);
            }}
          />
          <PreferenceToggle
            label="Quick play"
            description="Reduce or skip result animations"
            active={quickPlay}
            onToggle={() => setQuickPlay(!quickPlay)}
          />
          <PreferenceToggle
            label="Session profit"
            description="Show running profit and loss in game headers"
            active={showProfit}
            onToggle={() => setShowProfit(!showProfit)}
          />
          <PreferenceToggle
            label="Email promotions"
            active={toggles.emailPromos}
            onToggle={() => setToggles((t) => ({ ...t, emailPromos: !t.emailPromos }))}
          />
          <PreferenceToggle
            label="Hide balance"
            active={toggles.hideBalance}
            onToggle={() => setToggles((t) => ({ ...t, hideBalance: !t.hideBalance }))}
          />
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Game preferences persist on this device and apply to every Original.</p>
      </div>
    </Shell>
  );
}

/* ── Live Support ── */
function LiveSupportSection({ onBack }: { onBack: () => void }) {
  const faqs = [
    ["How long do withdrawals take?", "Crypto withdrawals are processed after confirmation, usually within minutes."],
    ["Is the game provably fair?", "Yes — every result is derived from a server seed hash, client seed and nonce."],
    ["How do I redeem a code?", "Use Riscatta Codice in the profile menu."],
  ];
  return (
    <Shell title="Live Support" subtitle="We're here to help" icon={LifeBuoy} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Start a live chat with support, or reach us on Telegram.</p>
        <div className="mt-3 flex gap-2">
          <button className="rounded-lg px-4 py-2.5 text-sm font-bold" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>Start Live Chat</button>
          <button className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>Telegram</button>
        </div>
      </div>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>FAQ</p>
        <div className="space-y-3">
          {faqs.map(([q, a]) => (
            <div key={q}>
              <p className="text-sm font-medium text-white">{q}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ── Rewards (daily streak + achievements + jackpot) ── */
function RewardsSection({ onBack }: { onBack: () => void }) {
  const streak = useJson<{ currentStreak?: number; canClaim?: boolean; nextReward?: number }>("/api/daily-streak");
  const achievements = useJson<{ achievements?: Array<{ id: string; name: string; description?: string; unlocked?: boolean }> }>("/api/achievements");
  const jackpot = useJson<{ amount?: number }>("/api/jackpot");
  return (
    <Shell title="Rewards" subtitle="Daily streak, achievements and the mega drop" icon={Gift} onBack={onBack}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={CARD} style={CARD_STYLE}>
          <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-pending" /><p className="text-xs font-semibold uppercase tracking-wider text-white/50">Daily Streak</p></div>
          <p className="mt-2 text-3xl font-black text-lime">{streak.data?.currentStreak ?? 0} <span className="text-base font-semibold text-white/40">days</span></p>
          <button disabled={!streak.data?.canClaim} className="mt-3 w-full rounded-lg py-2.5 text-sm font-bold text-bg disabled:opacity-30" style={{ background: "var(--color-lime)" }}>
            {streak.data?.canClaim ? "Claim today's reward" : "Come back tomorrow"}
          </button>
        </div>
        <div className={CARD} style={CARD_STYLE}>
          <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-vip" /><p className="text-xs font-semibold uppercase tracking-wider text-white/50">Mega Drop</p></div>
          <p className="mt-2 text-3xl font-black text-vip font-mono">${(jackpot.data?.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="mt-3 text-xs text-white/40">Every bet feeds the progressive jackpot.</p>
        </div>
      </div>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white/50">Achievements</p>
        {achievements.loading ? <Loading /> : !achievements.data?.achievements?.length ? <Empty label="No achievements yet" /> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {achievements.data.achievements.slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", opacity: a.unlocked ? 1 : 0.5 }}>
                <Trophy className="w-4 h-4 shrink-0" style={{ color: a.unlocked ? "var(--color-lime)" : "rgba(255,255,255,0.3)" }} />
                <div className="min-w-0"><p className="text-sm font-medium text-white truncate">{a.name}</p>{a.description && <p className="text-[10px] text-white/40 truncate">{a.description}</p>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ── Scaffold sections (no dedicated endpoint yet) ── */
function TokenSection({ onBack }: { onBack: () => void }) {
  const wallet = useJson<{ xp: number }>("/api/wallet");
  return (
    <Shell title="Token" subtitle="Loyalty tokens earned from play" icon={Coins} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Token Balance</p>
        <p className="mt-1 text-3xl font-black text-lime">{wallet.data?.xp ?? 0} <span className="text-base font-semibold text-white/50">TOLS</span></p>
        <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Tokens accrue from wagering (currently mapped to XP). A dedicated token ledger endpoint can back this page.</p>
      </div>
    </Shell>
  );
}
function CassaforteSection({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="Cassaforte" subtitle="Vault — keep funds safe from play" icon={Vault} onBack={onBack}>
      <div className={CARD} style={CARD_STYLE}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Move funds into your vault to keep them out of gameplay. Vaulted funds don't appear in your play balance.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>Play Balance</p>
            <p className="text-lg font-bold text-lime">—</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>Vault</p>
            <p className="text-lg font-bold text-white">—</p>
          </div>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Needs a vault API (deposit/withdraw to vault) + a wallet.vaultBalance column to go live.</p>
      </div>
    </Shell>
  );
}

/* ── Small building blocks ── */
function Loading() { return <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>; }
function Empty({ label }: { label: string }) { return <p className="py-6 text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>; }
function Row({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{left}</span>
      {mid && <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{mid}</span>}
      <span className="text-sm font-semibold text-white">{right}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD} style={CARD_STYLE}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export function ProfileSectionView({ section, onBack }: { section: string; onBack: () => void }) {
  switch (section) {
    case "wallet": return <WalletSection onBack={onBack} />;
    case "vip": return <VipSection onBack={onBack} />;
    case "cassaforte": return <CassaforteSection onBack={onBack} />;
    case "token": return <TokenSection onBack={onBack} />;
    case "affiliate": return <AffiliateSection onBack={onBack} />;
    case "notifications": return <NotificationsSection onBack={onBack} />;
    case "transactions": return <TransactionsSection onBack={onBack} />;
    case "riscatta-codice": return <RiscattaCodiceSection onBack={onBack} />;
    case "settings": return <SettingsSection onBack={onBack} />;
    case "play-responsibly": return <PlayResponsiblySection onBack={onBack} />;
    case "live-support": return <LiveSupportSection onBack={onBack} />;
    case "rewards": return <RewardsSection onBack={onBack} />;
    default: return null;
  }
}
