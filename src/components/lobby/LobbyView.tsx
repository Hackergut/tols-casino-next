"use client";

// Lobby view — redesigned to the TOLS mockup: wordmark + promo banners,
// Italian category tabs, a "TOLS GAMES" carousel, and the live-bets feed.
import { useEffect, useState } from "react";
import { Gamepad2, Home, Layers, Radio, LayoutGrid, Search } from "lucide-react";
import { LobbyGameCard } from "./GameCards";
import { Carousel } from "./Carousel";
import { VirtualGamesView } from "./VirtualGamesView";
import { timeAgo, type CasinoStats, type LiveBet, type LobbyGame } from "./lobby-types";

/* Italian category tabs mapped to grid filters. */
const IT_TABS = [
  { id: "all", label: "Sala Principale", icon: Home },
  { id: "originals", label: "Originali", icon: Gamepad2 },
  { id: "slots", label: "Slot", icon: Layers },
  { id: "live", label: "Casinò dal vivo", icon: Radio },
  { id: "virtual", label: "Virtuali", icon: Radio },
  { id: "table", label: "Giochi da Tavolo", icon: LayoutGrid },
] as const;

function PromoBanner({ badge, title, subtitle, brand, accent }: {
  badge: string; title: string; subtitle: string; brand?: string; accent: "lime" | "dark";
}) {
  return (
    <div
      className="relative flex-1 overflow-hidden rounded-2xl p-5"
      style={{
        minHeight: 150,
        background: accent === "lime"
          ? "linear-gradient(120deg, color-mix(in oklab, var(--color-lime) 22%, #0f1015), #0f1015 70%)"
          : "linear-gradient(120deg, #24241f, #0f1015 70%)",
        border: "1px solid color-mix(in oklab, var(--color-lime) 12%, transparent)",
      }}
    >
      {brand && <span className="absolute right-4 top-4 text-xs font-black tracking-widest text-white/40">{brand}</span>}
      <p className="text-2xl font-black text-lime">{badge}</p>
      <p className="font-display mt-1 text-lg uppercase leading-tight text-white">{title}</p>
      <p className="mt-2 text-xs text-white/50">{subtitle}</p>
    </div>
  );
}

