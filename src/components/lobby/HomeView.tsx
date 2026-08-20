"use client";

/*
 * Home page, composed in the running order the product asked for:
 *   auth CTAs → promo strip → category nav → Originals → Slots → Live Casino →
 *   Providers → featured race → Game Shows → Picks → Latest Releases →
 *   Tournaments → about copy → footer.
 *
 * Rows are driven by real data. Categories the catalogue does not carry yet
 * (slots, live casino, game shows) render an explicit empty state rather than
 * inventing third-party titles — listing games the platform has no licence for
 * would misrepresent what a player can actually open.
 */

import { useEffect, useState } from "react";
import {
  Flame, Layers, Radio, LayoutGrid, Gamepad2, Trophy, Gift, Users, Sparkles,
  ChevronRight, Clock, Star,
} from "lucide-react";
import { Carousel } from "./Carousel";
import { HeroCarousel } from "./HeroCarousel";
import { motion, useReducedMotion } from "framer-motion";
import { LobbyGameCard } from "./GameCards";
import {
  ORIGINAL_IDS,
  mergeOriginals,
  originalToLobbyGame,
  ORIGINAL_GAMES,
  type LobbyGame,
} from "./lobby-types";

interface Props {
  games: LobbyGame[];
  loading: boolean;
  onGameClick: (game: LobbyGame) => void;
  onNavigate: (section: string) => void;
  authenticated?: boolean;
}

/* ── 1. Auth call to action ── */
function AuthBar({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onNavigate("login")}
        className="rounded-xl border border-white/12 px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:border-lime/40 hover:text-white"
      >
        Login
      </button>
      <button
        onClick={() => onNavigate("register")}
        className="rounded-xl bg-lime px-5 py-2.5 text-sm font-black text-bg transition-transform hover:-translate-y-0.5"
      >
        Register
      </button>
    </div>
  );
}

/* ── 2. Promotions strip ── */
const PROMOS = [
  { id: "level-up", label: "Level Up!", detail: "Reward at every tier", icon: Star, accent: true },
  { id: "clutch-up", label: "$20K Clutch Up", detail: "Ends in 10d", icon: Trophy, accent: false },
  { id: "weekly-race", label: "$100,000 Weekly Race", detail: "Live leaderboard", icon: Flame, accent: true },
  { id: "challenges", label: "Casino Challenges", detail: "29 open", icon: Gift, accent: false },
  { id: "affiliate", label: "Affiliate Program", detail: "Earn commission", icon: Users, accent: false },
];

