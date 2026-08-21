"use client";

/*
 * Everything that sits below the game canvas.
 *
 * The Originals framework puts three blocks under the fold, and all of them
 * are trust surfaces rather than decoration:
 *
 *   1. The info block — what the game is, and the house edge stated in plain
 *      numbers. Publishing the edge on the page is the single clearest signal
 *      a casino can give, and it is the thing regulators actually require.
 *   2. A rail of sibling Originals, so leaving a game does not mean going back
 *      to the lobby.
 *   3. The bet feed: My Bets / Latest Bets / High Rollers.
 *
 * Previously none of the games had any of this — the canvas ended and the page
 * stopped.
 */

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { OriginalMeta, OriginalId } from "@/lib/originals-registry";
import { otherOriginals } from "@/lib/originals-registry";
import { usePublicEvent } from "@/hooks/use-realtime";

/* ─────────────────────────── Info block ─────────────────────────── */

export function GameInfoBlock({ meta }: { meta: OriginalMeta }) {
  const edge = (1 - meta.rtp) * 100;
  return (
    <section className="tols-info">
      <h2 className="tols-info__title font-display">{meta.name}</h2>
      <div className="tols-info__crumbs">
        <span className="tols-info__crumb">TOLS Games</span>
        <ChevronRight className="size-3 opacity-40" />
        <span className="tols-info__crumb">TOLS Originals</span>
      </div>
      <p className="tols-info__body">{meta.description}</p>
      <dl className="tols-info__facts">
        <div>
          <dt>House edge</dt>
          {/* Two decimals: roulette's 2.70% is not 3%, and rounding the
              published edge is the kind of detail players check. */}
          <dd className="text-lime">{edge.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>RTP</dt>
          <dd>{(meta.rtp * 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Volatility</dt>
          <dd className="capitalize">{meta.volatility}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>TOLS Games</dd>
        </div>
      </dl>
    </section>
  );
}

/* ────────────────────── Sibling games rail ────────────────────── */

export function MoreOriginals({
  current,
  onPick,
}: {
  current: OriginalId;
  onPick: (id: OriginalId) => void;
}) {
  const siblings = otherOriginals(current);
  return (
    <section className="tols-more">
      <h3 className="tols-more__head">More from TOLS Originals</h3>
      <div className="tols-more__rail">
        {siblings.map((g) => (
          <button key={g.id} type="button" className="tols-more__card" onClick={() => onPick(g.id)}>
            <span
              className="tols-more__art"
              style={{ backgroundImage: `url(${g.image})` }}
              aria-hidden="true"
            />
            <span className="tols-more__name">{g.name}</span>
            <span className="tols-more__rtp">{(g.rtp * 100).toFixed(2)}%</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────── Bet feed ──────────────────────────── */

interface FeedBet {
  id: string;
  gameName: string;
  username: string;
  avatarColor: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  createdAt: string;
}

type Tab = "mine" | "latest" | "high";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mine", label: "My Bets" },
  { id: "latest", label: "Latest Bets" },
  { id: "high", label: "High Rollers" },
];

export function BetFeed({ gameId, refreshKey }: { gameId?: string; refreshKey?: number }) {
  const [tab, setTab] = useState<Tab>("latest");
  const [rows, setRows] = useState(10);
  const [bets, setBets] = useState<FeedBet[]>([]);
  const [loading, setLoading] = useState(true);

  // refreshKey bumps after each settled bet so your own wager appears without
  // a poll loop running behind every game.
  //
  // The request is aborted on cleanup: switching tabs quickly used to race,
  // and a slow first response could overwrite a newer one.
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      // Inside the async body, not synchronously in the effect: a sync
      // setState here forces a second render pass before the fetch even
      // starts.
      setLoading(true);
      try {
        const qs = new URLSearchParams({ tab, limit: String(rows) });
        if (gameId && tab !== "latest") qs.set("game", gameId);
        const res = await fetch(`/api/bets/feed?${qs}`, { signal: ac.signal });
        const json = await res.json();
        if (!ac.signal.aborted) setBets(json?.data?.bets ?? []);
      } catch {
        if (!ac.signal.aborted) setBets([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [tab, rows, gameId, refreshKey]);

  // Live rows: every settled bet on the platform arrives over the public SSE
  // stream. Only "Latest Bets" prepends live — "High Rollers" is an ordering
  // the server owns, and "My Bets" is already refreshed by refreshKey the
  // moment the player's own bet settles.
  usePublicEvent<FeedBet & { gameId?: string }>(
    "feed:bet",
    (b) => {
      if (!b?.id) return;
      setBets((prev) => (prev.some((x) => x.id === b.id) ? prev : [b, ...prev].slice(0, rows)));
    },
    tab === "latest",
  );

  return (
    <section className="tols-feed">
      <div className="tols-feed__head">
        <div className="tols-seg" role="tablist" aria-label="Bet feed">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-active={tab === t.id || undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="tols-feed__rows"
          value={rows}
          onChange={(e) => setRows(Number(e.target.value))}
          aria-label="Rows to show"
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="tols-feed__scroll">
        <table className="tols-feed__table">
          <thead>
            <tr>
              <th>User</th>
              <th>Game</th>
              <th className="num">Bet</th>
              <th className="num">Multiplier</th>
              <th className="num">Payout</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b) => (
              <tr key={b.id}>
                <td>
                  <span className="tols-feed__dot" style={{ background: b.avatarColor }} aria-hidden="true" />
                  {b.username}
                </td>
                <td>{b.gameName}</td>
                <td className="num font-mono">${b.amount.toFixed(2)}</td>
                <td className="num font-mono">{b.multiplier > 0 ? `${b.multiplier.toFixed(2)}×` : "—"}</td>
                <td className="num font-mono" data-win={b.result === "win" || undefined}>
                  {b.result === "win" ? `+$${b.payout.toFixed(2)}` : `-$${b.amount.toFixed(2)}`}
                </td>
              </tr>
            ))}
            {!loading && bets.length === 0 && (
              <tr>
                <td colSpan={5} className="tols-feed__empty">
                  {tab === "mine" ? "You have not placed a bet yet." : "No bets yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
