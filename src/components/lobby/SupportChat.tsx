"use client";

/*
 * Support live chat — player-facing, bridged to the Governance Tower.
 *
 * A player opens a ticket and sends messages; the casino pushes each message
 * to Governance (`casino.support_message` / `casino.support_ticket`). Agent
 * replies arrive back through the bridge webhook (`governance.support_reply`)
 * and are delivered here in real time over the SSE gateway (/api/events).
 *
 * This component is self-contained: it owns the ticket list, the conversation
 * view, the composer and the SSE subscription, so it can be dropped straight
 * into the Live Support section without threading state through the shell.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LifeBuoy, Send, Plus, ChevronLeft, CircleDot, Lock } from "lucide-react";
import type { SupportMessageWire, SupportTicketWire } from "@/lib/support";
import { useUserEvent } from "@/hooks/use-realtime";

export function SupportChat() {
  const [tickets, setTickets] = useState<SupportTicketWire[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageWire[]>([]);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    try {
      const r = await fetch("/api/support/tickets");
      if (r.status === 401) { setAuthed(false); return; }
      const j = await r.json();
      if (j.success) {
        setAuthed(true);
        setTickets(j.data as SupportTicketWire[]);
      }
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/support/tickets/${id}/messages`);
      const j = await r.json();
      if (j.success) {
        setMessages(j.data.messages as SupportMessageWire[]);
        // A new agent reply reopens an active ticket.
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: j.data.ticket.status, updatedAt: j.data.ticket.updatedAt } : t)),
        );
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Real-time: agent replies and ticket lifecycle updates arrive over the
  // SHARED private SSE stream (use-realtime), not a dedicated EventSource.
  // Every component owning its own /api/events connection burns one of the
  // browser's six per-origin sockets on duplicate data.
  useUserEvent<{ ticketId?: string; message?: SupportMessageWire }>(
    "support:message",
    (d) => {
      if (!d?.ticketId) return;
      if (d.message && d.ticketId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === d.message!.id)) return prev;
          return [...prev, d.message!];
        });
      }
      void loadTickets();
    },
    authed === true,
  );
  useUserEvent("support:ticket", () => { void loadTickets(); }, authed === true);

  const openTicket = useCallback((id: string) => setActiveId(id), []);

  const createTicket = useCallback(async () => {
    const m = text.trim();
    if (!m || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: m }),
      });
      const j = await r.json();
      if (j.success) {
        setSubject("");
        setText("");
        setActiveId(j.data.ticket.id);
        await loadTickets();
      }
    } catch { /* ignore */ }
    setBusy(false);
  }, [text, subject, busy, loadTickets]);

  const sendMessage = useCallback(async () => {
    const m = text.trim();
    if (!m || !activeId || busy) return;
    setBusy(true);
    setText("");
    try {
      await fetch(`/api/support/tickets/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m }),
      });
      await loadMessages(activeId);
    } catch { /* ignore */ }
    setBusy(false);
  }, [text, activeId, busy, loadMessages]);

  if (authed === false) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-surface/60 px-6 py-12 text-center">
        <Lock className="h-6 w-6 text-lime/60" />
        <p className="text-sm text-white/60">Sign in to open a support ticket and chat live with an agent.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Ticket list + new-ticket composer */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/8 bg-surface/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">New ticket</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            maxLength={160}
            className="mb-2 w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-lime/40"
          />
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createTicket(); }}
              placeholder="Describe your issue…"
              maxLength={2000}
              className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-lime/40"
            />
            <button
              onClick={createTicket}
              disabled={!text.trim() || busy}
              className="rounded-lg p-2 text-bg disabled:opacity-30"
              style={{ background: "var(--color-lime)" }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {tickets.length === 0 ? (
            <p className="rounded-2xl border border-white/6 px-4 py-8 text-center text-xs text-white/35">
              No tickets yet — start a conversation above.
            </p>
          ) : tickets.map((tk) => (
            <button
              key={tk.id}
              onClick={() => openTicket(tk.id)}
              className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                activeId === tk.id ? "border-lime/40 bg-lime/10" : "border-white/8 bg-surface/60 hover:border-white/16"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-white">{tk.subject || "Support request"}</p>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tk.status === "open" ? "bg-win/10 text-win" : "bg-white/10 text-white/40"}`}>
                  <CircleDot className="h-2.5 w-2.5" /> {tk.status}
                </span>
              </div>
              {tk.lastMessage && (
                <p className="mt-1 truncate text-[11px] text-white/40">
                  {tk.lastMessage.sender === "agent" ? `${tk.lastMessage.author}: ` : "You: "}
                  {tk.lastMessage.content}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex min-h-[320px] flex-col rounded-2xl border border-white/8 bg-surface/60">
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          {activeId && (
            <button onClick={() => setActiveId(null)} className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white lg:hidden">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <LifeBuoy className="h-4 w-4 text-lime" />
          <span className="text-sm font-bold text-white">
            {activeId ? "Conversation" : "Support"}
          </span>
          <span className="ml-auto rounded-full bg-lime/10 px-2 py-0.5 text-[10px] font-semibold text-lime">live</span>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {!activeId ? (
            <p className="py-10 text-center text-xs text-white/35">Select a ticket or start a new one to chat with support.</p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-xs text-white/35">Waiting for messages…</p>
          ) : messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  m.sender === "agent" ? "bg-white/8" : "bg-lime/15"
                }`}
              >
                <p className="text-[10px] font-semibold" style={{ color: m.sender === "agent" ? "var(--color-lime)" : "rgba(255,255,255,0.5)" }}>
                  {m.sender === "agent" ? m.author : "You"}
                </p>
                <p className="text-xs text-white/90 break-words">{m.content}</p>
                <p className="mt-0.5 text-[9px] text-white/30">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {activeId && (
          <div className="border-t border-white/8 p-3">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Reply to support…"
                maxLength={2000}
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-lime/40"
              />
              <button onClick={sendMessage} disabled={!text.trim() || busy} className="rounded-lg p-2 text-bg disabled:opacity-30" style={{ background: "var(--color-lime)" }}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
