"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSessionStore } from "@/lib/store";
import { timeAgo } from "@/lib/types";

interface ChatMsg {
  id: string;
  username: string;
  avatarColor: string;
  message: string;
  channel: string;
  createdAt: string;
}

const CHANNELS = [
  { id: "general", label: "General" },
  { id: "winners", label: "Wins" },
  { id: "trades", label: "Trades" },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("general");
  const [msg, setMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { user } = useSessionStore();

  const { data: messages } = useQuery<ChatMsg[]>({
    queryKey: ["chat", channel],
    queryFn: async () => {
      const r = await fetch(`/api/chat?channel=${channel}&limit=50`);
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 3000,
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, channel }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", channel] });
      setMsg("");
    },
  });

  useEffect(() => {
    if (scrollRef.current && messages) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 lg:bottom-6 lg:right-6"
        style={{ background: "var(--color-lime)", color: "var(--color-bg)", boxShadow: "0 0 24px color-mix(in oklab, var(--color-lime) 40%, transparent)" }}
        aria-label="Open chat"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl lg:bottom-24 lg:right-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
              <span className=" text-sm font-semibold uppercase tracking-wide">Community Chat</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              1,247 online
            </span>
          </div>

          {/* Channel tabs */}
          <div className="flex gap-0.5 border-b border-border/60 px-2 py-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  channel === c.id ? "bg-lime/10 text-lime" : "text-muted-foreground hover:text-foreground"
                }`}
                style={channel === c.id ? { background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages?.map((m) => (
              <div key={m.id} className="flex gap-2 text-xs">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: m.avatarColor, color: "var(--color-bg)" }}>
                  {m.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold" style={{ color: m.avatarColor }}>
                      {m.username}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="break-words text-foreground/90">{m.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (msg.trim()) sendMutation.mutate(msg.trim());
            }}
            className="flex items-center gap-1.5 border-t border-border/60 p-2"
          >
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={`Message #${channel}…`}
              maxLength={500}
              className="h-9 border-border/60 bg-background/60 text-sm"
            />
            <button
              type="submit"
              disabled={!msg.trim() || sendMutation.isPending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
              style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
