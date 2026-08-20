"use client";

/*
 * Discover info pages — the informational landing for each Discover section.
 *
 * Discover groups the discovery surface of the platform (Promotions,
 * Challenges, Leaderboards, Affiliate, …). These are the dedicated info pages
 * for the sections that are purely informational; functional sections (Wallet,
 * Transactions, Settings, Live Support) live in ProfileSections.tsx.
 *
 * Every promotion also has its own detail page (PromoDetailSection) rendered
 * at /promo/{id}: the hero is the exact artwork of the promo card the player
 * tapped, dressed in the same TOLS brand accents, so the card → page jump is
 * seamless.
 */

import { ArrowLeft, Gift, Swords, CheckCircle2, ArrowUpRight, ChevronRight } from "lucide-react";
import { ALL_PROMOTIONS, type TolsPromotion } from "./promotions";
import { promoSection } from "@/lib/casino-routes";

/* Same type scale + kind labels as the game cards / promo cards. */
const TITLE_STYLE: React.CSSProperties = {
  fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)",
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 6px rgb(0 0 0 / 0.75)",
};
const META_STYLE: React.CSSProperties = {
  fontSize: "clamp(0.75rem, 0.7rem + 0.24vw, 0.875rem)",
  lineHeight: 1.25,
  textShadow: "0 1px 5px rgb(0 0 0 / 0.7)",
};
const KIND_LABEL: Record<string, string> = {
  welcome: "Welcome",
  rakeback: "Rakeback",
  reload: "Reload",
  cashback: "Cashback",
  jackpot: "Jackpot",
  referral: "Referral",
  campaign: "Campaign",
};

