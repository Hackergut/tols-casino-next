"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      setMsg(j.success ? "If that account exists, a reset link has been emailed." : j.error || "Failed");
    } catch { setMsg("Network error"); }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 p-6" style={{ background: "var(--color-surface)" }}>
        <a href="/" className="text-xs text-muted-foreground">← Back</a>
        <h1 className="text-xl font-bold">Forgot password</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" required className="w-full rounded-lg px-3 py-2 outline-none" style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }} />
        <button type="submit" disabled={busy || !email} className="w-full rounded-lg py-2 font-bold disabled:opacity-50" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>{busy ? "..." : "Send reset link"}</button>
        {msg && <p className="text-sm" style={{ color: msg.includes("exists") ? "var(--color-lime)" : "var(--color-loss)" }}>{msg}</p>}
      </form>
    </main>
  );
}
