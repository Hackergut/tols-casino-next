import type { LucideIcon } from "lucide-react";
import { Gift, Percent, Zap, TrendingUp, Flame, Coins, Crown, Trophy, Swords } from "lucide-react";

/*
 * Official TOLS promotions — single source of truth shared by the home-screen
 * promotional cards and the Discover → Promotions info page. These mirror the
 * operator-facing Promotions catalogue (src/casino/components/casino/sections/
 * Promotions.tsx) plus the evergreen campaign promos, so the public lobby and
 * the internal tool never drift apart.
 */

export type PromoKind = "welcome" | "rakeback" | "reload" | "cashback" | "jackpot" | "referral" | "campaign";

export interface TolsPromotion {
  id: string;
  kind: PromoKind;
  title: string;
  /** One-line hook shown on the card. */
  tagline: string;
  /** Longer copy for the info page. */
  description: string;
  /** Prominent reward string (e.g. "100% up to $1,000"). */
  reward: string;
  icon: LucideIcon;
  /** Accent colour (CSS). */
  accent: string;
  /** Navigation target — a section id or Original id handled by the shell. */
  target: string;
  /** CTA label. */
  cta: string;
  requirements: string[];
  /** Optional corner badge (e.g. "Ends in 10 days"). */
  badge?: string;
  /** 16:9 artwork path (public/promos/*). */
  image: string;
}

export const OFFICIAL_PROMOTIONS: TolsPromotion[] = [
  {
    id: "welcome",
    kind: "welcome",
    title: "Welcome Bonus",
    tagline: "100% match on your first deposit",
    description:
      "New players get a 100% match on their first deposit, up to $1,000, credited as bonus money. Play it through to release it into your withdrawable balance.",
    reward: "100% up to $1,000",
    icon: Gift,
    accent: "var(--color-lime)",
    target: "register",
    cta: "Claim",
    requirements: ["First deposit only", "30× wagering requirement", "Valid for 7 days"],
    image: "/promos/welcome.jpg",
    badge: "New players",
  },
  {
    id: "rakeback",
    kind: "rakeback",
    title: "Daily Rakeback",
    tagline: "Up to 20% back, every single day",
    description:
      "Get up to 20% of your daily wagering back, automatically. No opt-in, no claim button — the credit lands in your wallet based on your VIP tier.",
    reward: "Up to 20% back",
    icon: Percent,
    accent: "var(--color-vip)",
    target: "vip",
    cta: "See tiers",
    requirements: ["Based on VIP tier", "Credited daily", "No wagering requirement"],
    image: "/promos/rakeback.jpg",
    badge: "Automatic",
  },
  {
    id: "reload",
    kind: "reload",
    title: "Weekly Reload",
    tagline: "50% reload bonus every Friday",
    description:
      "Every Friday, top up with a 50% reload bonus up to $500 on your deposit. Weekend sessions start with more to play.",
    reward: "50% up to $500",
    icon: Zap,
    accent: "#3b82f6",
    target: "wallet",
    cta: "Deposit",
    requirements: ["Minimum deposit $20", "1× wagering", "Fridays only"],
    image: "/promos/reload.jpg",
    badge: "Fridays",
  },
  {
    id: "cashback",
    kind: "cashback",
    title: "Monthly Cashback",
    tagline: "10% cashback on net losses",
    description:
      "Diamond tier and above receive 10% monthly cashback on net losses, credited on the first of every month with no wagering attached.",
    reward: "10% monthly",
    icon: TrendingUp,
    accent: "#10b981",
    target: "vip",
    cta: "See tiers",
    requirements: ["Diamond+ tier", "Minimum $100 net loss", "No wagering"],
    image: "/promos/cashback.jpg",
    badge: "1st of month",
  },
  {
    id: "megadrop",
    kind: "jackpot",
    title: "Mega Drop Jackpot",
    tagline: "A progressive pot that can drop at any moment",
    description:
      "Every real bet feeds the progressive Mega Drop. There is no entry — the jackpot can trigger on any spin or roll, at any stake.",
    reward: "Progressive",
    icon: Flame,
    accent: "var(--color-loss)",
    target: "originals",
    cta: "Play now",
    requirements: ["Any bet qualifies", "Random trigger", "No maximum bet"],
    image: "/promos/megadrop.jpg",
    badge: "Live",
  },
  {
    id: "referral",
    kind: "referral",
    title: "Referral Commission",
    tagline: "Earn 25–30% revshare, for life",
    description:
      "Invite friends and earn 25–30% revenue share on their wagers for the lifetime of the account. No cap on referrals.",
    reward: "25–30% revshare",
    icon: Coins,
    accent: "var(--color-pending)",
    target: "affiliate",
    cta: "Invite",
    requirements: ["No referral limit", "Lifetime commission", "Revshare or CPA plan"],
    image: "/promos/referral.jpg",
  },
];

