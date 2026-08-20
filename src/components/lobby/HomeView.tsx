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
import { TARGET_RTP, SLOTS_RTP } from '@/lib/game-math';
import {
  Flame, Layers, Radio, LayoutGrid, Gamepad2, Trophy, Sparkles,
  ChevronRight, Clock, Star,
} from "lucide-react";
import { Carousel } from "./Carousel";
import { HeroCarousel } from "./HeroCarousel";
import { LobbyGameCard } from "./GameCards";
import { EurovirtualsRow } from "./EurovirtualsRow";
import { PromotionCards } from "./PromotionCards";
import type { LobbyGame } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

interface Props {
  games: LobbyGame[];
  loading: boolean;
  onGameClick: (game: LobbyGame) => void;
  onNavigate: (section: string) => void;
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
  const { t } = useLocale();
  const labels: Record<string, string> = { lobby: t("nav.lobby"), originals: t("nav.originals"), slots: t("nav.slots"), live: t("nav.liveCasino"), table: t("nav.table") };
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
          <Icon className="h-4 w-4" /> {labels[id] ?? label}
        </button>
      ))}
    </div>
  );
}

/* Empty state for a category the catalogue does not stock yet. */
function EmptyRow({ label }: { label: string }) {
  const { t } = useLocale();
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
      <p className="text-sm text-white/45">{t("home.noCategory", { category: label })}</p>
      <p className="mt-1 text-xs text-white/25">{t("home.addedLater")}</p>
    </div>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  const { t } = useLocale();
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white"
    >
      {t("common.viewAll")} <ChevronRight className="h-3 w-3" />
    </button>
  );
}

/* ── Featured race with live leaderboard ── */
interface LeaderRow { userId: string; username: string; avatarColor: string; wagered: number }

function WeeklyRace({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  useEffect(() => {
    fetch("/api/leaderboard?metric=wagered&period=weekly&limit=5")
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
            <h2 className="font-display text-base uppercase text-white">{t("home.weeklyRace")}</h2>
            <p className="flex items-center gap-1 text-[11px] text-white/45">
              <Clock className="h-3 w-3" /> {t("home.resetsMonday")}
            </p>
          </div>
        </div>
        <button onClick={onOpen} className="flex min-h-10 items-center gap-1 rounded-xl border border-lime/25 bg-lime/8 px-3 font-mono text-sm font-black tabular-nums text-lime">
          $100,000 <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="divide-y divide-white/5">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-white/40">{t("home.raceEmpty")}</p>
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
                  {t("home.wagered", { amount: `$${r.wagered.toFixed(2)}` })}
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
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-white/6 bg-surface/40 p-5">
      <h2 className="font-display text-base uppercase text-white">{t("home.aboutTitle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{t("home.aboutBody")}</p>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/55">
          <p>{t("home.aboutMath", { rtp: (TARGET_RTP * 100).toFixed(0), slotsRtp: (SLOTS_RTP * 100).toFixed(0) })}</p>
          <p>{t("home.aboutSecurity")}</p>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-semibold text-lime transition-opacity hover:opacity-80"
      >
        {open ? t("common.showLess") : t("common.showMore")}
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
  const { t } = useLocale();
  const originals = games.filter((g) => g.gameType === "original");
  const slots = games.filter((g) => g.gameType === "external_slot");
  const live = games.filter((g) => g.isLive);

  const row = (title: string, icon: React.ReactNode, list: LobbyGame[], emptyLabel: string, target: string) =>
    list.length > 0 ? (
      <Carousel title={title} size="large" icon={icon} action={<ViewAll onClick={() => onNavigate(target)} />}>
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
      {/* Visual hierarchy: large promotion hero, category tabs, then the
          primary Originals shelf before any secondary lobby content. */}
      <HeroCarousel onSelect={onNavigate} />
      <CategoryNav active="lobby" onNavigate={onNavigate} />

      {/* Official promotions — visible pre sign-up / login. */}
      <PromotionCards onNavigate={onNavigate} />

      {loading ? (
        <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[16/9] rounded-2xl bg-surface" />
          ))}
        </div>
      ) : row("TOLS Originals", <Flame className="h-5 w-5 shrink-0 text-lime" />, originals, "originals", "originals")}

      <MegaJackpot />

      {!loading && (
        <>
          {row(t("nav.slots"), <Layers className="h-5 w-5 shrink-0 text-lime" />, slots, t("nav.slots").toLowerCase(), "slots")}
          {row(t("nav.liveCasino"), <Radio className="h-5 w-5 shrink-0 text-lime" />, live, t("nav.liveCasino").toLowerCase(), "live")}
          <EurovirtualsRow onSelect={onGameClick} />
          <WeeklyRace onOpen={() => onNavigate("rewards")} />
          {row(t("home.gameShows"), <Sparkles className="h-5 w-5 shrink-0 text-lime" />, [], t("home.gameShows").toLowerCase(), "live")}
          {row(t("home.latest"), <Star className="h-5 w-5 shrink-0 text-lime" />, originals.slice(0, 6), t("home.latest").toLowerCase(), "originals")}
        </>
      )}

      <AboutTols />
    </div>
  );
}
