"use client";

/*
 * Start-up authentication gate.
 *
 * Shown once when the platform loads and no session exists; it disappears the
 * moment an account is created or signed into, and never returns for that
 * session. Auth state comes from /api/auth/me, so a returning player with a
 * valid cookie goes straight to the lobby without seeing this at all.
 */

import { useCallback, useState } from "react";
import { Mail, Lock, User, Gift, Eye, EyeOff, Loader2, Calendar } from "lucide-react";

type Mode = "login" | "register";

// Pre-built option lists for the day/month/year selects — a fixed 18+ floor
// on the year range keeps the picker itself from offering an underage date.
const pad2 = (n: number) => String(n).padStart(2, "0");
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => pad2(i + 1));
const MONTH_OPTIONS = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => String(CURRENT_YEAR - 18 - i));

export function AuthGate({ initialMode = "login", onAuthenticated, onDismiss }: {
  initialMode?: Mode;
  onAuthenticated: () => void;
  onDismiss?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // Split day/month/year selects, not a native <input type="date">: the native
  // control needs precise segment-by-segment keyboard interaction (no slashes,
  // click-then-type-digits) that isn't obvious, and typing it wrong leaves the
  // field silently empty — the actual cause behind "date of birth is required"
  // errors players were hitting on sign-up.
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");


  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === "register" && (!dobDay || !dobMonth || !dobYear)) {
      setError("Please select your full date of birth.");
      return;
    }
    const dateOfBirth = mode === "register" ? `${dobYear}-${dobMonth}-${dobDay}` : "";
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { identifier, password }
            : { username, email, password, referralCode, dateOfBirth },
        ),
      });
      const raw = await res.text();
      let json: { success?: boolean; error?: string } = {};
      try { json = JSON.parse(raw); } catch {
        console.error("[auth] non-JSON response", res.status, raw.slice(0, 300));
      }
      if (res.ok && json.success) {
        onAuthenticated();
        return;
      }
      setError(res.status === 429 ? "Too many attempts — wait a minute." : (json.error ?? `Server error (${res.status})`));
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }, [mode, identifier, username, email, password, referralCode, dobDay, dobMonth, dobYear, busy, onAuthenticated]);

  // Navigate for real. A fetch({ redirect: "manual" }) probe used to hide this
  // button on any network blip or opaque 302, so the Google callback looked
  // like it had "disappeared". The start route itself redirects home with
  // ?google=not_configured when OAuth isn't set up.
  const handleGoogle = useCallback(() => {
    window.location.assign("/api/auth/google");
  }, []);

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-lime/40";
  const selectField = "w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 px-2 text-sm text-white outline-none transition-colors focus:border-lime/40";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-bg/95 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-wordmark text-4xl text-lime">TOLS</h1>
          <p className="mt-2 text-sm text-white/45">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Mode switch */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className="rounded-lg py-2.5 text-sm font-bold capitalize transition-colors"
              style={mode === m
                ? { background: "var(--color-lime)", color: "var(--color-bg)" }
                : { color: "rgba(255,255,255,0.55)" }}
            >
              {m === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "login" ? (
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                className={field}
                placeholder="Email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  className={field}
                  placeholder="Username (3–20 characters)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  className={field}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/40">
                  <Calendar className="h-3 w-3" /> Date of birth
                  <span className="ml-auto text-white/25">18+</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className={`${selectField}`}
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    aria-label="Day of birth"
                  >
                    <option value="" className="bg-surface">Day</option>
                    {DAY_OPTIONS.map((d) => <option key={d} value={d} className="bg-surface">{Number(d)}</option>)}
                  </select>
                  <select
                    className={`${selectField}`}
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    aria-label="Month of birth"
                  >
                    <option value="" className="bg-surface">Month</option>
                    {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value} className="bg-surface">{m.label}</option>)}
                  </select>
                  <select
                    className={`${selectField}`}
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    aria-label="Year of birth"
                  >
                    <option value="" className="bg-surface">Year</option>
                    {YEAR_OPTIONS.map((y) => <option key={y} value={y} className="bg-surface">{y}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              className={`${field} pr-11`}
              type={showPw ? "text" : "password"}
              placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {mode === "register" && (
            <div className="relative">
              <Gift className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                className={field}
                placeholder="Referral code (optional)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-loss/25 bg-loss/10 px-3 py-2 text-xs text-loss">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 text-sm font-black uppercase tracking-wide text-bg transition-transform disabled:opacity-40 enabled:hover:-translate-y-0.5"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {/* Google sign-in + forgot password */}
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-bold text-white/80 transition-colors hover:bg-white/[0.06]"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </button>
          {mode === "login" && (
            <a href="/forgot-password" className="block text-center text-xs text-white/40 transition-colors hover:text-white/60">Forgot password?</a>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-4 w-full text-center text-xs text-white/35 transition-colors hover:text-white/60"
          >
            Browse without an account
          </button>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/25">
          18+ only. Play responsibly — TOLS provides loss limits, wager limits and self-exclusion.
        </p>
      </div>
    </div>
  );
}