/*
 * Evergreen campaign promos — surfaced in the Discover → Promotions info page
 * (and the home hero), distinct from the claimable/deposit promotions above.
 */
export const CAMPAIGN_PROMOTIONS: TolsPromotion[] = [
  {
    id: "weekly-race",
    kind: "campaign",
    title: "$100,000 Weekly Race",
    tagline: "Live leaderboard, resets every Monday",
    description:
      "Wager on any Originals to climb the weekly leaderboard. The top players split $100,000 every single week. Paid bets only — practice rounds never count.",
    reward: "$100,000 pool",
    icon: Trophy,
    accent: "var(--color-lime)",
    target: "rewards",
    cta: "View leaderboard",
    requirements: ["Paid bets only", "Resets Monday", "Top 100 paid"],
    image: "/promos/weekly-race.jpg",
    badge: "Weekly",
  },
  {
    id: "clutch-up",
    kind: "campaign",
    title: "$20K Clutch Up",
    tagline: "Hit the targets, take the prize",
    description:
      "A limited-time challenge: hit the selected multipliers across the Originals to claim a slice of the $20,000 prize pool before the timer runs out.",
    reward: "$20,000 pool",
    icon: Swords,
    accent: "#8b5cf6",
    target: "originals",
    cta: "Play Originals",
    requirements: ["Limited time", "Target multipliers", "One entry per player"],
    image: "/promos/clutch-up.jpg",
    badge: "Ends in 10 days",
  },
  {
    id: "level-up",
    kind: "campaign",
    title: "Level Up!",
    tagline: "A reward at every VIP tier",
    description:
      "Every VIP tier unlocks new perks — cashback, free spins, priority withdrawals and more. The more you wager, the higher you climb.",
    reward: "Reward per tier",
    icon: Crown,
    accent: "var(--color-vip)",
    target: "vip",
    cta: "See tiers",
    requirements: ["1 point per $1 wagered", "Tiers auto-upgrade", "Perks stack"],
    image: "/promos/level-up.jpg",
  },
  {
    id: "challenges",
    kind: "campaign",
    title: "Casino Challenges",
    tagline: "Daily and weekly missions with prizes",
    description:
      "Complete daily and weekly casino challenges — from streak targets to specific-game missions — and earn bonus rewards as you play.",
    reward: "29 open",
    icon: Trophy,
    accent: "#f59e0b",
    target: "originals",
    cta: "Start a challenge",
    requirements: ["Daily & weekly", "Auto-tracked", "Bonus rewards"],
    image: "/promos/challenges.jpg",
    badge: "29 open",
  },
];

export const ALL_PROMOTIONS: TolsPromotion[] = [...OFFICIAL_PROMOTIONS, ...CAMPAIGN_PROMOTIONS];

/** Human label per promo kind — shared by every card surface. */
export const PROMO_KIND_LABEL: Record<string, string> = {
  welcome: "Welcome",
  rakeback: "Rakeback",
  reload: "Reload",
  cashback: "Cashback",
  jackpot: "Jackpot",
  referral: "Referral",
  campaign: "Campaign",
};