export function LiveBetRow({ bet }: { bet: LiveBet }) {
  const won = bet.result === "win";
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/30">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: bet.avatarColor + "30", color: bet.avatarColor }}>
          {bet.username[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/70">{bet.username}</p>
          <p className="text-[10px] text-muted-foreground/70">{bet.gameName} · {timeAgo(bet.createdAt)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">${bet.amount.toFixed(2)}</span>
        <span className={`font-mono text-xs font-bold tabular-nums ${won ? "text-win" : "text-loss"}`}>{won ? "+" : ""}{(bet.payout - bet.amount).toFixed(2)}</span>
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${won ? "bg-win/10 text-win" : "bg-loss/10 text-loss"}`}>
          {bet.multiplier > 0 ? `${bet.multiplier.toFixed(2)}x` : "—"}
        </span>
      </div>
    </div>
  );
}

export function GamesGridSkeleton() {
  return (
    <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton-shimmer aspect-[16/11] rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

export function EmptyGames({ label }: { label: string }) {
  return (
    <div className="py-16 text-center">
      <Gamepad2 className="mx-auto mb-3 h-12 w-12 text-lime/20" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function MegaJackpot() {
  const [amt, setAmt] = useState(0);
  useEffect(() => {
    fetch("/api/jackpot").then((r) => r.json()).then((j) => { if (j.success) setAmt(j.data?.amount ?? j.data?.jackpot ?? 0); }).catch(() => {});
  }, []);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-lime/10 bg-surface/40 px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-lime" />
        <span className="text-[11px] font-black uppercase leading-tight tracking-wider text-white/45">Mega<br />Jackpot</span>
      </div>
      <span className="font-mono text-3xl font-black tabular-nums text-lime sm:text-4xl">
        ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

const LIVE_TABLES = [
  { name: "Midnight Roulette", host: "Mara V.", stakes: "$0.50 – $500", seats: "5/7 seats" },
  { name: "Black Deck VIP", host: "Theo K.", stakes: "$25 – $5,000", seats: "2/5 seats" },
  { name: "Speed Baccarat", host: "Ines R.", stakes: "$1 – $1,000", seats: "6/8 seats" },
];
function LiveNow() {
  return (
    <section>
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">Live Now</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {LIVE_TABLES.map((t) => (
          <div key={t.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-surface px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-lime" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{t.name}</p>
                <p className="truncate text-[11px] text-white/40">{t.host}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-lime">{t.stakes}</p>
              <p className="text-[11px] text-white/40">{t.seats}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LobbyView({ games, loading, stats, liveBets, onGameClick }: {
  games: LobbyGame[];
  loading: boolean;
  stats: CasinoStats | null;
  liveBets: LiveBet[];
  onGameClick: (game: LobbyGame) => void;
  onPlayCrash: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [gridMode, setGridMode] = useState(false);

  const filteredGames = games.filter((g) => {
    const okTab =
      activeTab === "all" ? true :
      activeTab === "originals" ? g.gameType === "original" :
      activeTab === "slots" ? g.gameType === "external_slot" :
      activeTab === "live" ? g.isLive :
      activeTab === "virtual" ? g.gameType === "external_virtual" :
      activeTab === "table" ? /table|baccarat|blackjack|roulette|poker/i.test(g.name) :
      true;
    const okQuery = query ? g.name.toLowerCase().includes(query.toLowerCase()) : true;
    return okTab && okQuery;
  });

  return (
    <div className="space-y-6">
      {/* Wordmark + promo banners */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <h1 className="font-display shrink-0 select-none text-4xl leading-none text-lime sm:text-5xl">TOLS</h1>
        <div className="flex flex-1 flex-col gap-4 sm:flex-row">
          <PromoBanner badge="$50,000" title="Originals Gauntlet!" subtitle="Hit all selected targets for prizes!" accent="lime" />
          <PromoBanner badge="$20,000" title="Hacksaw Shootout!" subtitle="Hit all selected prizes!" brand="HACKSAW" accent="dark" />
        </div>
      </div>

      {/* Category tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="scrollbar-hide -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          {IT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              style={activeTab === id
                ? { background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", color: "var(--color-lime)", border: "1px solid color-mix(in oklab, var(--color-lime) 25%, transparent)" }
                : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", border: "1px solid transparent" }}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca"
            className="w-full rounded-xl border border-border/60 bg-secondary/40 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-lime/40"
          />
        </div>
      </div>

      <MegaJackpot />

      {/* Virtuali tab uses its own dedicated view (EuroVirtuals catalog). */}
      {activeTab === "virtual" ? (
        <VirtualGamesView onGameSelect={onGameClick} />
      ) : loading ? (
        <GamesGridSkeleton />
      ) : filteredGames.length === 0 ? (
        <EmptyGames label="Nessun gioco in questa categoria" />
      ) : gridMode ? (
        <section>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-lime" />
              <h2 className="text-lg font-black uppercase tracking-wide text-white">TOLS Games</h2>
            </div>
            <button onClick={() => setGridMode(false)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">
              Carosello
            </button>
          </header>
          <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {filteredGames.map((game, i) => (
              <LobbyGameCard key={game.id || i} game={game} onClick={() => onGameClick(game)} />
            ))}
          </div>
        </section>
      ) : (
        <Carousel
          title="TOLS Games"
          size="large"
          icon={<Gamepad2 className="h-5 w-5 shrink-0 text-lime" />}
          action={
            <button onClick={() => setGridMode(true)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">
              Visualizza tutto
            </button>
          }
        >
          {filteredGames.map((game, i) => (
            <LobbyGameCard key={game.id || i} game={game} onClick={() => onGameClick(game)} />
          ))}
        </Carousel>
      )}

      <LiveNow />

      {/* Live Bets Feed */}
      {liveBets.length > 0 && (
        <div className="rounded-xl border border-lime/10 bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-win" />
            <h3 className="text-sm font-semibold text-foreground/70">Live Bets</h3>
            {stats && <span className="ml-auto text-xs text-muted-foreground">{stats.totalBets ?? ""}</span>}
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {liveBets.map((bet) => (
              <LiveBetRow key={bet.id} bet={bet} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
