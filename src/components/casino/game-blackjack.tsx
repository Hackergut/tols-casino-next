"use client";

import { useCallback, useMemo, useState } from "react";
import { GameFrame, BetButton, BetPanel, StatRow } from "@/components/casino/GameFrame";
import { useGameSettings } from "@/lib/game-settings";
import { sfx } from "@/lib/game-audio";
import { BLACKJACK_MAX_BET, BLACKJACK_MIN_BET, BLACKJACK_RTP, type BlackjackAction, type BlackjackCard } from "@/lib/blackjack";
import type { OriginalId } from "@/lib/originals-registry";

interface Props { onBack: () => void; initialBalance: number; onPickGame?: (id: OriginalId) => void }
interface PublicHand { cards: BlackjackCard[]; bet: number; status: string; total: number }
interface HandState {
  hand_id: string; player_hands: PublicHand[]; active_hand: number; dealer_hand: Array<BlackjackCard | null>;
  dealer_total: number; bet: number; insurance: number; balance: number; phase: "player" | "settled";
  actions_available: BlackjackAction[]; cards_remaining: number; server_seed_hash: string; client_seed: string;
  nonce: number; payout: number; outcome: string | null;
}
const SUIT: Record<BlackjackCard["suit"], string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export function BlackjackGame({ onBack, initialBalance, onPickGame }: Props) {
  const amount = useGameSettings((s) => s.stake);
  const setAmount = useGameSettings((s) => s.setStake);
  const [balance, setBalance] = useState(initialBalance);
  const [game, setGame] = useState<HandState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const active = game?.phase === "player";

  const request = useCallback(async (url: string, body: object) => {
    setBusy(true); setError(null); sfx.bet();
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Blackjack request failed");
      const next = json.data as HandState;
      setGame(next); setBalance(next.balance);
      if (next.phase === "settled") {
        const totalStake = next.player_hands.reduce((sum, hand) => sum + hand.bet, 0) + next.insurance;
        const multiplier = totalStake > 0 ? next.payout / totalStake : 0;
        setHistory((values) => [multiplier, ...values].slice(0, 10));
        if (multiplier > 1) sfx.win();
        else sfx.lose();
      } else {
        sfx.reveal();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Blackjack request failed"); }
    finally { setBusy(false); }
  }, []);

  const deal = () => request("/api/blackjack/bet", { bet: amount });
  const act = (action: BlackjackAction) => game && request("/api/blackjack/action", { hand_id: game.hand_id, action });
  const actions = useMemo(() => new Set(game?.actions_available ?? []), [game?.actions_available]);
  const fairness = game ? { serverSeedHash: game.server_seed_hash, clientSeed: game.client_seed, nonce: game.nonce } : null;

  return (
    <GameFrame gameId="blackjack" onBack={onBack} onPickGame={onPickGame} history={history} fairness={fairness} rtp={BLACKJACK_RTP}
      controls={
        <BetPanel amount={amount} setAmount={setAmount} balance={balance} disabled={busy || active} min={BLACKJACK_MIN_BET}
          action={<BetButton onClick={deal} busy={busy} disabled={active || amount < BLACKJACK_MIN_BET || amount > BLACKJACK_MAX_BET || amount > balance}>{busy ? "Dealing…" : game?.phase === "settled" ? "NEW HAND" : "DEAL"}</BetButton>}>
          <div>
            <StatRow label="Rules" value="6 decks · S17" />
            <StatRow label="Blackjack" value="Pays 3:2" tone="lime" />
            <StatRow label="Bet range" value="0.10–500 USDT" />
            <StatRow label="Cards remaining" value={game ? String(game.cards_remaining) : "311 after burn"} />
          </div>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }>
      <div className="blackjack" data-phase={game?.phase ?? "ready"}>
        <div className="blackjack__felt-mark">TOLS <span>BLACKJACK 1V1</span></div>
        <HandArea label="Dealer" total={game?.dealer_total} cards={game?.dealer_hand ?? []} dealer />
        <div className="blackjack__rule">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17</div>
        <div className="blackjack__players">
          {(game?.player_hands ?? []).map((hand, index) => (
            <HandArea key={index} label={(game?.player_hands.length ?? 0) > 1 ? `Hand ${index + 1}` : "Player"} total={hand.total} cards={hand.cards} active={game?.phase === "player" && game.active_hand === index} bet={hand.bet} />
          ))}
          {!game && <HandArea label="Player" cards={[]} bet={amount} />}
        </div>
        <div className="blackjack__message" aria-live="polite">
          {!game ? "Place your bet and deal" : busy ? "Dealer is checking the shoe…" : game.phase === "settled" ? <><strong>{game.outcome ?? "Hand settled"}</strong><span>{game.payout > 0 ? `Returned ${game.payout.toFixed(2)} USDT` : "No payout"}</span></> : <><strong>Your move</strong><span>{game.insurance > 0 ? `Insurance ${game.insurance.toFixed(2)} USDT` : "Choose an action"}</span></>}
        </div>
        {active && (
          <div className="blackjack__actions">
            <button disabled={busy || !actions.has("hit")} onClick={() => act("hit")}>HIT</button>
            <button disabled={busy || !actions.has("stand")} onClick={() => act("stand")} data-primary>STAND</button>
            <button disabled={busy || !actions.has("double")} onClick={() => act("double")}>DOUBLE</button>
            <button disabled={busy || !actions.has("split")} onClick={() => act("split")}>SPLIT</button>
            {actions.has("insurance") && <button disabled={busy} onClick={() => act("insurance")} data-insurance>INSURANCE</button>}
          </div>
        )}
      </div>
    </GameFrame>
  );
}

function HandArea({ label, cards, total, dealer, active, bet }: { label: string; cards: Array<BlackjackCard | null>; total?: number; dealer?: boolean; active?: boolean; bet?: number }) {
  return (
    <section className="blackjack__hand" data-dealer={dealer || undefined} data-active={active || undefined}>
      <header><span>{label}</span>{typeof total === "number" && <b>{total}</b>}</header>
      <div className="blackjack__cards">
        {cards.length ? cards.map((card, index) => <PlayingCard key={`${card?.rank ?? "hidden"}-${index}`} card={card} index={index} />) : <div className="blackjack__card-slot" />}
      </div>
      {typeof bet === "number" && <div className="blackjack__chip"><i />{bet.toFixed(2)}</div>}
    </section>
  );
}

function PlayingCard({ card, index }: { card: BlackjackCard | null; index: number }) {
  if (!card) return <div className="playing-card playing-card--back" style={{ "--deal-index": index } as React.CSSProperties}><span>TOLS</span></div>;
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div className="playing-card" data-red={red || undefined} style={{ "--deal-index": index } as React.CSSProperties}>
      <span className="playing-card__corner"><b>{card.rank}</b><i>{SUIT[card.suit]}</i></span>
      <strong>{SUIT[card.suit]}</strong>
      <span className="playing-card__corner playing-card__corner--bottom"><b>{card.rank}</b><i>{SUIT[card.suit]}</i></span>
    </div>
  );
}