function PromoStrip({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {PROMOS.map(({ id, label, detail, icon: Icon, accent }) => (
        <motion.button
          key={id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: PROMOS.indexOf(PROMOS.find((x) => x.id === id)!) * 0.05, duration: 0.35 }}
          onClick={() => onNavigate(id === "affiliate" ? "affiliate" : "rewards")}
          className="group flex min-w-[190px] shrink-0 items-center gap-3 rounded-2xl border border-white/6 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-lime/30"
          style={{
            background: accent
              ? "linear-gradient(120deg, color-mix(in oklab, var(--color-lime) 16%, #0f1015), #0f1015 75%)"
              : "var(--color-surface)",
          }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/12">
            <Icon className="h-4 w-4 text-lime" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">{label}</span>
            <span className="block truncate text-[11px] text-white/45">{detail}</span>
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/* ── 3. Category navigation ── */
const CATEGORIES = [
  { id: "lobby", label: "Lobby", icon: Gamepad2 },
  { id: "originals", label: "Originals", icon: Flame },
  { id: "slots", label: "Slots", icon: Layers },
  { id: "live", label: "Live Casino", icon: Radio },
  { id: "table", label: "Table Games", icon: LayoutGrid },
];

function CategoryNav({ active, onNavigate }: { active: string; onNavigate: (s: string) => void }) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {CATEGORIES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          style={
            active === id
              ? { background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", color: "var(--color-lime)", border: "1px solid color-mix(in oklab, var(--color-lime) 25%, transparent)" }
              : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", border: "1px solid transparent" }
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

/* Empty state for a category the catalogue does not stock yet. */
function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
      <p className="text-sm text-white/45">No {label} in the catalogue yet</p>
      <p className="mt-1 text-xs text-white/25">Games appear here once they are added to the library</p>
    </div>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white"
    >
      View all <ChevronRight className="h-3 w-3" />
    </button>
  );
}

/* ── Featured race with live leaderboard ── */
interface LeaderRow { userId: string; username: string; avatarColor: string; wagered: number }

function WeeklyRace() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  useEffect(() => {
    fetch("/api/leaderboard?metric=wagered&limit=5")
      .then((r) => r.json())
      .then((j) => { if (j.success) setRows(j.data.leaderboard ?? []); })
      .catch(() => {});
  }, []);

  const PRIZES = [50000, 30000, 20000, 16500, 14150];

  return (
    <section className="overflow-hidden rounded-2xl border border-lime/12" style={{ background: "linear-gradient(140deg, color-mix(in oklab, var(--color-lime) 12%, #0f1015), #0f1015 65%)" }}>
      <header className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-lime" />
          <div>
            <h2 className="font-display text-base uppercase text-white">$100,000 Weekly Race</h2>
            <p className="flex items-center gap-1 text-[11px] text-white/45">
              <Clock className="h-3 w-3" /> Resets every Monday
            </p>
          </div>
        </div>
        <span className="font-mono text-lg font-black tabular-nums text-lime">$100,000</span>
      </header>

      <div className="divide-y divide-white/5">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-white/40">Leaderboard is still warming up — place a bet to enter</p>
        ) : (
          rows.slice(0, 5).map((r, i) => (
            <div key={r.userId} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={i < 3
                    ? { background: "var(--color-lime)", color: "var(--color-bg)" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-sm font-semibold text-white">{r.username}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-lime">
                  ${PRIZES[i]?.toLocaleString() ?? "—"}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-white/35">
                  ${r.wagered.toFixed(2)} wagered
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ── About copy, collapsed by default ── */
function AboutTols() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-white/6 bg-surface/40 p-5">
      <h2 className="font-display text-base uppercase text-white">TOLS — Provably Fair Crypto Casino</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        TOLS runs its own Originals on a provably fair engine: every outcome comes from
        HMAC-SHA256 over a server seed whose SHA-256 commitment is published before you bet,
        your own client seed, and an incrementing nonce. Rotate the seed at any time and the
        old one is revealed, so you can recompute every result yourself.
      </p>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/55">
          <p>
            Game maths is enforced server-side. Roulette pays true single-zero odds at 97.3% RTP,
            the slots reel weights are normalised so the return is exactly 97%, and Plinko,
            Mines, Dice, Limbo and Crash all settle on the server before any animation plays —
            the client only draws the result it was given.
          </p>
          <p>
            Balances move in atomic database transactions, withdrawals hold funds until an
            operator settles or rejects them, and every privileged action is written to an
            audit trail.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-semibold text-lime transition-opacity hover:opacity-80"
      >
        {open ? "Show less" : "Show more"}
      </button>
    </section>
  );
}

/* ── Footer ── */
const FOOTER = [
  { title: "Support", links: ["Live Support", "Help Center", "Game Responsibly"] },
  { title: "Platform", links: ["Provably Fair", "Affiliate Program", "Redeem Code", "VIP Program"] },
  { title: "Policy", links: ["Terms of Service", "Privacy Policy", "Responsible Gambling", "AML Policy"] },
  { title: "Community", links: ["Telegram", "X", "Instagram", "Forum"] },
];

function HomeFooter() {
  return (
    <footer className="rounded-2xl border border-white/6 bg-surface/30 px-5 py-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FOOTER.map((col) => (
          <div key={col.title}>
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <span className="cursor-pointer text-sm text-white/60 transition-colors hover:text-lime">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-white/6 pt-4">
        <p className="text-xs text-white/35">
          Play responsibly. TOLS provides loss limits, wager limits and self-exclusion tools.
          Support is available if gambling stops being fun. 18+ only.
        </p>
        <p className="mt-2 text-[11px] text-white/25">© 2026 TOLS Casino — Provably Fair Gaming</p>
      </div>
    </footer>
  );
}


/* ── Mega jackpot ── */
function MegaJackpot() {
  const [amt, setAmt] = useState(0);
  useEffect(() => {
    fetch("/api/jackpot").then((r) => r.json())
      .then((j) => { if (j.success) setAmt(j.data?.amount ?? 0); }).catch(() => {});
  }, []);
  return (
    <div className="flex items-center gap-4 px-1">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-lime" />
        <span className="text-[11px] font-black uppercase leading-tight tracking-wider text-white/45">Mega<br />Jackpot</span>
      </div>
      <span className="font-mono text-2xl font-black tabular-nums text-lime sm:text-3xl">
        ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

/* ── Page ── */
export function HomeView({ games, loading, onGameClick, onNavigate }: Props) {
  const originals = mergeOriginals(games);
  const slots = games.filter((g) => g.gameType === "external_slot");
  const live = games.filter((g) => g.isLive);

  const onHero = (target: string) => {
    if (ORIGINAL_IDS.has(target)) {
      const def = ORIGINAL_GAMES.find((g) => g.id === target);
      if (def) onGameClick(originalToLobbyGame(def));
      return;
    }
    onNavigate(target);
  };

  const row = (title: string, icon: React.ReactNode, list: LobbyGame[], emptyLabel: string, target: string, subtitle?: string) =>
    list.length > 0 ? (
      <Carousel title={title} subtitle={subtitle} size="large" icon={icon} action={<ViewAll onClick={() => onNavigate(target)} />}>
        {list.map((g) => <LobbyGameCard key={g.id} game={g} onClick={() => onGameClick(g)} />)}
      </Carousel>
    ) : (
      <section>
        <header className="mb-4 flex items-center gap-2">{icon}
          <h2 className="font-display text-base uppercase text-white">{title}</h2>
        </header>
        <EmptyRow label={emptyLabel} />
      </section>
    );

  return (
    <div className="space-y-7">
      <PromoStrip onNavigate={onNavigate} />
      <CategoryNav active="lobby" onNavigate={onNavigate} />
      <HeroCarousel onSelect={onHero} />
      <MegaJackpot />

      {loading ? (
        <div className="tols-games-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[16/11] rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <>
          {row("TOLS Originals", <Flame className="h-5 w-5 shrink-0 text-lime" />, originals, "originals", "originals", "Provably fair · same card on every title")}
          {row("Slots", <Layers className="h-5 w-5 shrink-0 text-lime" />, slots, "slots", "slots")}
          {row("Live Casino", <Radio className="h-5 w-5 shrink-0 text-lime" />, live, "live tables", "live")}

          <WeeklyRace />

          {row("Game Shows", <Sparkles className="h-5 w-5 shrink-0 text-lime" />, [], "game shows", "live")}
          {row("Latest Releases", <Star className="h-5 w-5 shrink-0 text-lime" />, originals.slice(0, 6), "releases", "originals")}
        </>
      )}

      <AboutTols />
    </div>
  );
}
