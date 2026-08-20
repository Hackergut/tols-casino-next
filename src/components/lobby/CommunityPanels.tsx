"use client";

/*
 * Shuffle-style overlay framework, TOLS-styled:
 *  - ChatPanel          → community chat, right-side drawer (real /api/casino-chat)
 *  - NotificationsPanel → notifications, right-side drawer (real /api/notifications)
 *  - VaultSheet         → Cassaforte, bottom sheet that slides up from the bottom
 *
 * Panels are conditionally mounted (rendered only while open) with a keyframe
 * slide, which avoids Tailwind v4 transform/translate utility conflicts.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Send, Users, Bell, Vault, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

const KEYFRAMES = `
@keyframes tolsFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes tolsSlideRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes tolsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
`;

function Overlay({ onClose, children, variant }: { onClose: () => void; children: React.ReactNode; variant: "right" | "bottom" }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div onClick={onClose} className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" style={{ animation: "tolsFade 0.2s ease-out" }} />
      {variant === "right" ? (
        <aside
          className="fixed right-0 top-0 bottom-0 z-[60] flex w-full flex-col border-l border-lime/10 bg-surface shadow-2xl sm:w-80"
          style={{ animation: "tolsSlideRight 0.28s cubic-bezier(0.16,1,0.3,1)" }}
        >
          {children}
        </aside>
      ) : (
        <div
          className="fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl border-t border-lime/15 bg-surface shadow-2xl"
          style={{ animation: "tolsSlideUp 0.28s cubic-bezier(0.16,1,0.3,1)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {children}
        </div>
      )}
    </>
  );
}

/* ── Community Chat ── */
interface ChatMsg { id: string; username: string; avatarColor?: string; message: string; createdAt: string }

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/casino-chat?limit=50");
      const j = await r.json();
      if (j.success) setMsgs(j.data as ChatMsg[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = window.setTimeout(() => void load(), 0);
    const t = setInterval(load, 5000);
    return () => { window.clearTimeout(first); clearInterval(t); };
  }, [open, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const send = useCallback(async () => {
    const m = text.trim();
    if (!m) return;
    setText("");
    try {
      await fetch("/api/casino-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m }) });
      load();
    } catch { /* ignore */ }
  }, [text, load]);

  if (!open) return null;
  return (
    <Overlay onClose={onClose} variant="right">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-lime" />
          <span className="text-sm font-bold text-white">Community</span>
          <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] font-semibold text-lime">live</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.length === 0 ? (
          <p className="py-10 text-center text-xs text-white/35">No messages yet — say hi 👋</p>
        ) : msgs.map((m) => (
          <div key={m.id} className="flex gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-bg" style={{ background: m.avatarColor || "var(--color-lime)" }}>
              {m.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: m.avatarColor || "var(--color-lime)" }}>{m.username}</p>
              <p className="text-xs text-white/80 break-words">{m.message}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 p-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Message the community…"
            maxLength={500}
            className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-lime/40"
          />
          <button onClick={send} disabled={!text.trim()} className="rounded-lg p-2 text-bg disabled:opacity-30" style={{ background: "var(--color-lime)" }}><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Notifications ── */
interface Notif { id: string; type: string; title: string; message: string; createdAt: string; read: boolean }

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ notifications: Notif[]; unreadCount: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    fetch("/api/notifications").then((r) => r.json()).then((j) => { if (j.success) setData(j.data); }).catch(() => {});
  }, [open]);

  if (!open) return null;
  return (
    <Overlay onClose={onClose} variant="right">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-lime" />
          <span className="text-sm font-bold text-white">Notifications</span>
          {data && data.unreadCount > 0 && <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] font-semibold text-lime">{data.unreadCount}</span>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!data ? (
          <p className="py-10 text-center text-xs text-white/35">Loading…</p>
        ) : data.notifications.length === 0 ? (
          <p className="py-10 text-center text-xs text-white/35">You're all caught up</p>
        ) : data.notifications.map((n) => (
          <div key={n.id} className="flex gap-3 rounded-lg p-3" style={{ background: n.read ? "rgba(255,255,255,0.02)" : "color-mix(in oklab, var(--color-lime) 6%, transparent)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "var(--color-lime)" }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{n.title}</p>
              <p className="mt-0.5 text-xs text-white/50">{n.message}</p>
              <p className="mt-1 text-[10px] text-white/30">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

/* ── Cassaforte (Vault) — bottom sheet ── */
export function VaultSheet({ open, onClose, balance }: { open: boolean; onClose: () => void; balance: number }) {
  const { t } = useLocale();
  const [vault, setVault] = useState(0);
  const [amount, setAmount] = useState("");
  const amt = Math.max(0, Number(amount) || 0);
  const toVault = () => { if (amt > 0 && amt <= balance) { setVault((v) => v + amt); setAmount(""); } };
  const fromVault = () => { if (amt > 0 && amt <= vault) { setVault((v) => v - amt); setAmount(""); } };

  if (!open) return null;
  return (
    <Overlay onClose={onClose} variant="bottom">
      <div className="mx-auto max-w-lg px-5 pb-6 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Vault className="h-5 w-5 text-lime" /><h2 className="text-lg font-bold text-white">{t("profile.vault")}</h2></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Play Balance</p>
            <p className="text-lg font-bold text-lime font-mono">${balance.toFixed(2)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] uppercase tracking-wider text-white/35">In Vault</p>
            <p className="text-lg font-bold text-white font-mono">${vault.toFixed(2)}</p>
          </div>
        </div>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount"
          className="mb-3 w-full rounded-xl bg-white/5 px-4 py-3 text-center text-lg font-bold text-white outline-none focus:ring-1 focus:ring-lime/40" />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={toVault} disabled={amt <= 0 || amt > balance} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-bg disabled:opacity-30" style={{ background: "var(--color-lime)" }}>
            <ArrowDownToLine className="h-4 w-4" /> Deposit
          </button>
          <button onClick={fromVault} disabled={amt <= 0 || amt > vault} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-30" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ArrowUpFromLine className="h-4 w-4" /> Withdraw
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/30">Vault balance is local for now — wire to a vault API + wallet column to persist.</p>
      </div>
    </Overlay>
  );
}
