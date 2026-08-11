"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json();
      setMsg(j.success ? "Password reset. You can sign in now." : j.error || "Failed");
      if (j.success) setPw("");
    } catch { setMsg("Network error"); }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 p-6" style={{ background: "var(--color-surface)" }}>
        <h1 className="text-xl font-bold">Reset password</h1>
        {!token ? <p className="text-sm text-muted-foreground">Invalid or missing token.</p> : (
          <>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 8)" minLength={8} className="w-full rounded-lg px-3 py-2 outline-none" style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }} />
            <button type="submit" disabled={busy || pw.length < 8} className="w-full rounded-lg py-2 font-bold disabled:opacity-50" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>{busy ? "..." : "Reset password"}</button>
          </>
        )}
        {msg && <p className="text-sm" style={{ color: msg.includes("reset") ? "var(--color-lime)" : "var(--color-loss)" }}>{msg}</p>}
      </form>
    </main>
  );
}
