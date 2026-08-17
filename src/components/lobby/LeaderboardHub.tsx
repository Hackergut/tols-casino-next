"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarClock, ChevronRight, Crown, Flame, Medal, RefreshCw,
  Sparkles, Target, Trophy, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";

interface Entry {
  rank: number;
  userId: string;
  username: string;
  avatarColor: string;
  level: number;
  wagered: number;
  wins: number;
  losses: number;
  pushes: number;
  biggestWin: number;
  biggestBet: number;
  bestMultiplier: number;
  totalWon: number;
  netProfit: number;
  betCount: number;
  winRate: number;
  favoriteGame: string | null;
}

interface Board {
  id: string;
  title: string;
  subtitle: string;
  metric: "wagered" | "wins" | "biggest_win" | "profit" | "high_roller";
  period: "daily" | "weekly" | "monthly";
  prizePool: number;
  startsAt: string;
  endsAt: string;
  totalPlayers: number;
  entries: Entry[];
  viewer: Entry | null;
}

interface FeedBet {
  id: string;
  gameId: string;
  gameName: string;
  username: string;
  avatarColor: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  currency: string;
  createdAt: string;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  prizePool: number;
  currency: string;
  leaderboardId: string;
  endsAt: string;
  playerRank: number | null;
  playerScore: number | null;
}

interface Tournament {
  id: string;
  name: string;
  game: string;
  prizePool: number;
  entryFee: number;
  startDate: string;
  endDate: string;
  status: string;
  participantsCount: number;
  maxParticipants: number;
  description: string;
  currency: string;
  leaderboard: Array<{ rank: number; username: string; wagered: number; wins: number; biggestWin: number }>;
}

interface Overview {
  generatedAt: string;
  refreshAfterMs: number;
  jackpot: number;
  promotions: Promotion[];
  boards: Board[];
  liveBets: FeedBet[];
  highRollerBets: FeedBet[];
  tournaments: Tournament[];
}

const EMPTY: Overview = {
  generatedAt: "", refreshAfterMs: 15_000, jackpot: 0,
  promotions: [], boards: [], liveBets: [], highRollerBets: [], tournaments: [],
};

const PLAYER_CARD_ART: Record<string, string> = {
  blackjack: "/games/originals/blackjack.jpg",
  poolrush: "/games/originals/poolrush.jpg",
  roulette: "/games/originals/roulette.jpg",
  slots: "/games/originals/slots.jpg",
  crash: "/games/originals/crash.jpg",
  dice: "/games/originals/dice.jpg",
  mines: "/games/originals/mines.jpg",
  wheel: "/games/originals/wheel.jpg",
  keno: "/games/originals/keno.jpg",
  limbo: "/games/originals/limbo.jpg",
  plinko: "/games/originals/plinko.jpg",
  coinflip: "/games/originals/coinflip.jpg",
  shoot: "/games/originals/shoot.jpg",
};
const PLAYER_CARD_FALLBACKS = Object.values(PLAYER_CARD_ART);
function playerCardArt(entry: Entry): string {
  if (entry.favoriteGame && PLAYER_CARD_ART[entry.favoriteGame]) return PLAYER_CARD_ART[entry.favoriteGame];
  const hash = [...entry.userId].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return PLAYER_CARD_FALLBACKS[hash % PLAYER_CARD_FALLBACKS.length];
}