function InfoShell({ title, subtitle, icon: Icon, onBack, children }: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
            <Icon className="h-5 w-5 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Promo hero — the card's artwork as the page hero, game-card chrome ── */
function PromoHero({ promo, icon: Icon }: { promo: TolsPromotion; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  const kind = KIND_LABEL[promo.kind] ?? promo.kind;
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-lime/15 bg-surface" style={{ boxShadow: "0 24px 60px rgb(0 0 0 / 0.45), 0 0 0 1px color-mix(in oklab, var(--color-lime) 10%, transparent)" }}>
      <img src={promo.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />

      {/* Top-left: lime kind pill. */}
      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        <span className="tols-game-pill tols-game-pill-original">{kind}</span>
      </div>

      {/* Top-right: badge pill. */}
      {promo.badge && (
        <span className="absolute right-2.5 top-2.5 tols-game-pill tols-game-pill-new">{promo.badge}</span>
      )}

      {/* Center icon chip — the play-circle slot, here the promo icon. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-lime/40 bg-black/55 backdrop-blur-sm">
          <Icon className="h-6 w-6 text-lime" />
        </span>
      </div>

      {/* Bottom bar: title + kind · tagline left, reward chip right. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-16 sm:p-5">
        <div className="min-w-0">
          <h2 className="truncate font-bold text-white" style={TITLE_STYLE}>{promo.title}</h2>
          <p className="truncate text-white/60" style={META_STYLE}>{kind} · {promo.tagline}</p>
        </div>
        <span className="flex max-w-[130px] shrink-0 items-center gap-1.5 rounded bg-black/55 px-2 py-1 font-mono text-xs font-bold tabular-nums text-lime" style={{ textShadow: "0 0 18px rgb(204 255 0 / 0.35)" }}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-lime/80" />
          <span className="truncate">{promo.reward}</span>
        </span>
      </div>
    </div>
  );
}

/* ── Single promotion detail page (/promo/{id}) ── */
export function PromoDetailSection({ promoId, onBack, onNavigate }: {
  promoId: string;
  onBack: () => void;
  onNavigate: (target: string) => void;
}) {
  const promo = ALL_PROMOTIONS.find((p) => p.id === promoId);
  if (!promo) {
    return (
      <InfoShell title="Promotion" subtitle="This promotion is not available" icon={Gift} onBack={onBack}>
        <div className="rounded-2xl border border-white/8 bg-surface/60 p-8 text-center">
          <p className="text-sm text-white/50">The promotion you are looking for doesn't exist or has ended.</p>
          <button onClick={() => onNavigate("promotions")} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-bg transition-opacity hover:opacity-90">
            All promotions <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </InfoShell>
    );
  }

  const Icon = promo.icon;
  const others = ALL_PROMOTIONS.filter((p) => p.id !== promo.id);

  return (
    <div className="space-y-6">
      {/* Header: back + section context. */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
            <Gift className="h-5 w-5 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Promotion</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Official TOLS offer · {promo.title}</p>
          </div>
        </div>
      </div>

      {/* Hero — the exact artwork of the card the player tapped. */}
      <PromoHero promo={promo} icon={Icon} />

      {/* Body: description + requirements + CTA. */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-surface/60">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ background: `color-mix(in oklab, ${promo.accent} 14%, transparent)`, borderColor: `color-mix(in oklab, ${promo.accent} 30%, transparent)` }}>
              <Icon className="h-4 w-4" style={{ color: promo.accent }} />
            </span>
            <p className="text-sm leading-relaxed text-white/55">{promo.description}</p>
          </div>

          <ul className="mt-4 space-y-1.5">
            {promo.requirements.map((req) => (
              <li key={req} className="flex items-center gap-2 text-xs text-white/50">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: promo.accent }} />
                {req}
              </li>
            ))}
          </ul>

          <button
            onClick={() => onNavigate(promo.target)}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition-opacity hover:opacity-90 sm:w-auto"
            style={{ background: promo.accent, color: "var(--color-bg)", boxShadow: `0 8px 28px color-mix(in oklab, ${promo.accent} 30%, transparent)` }}
          >
            {promo.cta} <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* More promotions — the same cards, so players keep exploring. */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <h2 className="font-display text-base uppercase text-white">More promotions</h2>
          <button onClick={() => onNavigate("promotions")} className="flex items-center gap-1 text-xs font-bold text-lime transition-opacity hover:opacity-80">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1" style={{ scrollSnapType: "x mandatory" }}>
          {others.map((p) => (
            <button
              key={p.id}
              onClick={() => onNavigate(promoSection(p.id))}
              aria-label={`${p.title} — ${p.reward} — details`}
              className="tols-game-card group w-64 shrink-0 sm:w-72"
              style={{ scrollSnapAlign: "start" }}
            >
              <img src={p.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="tols-game-play">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-14">
                <div className="min-w-0">
                  <p className="truncate font-bold text-white" style={TITLE_STYLE}>{p.title}</p>
                  <p className="truncate text-white/60" style={META_STYLE}>{KIND_LABEL[p.kind] ?? p.kind} · {p.tagline}</p>
                </div>
                <span className="max-w-[92px] shrink-0 truncate rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-lime">
                  {p.reward}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PromoDetailCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = promo.icon;
  const kind = KIND_LABEL[promo.kind] ?? promo.kind;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-surface/60">
      {/* 16:9 artwork header — game-card chrome, entry to the detail page. */}
      <button type="button" onClick={() => onNavigate(promoSection(promo.id))} aria-label={`${promo.title} — details`} className="tols-game-card group relative block w-full cursor-pointer text-left">
        <div className="relative aspect-[16/9] overflow-hidden">
          <img src={promo.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />

          {/* Kind pill top-left, badge pill top-right. */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <span className="tols-game-pill tols-game-pill-original">{kind}</span>
          </div>
          {promo.badge && (
            <span className="absolute right-2.5 top-2.5 tols-game-pill tols-game-pill-new">{promo.badge}</span>
          )}

          {/* Play circle revealed on hover. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="tols-game-play">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>

          {/* Bottom bar: title + kind · tagline left, reward chip right. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-14">
            <div className="min-w-0">
              <h3 className="truncate font-bold text-white" style={TITLE_STYLE}>{promo.title}</h3>
              <p className="truncate text-white/60" style={META_STYLE}>{kind} · {promo.tagline}</p>
            </div>
            <span className="max-w-[110px] shrink-0 truncate rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-lime">
              {promo.reward}
            </span>
          </div>
        </div>
      </button>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ background: `color-mix(in oklab, ${promo.accent} 14%, transparent)`, borderColor: `color-mix(in oklab, ${promo.accent} 30%, transparent)` }}>
            <Icon className="h-4 w-4" style={{ color: promo.accent }} />
          </span>
          <p className="text-sm leading-relaxed text-white/55">{promo.description}</p>
        </div>

        <ul className="mt-3 space-y-1.5">
          {promo.requirements.map((req) => (
            <li key={req} className="flex items-center gap-2 text-xs text-white/50">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: promo.accent }} />
              {req}
            </li>
          ))}
        </ul>

        <button
          onClick={() => onNavigate(promo.target)}
          className="mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: promo.accent, color: "var(--color-bg)" }}
        >
          {promo.cta} <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PromotionsInfoSection({ onBack, onNavigate }: { onBack: () => void; onNavigate: (target: string) => void }) {
  return (
    <InfoShell title="Promotions" subtitle="Every official TOLS promotion, in one place" icon={Gift} onBack={onBack}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_PROMOTIONS.map((promo) => (
          <PromoDetailCard key={promo.id} promo={promo} onNavigate={onNavigate} />
        ))}
      </div>
    </InfoShell>
  );
}

const CHALLENGES = [
  { title: "Daily Streak", desc: "Bet every day to keep your streak alive and earn escalating rewards.", reward: "Up to $50 / day" },
  { title: "Originals Gauntlet", desc: "Hit the selected multipliers across Dice, Crash, Mines and more.", reward: "$50,000 pool" },
  { title: "Multiplier Hunter", desc: "Land a multiplier above 100× on any Original before the week ends.", reward: "Bonus credits" },
  { title: "Wagering Race", desc: "Climb the wagered-amount leaderboard for your tier.", reward: "$100,000 pool" },
  { title: "Referral Sprint", desc: "Bring the most new players this month for a bonus commission boost.", reward: "Boosted revshare" },
  { title: "VIP Climb", desc: "Reach the next VIP tier within the window for a tier-up bonus.", reward: "Tier-up bonus" },
];

export function ChallengesInfoSection({ onBack, onNavigate }: { onBack: () => void; onNavigate: (target: string) => void }) {
  return (
    <InfoShell title="Challenges" subtitle="Daily and weekly missions with real rewards" icon={Swords} onBack={onBack}>
      <p className="max-w-2xl text-sm leading-relaxed text-white/55">
        Challenges are auto-tracked missions that run alongside your play. Complete them and the reward is credited
        automatically — no opt-in, no claim timer. Paid bets only; practice rounds never count toward a challenge.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHALLENGES.map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/8 bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-white">{c.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{c.desc}</p>
            <p className="mt-3 font-mono text-sm font-black text-lime">{c.reward}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => onNavigate("originals")}
        className="flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-black uppercase tracking-wide text-bg transition-opacity hover:opacity-90"
      >
        Start a challenge <ArrowUpRight className="h-4 w-4" />
      </button>
    </InfoShell>
  );
}
