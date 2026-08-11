"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff, User, Mail, Lock, Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUIStore, useSessionStore } from "@/lib/store";
import { toast } from "sonner";

type Mode = "login" | "register";

export function AuthModal() {
  const reduced = useReducedMotion();
  const { authOpen, setAuthOpen } = useUIStore();
  const { setUser, setWallet } = useSessionStore();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("login");
  const [showPw, setShowPw] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");

  const applyAuthed = (data: {
    id: string;
    username: string;
    email: string;
    avatarColor: string;
    level: number;
    balance: number;
    currency: string;
    vipLevel: number;
  }) => {
    setUser({ id: data.id, username: data.username, email: data.email, avatarColor: data.avatarColor, level: data.level });
    setWallet({ balance: data.balance, currency: data.currency, vipLevel: data.vipLevel });
    qc.invalidateQueries();
    setAuthOpen(false);
  };

  const login = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (d) => {
      applyAuthed(d);
      toast.success(`Welcome back, ${d.username}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const register = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, referralCode: referral }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (d) => {
      applyAuthed(d);
      toast.success(`Account created — welcome, ${d.username}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = login.isPending || register.isPending;

  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="max-w-md overflow-hidden border-border/60 p-0" style={{ background: "var(--color-surface)" }}>
        {/* Accent header */}
        <div className="relative px-6 pt-6 pb-4">
          <div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
            style={{ background: "color-mix(in oklab, var(--color-lime) 22%, transparent)" }}
          />
          <DialogHeader className="relative">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {mode === "login" ? "Sign in" : "Create your account"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {mode === "login"
                ? "Welcome back — sign in to play and manage your wallet."
                : "Join in seconds. No deposit required to start."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tab switch */}
        <div className="relative mx-6 mb-4 flex rounded-lg border border-border/50 p-1" style={{ background: "var(--color-bg)" }}>
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative z-10 flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                mode === m ? "text-[color:var(--color-bg)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="auth-tab"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-md"
                  style={{ background: "var(--color-lime)" }}
                />
              )}
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            mode === "login" ? login.mutate() : register.mutate();
          }}
          className="space-y-3 px-6 pb-6"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={reduced ? false : { opacity: 0, x: mode === "login" ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: mode === "login" ? 12 : -12 }}
              transition={reduced ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              {mode === "login" ? (
                <Field icon={User} label="Email or username">
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    required
                  />
                </Field>
              ) : (
                <>
                  <Field icon={User} label="Username">
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="player123"
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field icon={Mail} label="Email">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </Field>
                </>
              )}

              <Field icon={Lock} label="Password">
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {mode === "register" && (
                <Field icon={Gift} label="Referral code (optional)">
                  <Input
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="Enter a code"
                    autoComplete="off"
                  />
                </Field>
              )}
            </motion.div>
          </AnimatePresence>

          <Button
            type="submit"
            disabled={busy}
            className="btn-press w-full font-semibold"
            style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>

          <p className="pt-1 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button type="button" onClick={() => setMode("register")} className="font-medium text-[color:var(--color-lime)] hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("login")} className="font-medium text-[color:var(--color-lime)] hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>

          {mode === "register" && (
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
              By registering you confirm you are of legal age to gamble in your jurisdiction.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}