const BOARD_ICON: Record<string, typeof Trophy> = {
  "weekly-race": Trophy,
  "daily-winners": Zap,
  "high-rollers": Crown,
  "biggest-wins": Flame,
  "monthly-profit": Target,
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function score(board: Board, entry: Entry): string {
  if (board.metric === "wins") return `${entry.wins} wins`;
  if (board.metric === "high_roller") return money(entry.biggestBet);
  if (board.metric === "biggest_win") return money(entry.biggestWin);
  if (board.metric === "profit") return `${entry.netProfit >= 0 ? "+" : ""}${money(entry.netProfit)}`;
  return money(entry.wagered);
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closing now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function LeaderboardHub({ onPlay }: { onPlay: () => void }) {
  const [data, setData] = useState<Overview>(EMPTY);
  const [activeBoard, setActiveBoard] = useState("weekly-race");
  const [feed, setFeed] = useState<"live" | "high">("live");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/leaderboards/overview", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not load leaderboards");
      setData(json.data);
      setActiveBoard((current) => json.data.boards.some((b: Board) => b.id === current) ? current : (json.data.boards[0]?.id ?? current));
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Could not load leaderboards");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the first stateful load into an async continuation; the effect body
    // itself only installs external subscriptions.
    void (async () => {
      await Promise.resolve();
      await load();
    })();
    const refresh = window.setInterval(() => void load(true), 15_000);
    const clock = window.setInterval(() => tick((value) => value + 1), 60_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [load]);

  const board = useMemo(
    () => data.boards.find((item) => item.id === activeBoard) ?? data.boards[0],
    [activeBoard, data.boards],
  );

  const joinTournament = async (id: string) => {
    setJoining(id);
    try {
      const response = await fetch(`/api/tournaments/${id}`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not join tournament");
      toast.success("Tournament joined — paid bets now update your score live");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join tournament");
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="leaderboard-hub space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/8 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-lime">
            <Activity className="h-3.5 w-3.5" /> Live competition
          </div>
          <h1 className="font-display text-2xl uppercase text-white sm:text-3xl">Player Leaderboards</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/48">Real paid bets power every ranking, promotion and tournament score. Practice rounds never count.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/7 bg-surface px-4 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Mega Drop</p>
            <p className="font-mono text-lg font-black text-lime">{money(data.jackpot)}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white/55 hover:text-lime" aria-label="Refresh leaderboards">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Promotions are links into the exact board that determines eligibility. */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-lime" />
          <h2 className="font-display text-sm uppercase text-white">Live promotions</h2>
        </div>
        <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {data.promotions.map((promotion) => {
            const active = promotion.leaderboardId === board?.id;
            return (
              <button key={promotion.id} type="button" onClick={() => setActiveBoard(promotion.leaderboardId)} className={`min-w-[250px] flex-1 rounded-2xl border p-4 text-left transition-colors sm:min-w-[290px] ${active ? "border-lime/45 bg-lime/10" : "border-white/7 bg-surface hover:border-white/15"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-white">{promotion.title}</p>
                    <p className="mt-1 text-[11px] text-white/40">{promotion.description}</p>
                  </div>
                  <span className="rounded-lg bg-lime px-2 py-1 font-mono text-xs font-black text-bg">{compact(promotion.prizePool)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-white/40"><CalendarClock className="h-3 w-3" /> {timeLeft(promotion.endsAt)}</span>
                  <span className={promotion.playerRank ? "font-bold text-lime" : "text-white/35"}>{promotion.playerRank ? `Your rank #${promotion.playerRank}` : "Play to rank"}</span>
                </div>
              </button>
            );
          })}
          {!loading && data.promotions.length === 0 && <Empty label="No leaderboard promotions are active." />}
        </div>
      </section>

      <section className="rounded-2xl border border-white/7 bg-surface/65 p-3 sm:p-5">
        <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Leaderboard selection">
          {data.boards.map((item) => {
            const Icon = BOARD_ICON[item.id] ?? Trophy;
            return (
              <button key={item.id} role="tab" aria-selected={item.id === board?.id} onClick={() => setActiveBoard(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${item.id === board?.id ? "border-lime/35 bg-lime/10 text-lime" : "border-white/7 text-white/45 hover:text-white"}`}>
                <Icon className="h-3.5 w-3.5" /> {item.title}
              </button>
            );
          })}
        </div>

        {board ? (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-lime">{board.period} competition</p>
                <h2 className="font-display text-xl uppercase text-white">{board.title}</h2>
                <p className="text-xs text-white/40">{board.subtitle} · {board.totalPlayers} ranked players</p>
              </div>
              <div className="flex gap-2">
                <Stat label="Prize pool" value={money(board.prizePool)} accent />
                <Stat label="Ends in" value={timeLeft(board.endsAt)} />
                {board.viewer && <Stat label="Your rank" value={`#${board.viewer.rank}`} accent />}
              </div>
            </div>

            <Podium board={board} />
            <RankingTable board={board} />
          </>
        ) : !loading ? <Empty label="No ranked paid bets in the current period." /> : <Loading />}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)]">
        <section className="overflow-hidden rounded-2xl border border-white/7 bg-surface/65">
          <div className="flex items-center justify-between border-b border-white/6 p-4">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-lime" /><h2 className="font-display text-sm uppercase text-white">Bet activity</h2></div>
            <div className="flex rounded-lg bg-white/4 p-1">
              <button onClick={() => setFeed("live")} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${feed === "live" ? "bg-lime text-bg" : "text-white/45"}`}>Live bets</button>
              <button onClick={() => setFeed("high")} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${feed === "high" ? "bg-lime text-bg" : "text-white/45"}`}>High rollers</button>
            </div>
          </div>
          <BetActivity bets={feed === "live" ? data.liveBets : data.highRollerBets} />
        </section>

        <section className="rounded-2xl border border-white/7 bg-surface/65 p-4">
          <div className="mb-4 flex items-center gap-2"><Medal className="h-4 w-4 text-lime" /><h2 className="font-display text-sm uppercase text-white">Tournaments</h2></div>
          <div className="space-y-3">
            {data.tournaments.map((tournament) => (
              <div key={tournament.id} className="rounded-xl border border-white/7 bg-white/[.025] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-bold text-white">{tournament.name}</p><p className="text-[11px] text-white/38">{tournament.game === "all" ? "All games" : tournament.game} · {tournament.participantsCount}{tournament.maxParticipants ? `/${tournament.maxParticipants}` : ""} players</p></div>
                  <span className="font-mono text-sm font-black text-lime">{money(tournament.prizePool)}</span>
                </div>
                {tournament.leaderboard.slice(0, 3).map((entry) => (
                  <div key={`${tournament.id}-${entry.rank}`} className="mt-2 flex items-center justify-between text-xs"><span className="text-white/55">#{entry.rank} {entry.username}</span><span className="font-mono text-white/75">{money(entry.wagered)}</span></div>
                ))}
                <button type="button" onClick={() => void joinTournament(tournament.id)} disabled={joining === tournament.id} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-lime/25 bg-lime/8 py-2 text-xs font-bold text-lime disabled:opacity-50">
                  {joining === tournament.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />} Join · {tournament.entryFee ? money(tournament.entryFee) : "Free"}
                </button>
              </div>
            ))}
            {!loading && data.tournaments.length === 0 && <Empty label="No active tournaments right now." compact />}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-lime/15 bg-lime/[.055] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-bold text-white">Every settled paid bet updates the rankings</p><p className="text-xs text-white/42">Choose an Original and climb the live promotion boards.</p></div>
        <button onClick={onPlay} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-black uppercase text-bg">Play Originals <ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="min-w-[88px] rounded-lg border border-white/7 bg-white/[.025] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wider text-white/30">{label}</p><p className={`mt-0.5 whitespace-nowrap font-mono text-xs font-black ${accent ? "text-lime" : "text-white/75"}`}>{value}</p></div>;
}

function Podium({ board }: { board: Board }) {
  const top = board.entries.slice(0, 3);
  if (!top.length) return <Empty label="No ranked paid bets in this period." />;
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;
  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-3 sm:items-end">
      {order.map((entry) => {
        const first = entry.rank === 1;
        return (
          <div key={entry.userId} className={`group relative isolate overflow-hidden rounded-xl border p-3 ${first ? "border-lime/40 sm:min-h-[148px]" : "border-white/10 sm:min-h-[132px]"}`}>
            <img src={playerCardArt(entry)} alt="" aria-hidden="true" className="pointer-events-none absolute inset-[-12px] -z-20 h-[calc(100%+24px)] w-[calc(100%+24px)] scale-110 object-cover opacity-35 blur-md saturate-125 transition duration-500 group-hover:scale-[1.16] group-hover:opacity-45" />
            <div className={`pointer-events-none absolute inset-0 -z-10 ${first ? "bg-[linear-gradient(135deg,rgba(5,10,14,.78),rgba(11,20,18,.70),rgba(205,243,43,.12))]" : "bg-[linear-gradient(135deg,rgba(5,9,14,.84),rgba(9,14,20,.72))]"}`} />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-transparent to-white/[.035]" />
            <span className="absolute right-3 top-2 text-xl drop-shadow-lg">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xs font-black text-bg shadow-lg" style={{ background: entry.avatarColor }}>{entry.username.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 pr-7"><p className="truncate text-sm font-bold text-white drop-shadow-md">{entry.username}</p><p className="text-[10px] text-white/55">Level {entry.level} · {entry.betCount} bets{entry.pushes ? ` · ${entry.pushes} pushes` : ""}</p></div>
            </div>
            <p className={`mt-4 font-mono text-xl font-black drop-shadow-lg ${first ? "text-lime" : "text-white"}`}>{score(board, entry)}</p>
            <div className="flex items-center justify-between gap-2 text-[10px] text-white/45"><span>{entry.winRate.toFixed(1)}% decisive win rate</span>{entry.favoriteGame && <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 capitalize text-white/55 backdrop-blur-sm">{entry.favoriteGame}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable({ board }: { board: Board }) {
  return (
    <div className="leaderboard-table overflow-x-auto rounded-xl border border-white/7">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="bg-white/[.035] text-[9px] font-black uppercase tracking-[.14em] text-white/32"><tr><th className="px-3 py-2.5">Rank</th><th className="px-3 py-2.5">Player</th><th className="px-3 py-2.5 text-right">Bets</th><th className="px-3 py-2.5 text-right">Win rate</th><th className="px-3 py-2.5 text-right">Biggest bet</th><th className="px-3 py-2.5 text-right">Score</th></tr></thead>
        <tbody>
          {board.entries.slice(3, 50).map((entry) => (
            <tr key={entry.userId} className="border-t border-white/5 text-white/62 hover:bg-white/[.025]"><td className="px-3 py-2.5 font-mono">#{entry.rank}</td><td className="px-3 py-2.5"><span className="inline-flex items-center gap-2"><i className="h-6 w-6 rounded-full" style={{ background: entry.avatarColor }} /><span className="font-semibold text-white">{entry.username}</span><small className="text-[9px] text-white/25">LVL {entry.level}</small></span></td><td className="px-3 py-2.5 text-right font-mono">{entry.betCount}</td><td className="px-3 py-2.5 text-right font-mono">{entry.winRate.toFixed(1)}%</td><td className="px-3 py-2.5 text-right font-mono">{money(entry.biggestBet)}</td><td className="px-3 py-2.5 text-right font-mono font-black text-lime">{score(board, entry)}</td></tr>
          ))}
        </tbody>
      </table>
      {board.entries.length <= 3 && <p className="px-4 py-5 text-center text-xs text-white/30">More players will appear after their first paid bet.</p>}
    </div>
  );
}

function BetActivity({ bets }: { bets: FeedBet[] }) {
  return (
    <div className="max-h-[430px] divide-y divide-white/5 overflow-y-auto">
      {bets.map((bet) => (
        <div key={bet.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><span className="h-7 w-7 shrink-0 rounded-full" style={{ background: bet.avatarColor }} /><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{bet.username}</p><p className="truncate text-[10px] text-white/32">{bet.gameName} · {new Date(bet.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div></div>
          <div className="text-right"><p className="font-mono text-xs font-bold text-white/75">{money(bet.amount)}</p><p className="text-[9px] text-white/28">stake</p></div>
          <div className="min-w-[66px] text-right"><p className={`font-mono text-xs font-black ${bet.result === "win" ? "text-lime" : "text-loss"}`}>{bet.multiplier > 0 ? `${bet.multiplier.toFixed(2)}×` : "—"}</p><p className="text-[9px] text-white/28">{bet.result}</p></div>
        </div>
      ))}
      {!bets.length && <Empty label="No paid bets yet." />}
    </div>
  );
}

function Loading() { return <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/35"><RefreshCw className="h-4 w-4 animate-spin" /> Updating rankings…</div>; }
function Empty({ label, compact: small }: { label: string; compact?: boolean }) { return <div className={`${small ? "py-5" : "py-10"} w-full text-center text-xs text-white/32`}>{label}</div>; }
