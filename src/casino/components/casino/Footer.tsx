"use client";

import { Shield, Lock, Headphones, Twitter, Send, MessageCircle, Github } from "lucide-react";

const FOOTER_SECTIONS = [
  {
    title: "Casino",
    links: ["Originals", "Slots", "Live Casino", "Table Games", "Providers"],
  },
  {
    title: "Promotions",
    links: ["Welcome Bonus", "Daily Rakeback", "VIP Club", "Tournaments", "Mega Drop"],
  },
  {
    title: "Account",
    links: ["My Wallet", "Deposits", "Withdrawals", "Affiliate Program", "Responsible Gaming"],
  },
  {
    title: "Support",
    links: ["Help Center", "Live Chat", "Provably Fair", "Terms of Service", "Privacy Policy"],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Top: brand + trust badges */}
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/40" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)" }}>
                <span className=" text-lg font-bold text-glow-lime" style={{ color: "var(--color-lime)" }}>T</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className=" text-xl font-bold tracking-wider" style={{ color: "var(--color-lime)" }}>TOLS</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Gaming</span>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              The crypto-native casino. Play. Hit. Win. Only on TOLS. Provably fair, instant payouts, community-owned.
            </p>
            <div className="flex gap-2">
              {[Twitter, Send, MessageCircle, Github].map((Icon, i) => (
                <button
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
                  style={undefined}
                  aria-label="social"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Link sections */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title}>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link}>
                      <button className="text-xs text-muted-foreground transition-colors hover:text-lime" style={undefined}>
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-col gap-4 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-lime" style={{ color: "var(--color-lime)" }} />
              Provably Fair
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-lime" style={{ color: "var(--color-lime)" }} />
              SSL Encrypted
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-lime" style={{ color: "var(--color-lime)" }} />
              24/7 Support
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { sym: "SOL", color: "#9945FF" },
              { sym: "ETH", color: "#627EEA" },
              { sym: "BTC", color: "#f7931a" },
              { sym: "USDT", color: "#26a17b" },
              { sym: "MATIC", color: "#8247E5" },
            ].map((c) => (
              <span
                key={c.sym}
                className="flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono font-semibold transition-colors"
                style={{ borderColor: c.color + "40", color: c.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                {c.sym}
              </span>
            ))}
          </div>
        </div>

        {/* Crypto disclaimer */}
        <div className="mt-6 rounded-lg border border-border/40 bg-card/30 p-3 text-center text-[10px] leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground/70">⚠ Responsible Gaming</p>
          Gambling can be addictive. TOLS Gaming is a demo platform — no real cryptocurrency is involved. Play responsibly.
          If you need help, contact your local responsible gaming helpline. 18+ only.
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-2 text-[10px] text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} TOLS Gaming. All rights reserved.</p>
          <p>Built with provably-fair technology · Curaçao-style license demo</p>
        </div>
      </div>
    </footer>
  );
}
