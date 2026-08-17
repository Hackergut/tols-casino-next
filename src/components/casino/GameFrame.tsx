"use client";

/*
 * GameFrame — the single shell every TOLS Original renders inside.
 *
 * The problem this solves: all 12 games hand-rolled their own layout. Some
 * wrapped in `space-y-4`, some `space-y-5`, some `space-y-6`, two used bespoke
 * wrappers, and slots/roulette shared nothing at all. Eight of the nine
 * components in the former game-shared.tsx (GameLayout, GameHeader, GameStats,
 * GameProvablyFair, GameHistory…) had zero call sites — the abstraction
 * existed, nobody adopted it, and the games drifted apart.
 *
 * Structure follows the Goated Originals framework:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ title · edge badge · live multiplier history │
 *   ├───────────────┬──────────────────────────────┤
 *   │ bet panel     │                              │
 *   │  mode tabs    │        game canvas           │
 *   │  amount       │                              │
 *   │  ½  2×        │                              │
 *   │  game inputs  │                              │
 *   │  [ BET ]      │                              │
 *   ├───────────────┴──────────────────────────────┤
 *   │ provably fair · RTP · seed                   │
 *   └──────────────────────────────────────────────┘
 *
 * Desktop puts controls left of the canvas so the bet button sits under the
 * player's hand near the mouse. Mobile stacks canvas-first, controls below —
 * the canvas is what you watch, the controls are what you reach for, and on a
 * phone the reachable zone is the bottom.
 *
 * Styling is TOLS: lime #cdf32b on the matte elevation ramp, tokens from
 * globals.css, motion from the design-engineering pass (strong ease-out,
 * transform/opacity only, sub-300ms).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Shield, ChevronDown, Check, Copy, Volume2, VolumeX, Zap } from "lucide-react";
import { HOUSE_EDGE } from "@/lib/game-math";
import { setSoundEnabled } from "@/lib/game-audio";
import { useGameSettings } from "@/lib/game-settings";
import { getOriginal, type OriginalId } from "@/lib/originals-registry";
import { GameInfoBlock, MoreOriginals, BetFeed } from "@/components/casino/GameInfo";
import { useLocale } from "@/lib/use-locale";

/* ─────────────────────────── Frame ─────────────────────────── */

export interface GameFrameProps {
  /** Registry id. Supplies the title, description, artwork and RTP. */
  gameId: OriginalId;
  /** Override the registry title only when a game needs to. */
  title?: string;
  subtitle?: string;
  onBack: () => void;
  /** Switch to a sibling Original from the rail below the canvas. */
  onPickGame?: (id: OriginalId) => void;
  /** Session profit/loss, shown in the header when enabled. */
  profit?: number;
  /** Bump after each settled bet so the feed picks it up. */
  betCount?: number;
  /** Left rail: bet amount, game-specific inputs, the action button. */
  controls: React.ReactNode;
  /** The game itself. */
  children: React.ReactNode;
  /** Recent multipliers, newest first — rendered in the header strip. */
  history?: number[];
  /** Provably-fair commitment for the footer. */
  fairness?: { serverSeedHash?: string; clientSeed?: string; nonce?: number } | null;
  /** Override when a game's edge is structural (roulette) or deeper (slots). */
  rtp?: number;
}

export function GameFrame({
  gameId,
  title,
  subtitle,
  onBack,
  onPickGame,
  profit,
  betCount,
  controls,
  children,
  history,
  fairness,
  rtp,
}: GameFrameProps) {
  const { t } = useLocale();
  const meta = getOriginal(gameId);
  const effectiveRtp = rtp ?? meta?.rtp ?? 1 - HOUSE_EDGE;
  const heading = title ?? meta?.name ?? gameId;
  const sub = subtitle ?? meta?.tagline;

  const soundEnabled = useGameSettings((s) => s.soundEnabled);
  const toggleSound = useGameSettings((s) => s.toggleSound);
  const quickPlay = useGameSettings((s) => s.quickPlay);
  const setQuickPlay = useGameSettings((s) => s.setQuickPlay);
  const showProfit = useGameSettings((s) => s.showProfit);

  // The header and the account Settings page share this persisted preference;
  // keep the Web Audio master gain in lockstep with it.
  useEffect(() => { setSoundEnabled(soundEnabled); }, [soundEnabled]);

  return (
    <div className="tols-game">
      <header className="tols-game__head">
        <button onClick={onBack} className="tols-game__back" aria-label={t("game.back")}>
          <ArrowLeft className="size-4" />
        </button>
        <div className="tols-game__title">
          <h1 className="font-display">{heading}</h1>
          {sub && <p>{sub}</p>}
        </div>

        {showProfit && typeof profit === "number" && profit !== 0 && (
          <span className="tols-game__pnl" data-up={profit > 0 || undefined}>
            {profit > 0 ? "+" : "−"}${Math.abs(profit).toFixed(2)}
          </span>
        )}

        <span className="tols-game__edge" title={`House edge ${((1 - effectiveRtp) * 100).toFixed(2)}%`}>
          RTP {(effectiveRtp * 100).toFixed(2)}%
        </span>

        {/* Settings that follow the player between games. */}
        <div className="tols-game__prefs">
          <button
            type="button"
            className="tols-game__pref"
            onClick={toggleSound}
            data-active={soundEnabled || undefined}
            aria-pressed={soundEnabled}
            title={soundEnabled ? t("game.soundOn") : t("game.soundOff")}
          >
            {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>
          <button
            type="button"
            className="tols-game__pref"
            onClick={() => setQuickPlay(!quickPlay)}
            data-active={quickPlay || undefined}
            aria-pressed={quickPlay}
            title={t("game.quickPlay")}
          >
            <Zap className="size-3.5" />
          </button>
        </div>

        {history && history.length > 0 && <HistoryStrip values={history} />}
      </header>

      <div className="tols-game__body">
        <aside className="tols-game__controls">{controls}</aside>
        <section className="tols-game__canvas">{children}</section>
      </div>

      <FairnessBar fairness={fairness} rtp={effectiveRtp} />

      {meta && (
        <div className="tols-game__below">
          <GameInfoBlock meta={meta} />
          {onPickGame && <MoreOriginals current={gameId} onPick={onPickGame} />}
          <BetFeed gameId={gameId} refreshKey={betCount} />
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Recent multipliers ───────────────────── */

/**
 * The row of recent results every crypto casino puts above the canvas. It is
 * the cheapest trust signal there is — visible proof the game is still
 * producing losses as well as wins.
 */
function HistoryStrip({ values }: { values: number[] }) {
  return (
    <div className="tols-game__history" aria-label="Recent results">
      {values.slice(0, 10).map((m, i) => (
        <span
          key={i}
          className="tols-chip"
          data-tone={m >= 2 ? "big" : m > 0 ? "win" : "loss"}
        >
          {m > 0 ? `${m.toFixed(2)}×` : "—"}
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────── Fairness ────────────────────────── */

function FairnessBar({
  fairness,
  rtp,
}: {
  fairness?: { serverSeedHash?: string; clientSeed?: string; nonce?: number } | null;
  rtp: number;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  return (
    <div className="tols-fair">
      <button
        className="tols-fair__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Shield className="size-3.5" />
        <span>{t("game.provablyFair")}</span>
        <span className="tols-fair__rtp">{(rtp * 100).toFixed(2)}% RTP</span>
        <ChevronDown
          className="size-3.5 tols-fair__chev"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="tols-fair__body">
          {fairness?.serverSeedHash ? (
            <>
              <SeedRow label="Server seed (hashed)" value={fairness.serverSeedHash} mono />
              <SeedRow label="Client seed" value={fairness.clientSeed ?? "—"} mono />
              <SeedRow label="Nonce" value={String(fairness.nonce ?? 0)} />
              <p className="tols-fair__note">
                The server seed was committed as this hash before your bet. Rotate your seed in
                account settings to reveal it and verify every result it produced.
              </p>
            </>
          ) : (
            <p className="tols-fair__note">{t("game.placeBet")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SeedRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }, [value]);

  return (
    <div className="tols-fair__row">
      <span className="tols-fair__label">{label}</span>
      <button className={`tols-fair__value ${mono ? "font-mono" : ""}`} onClick={copy} title="Copy">
        <span className="truncate">{value}</span>
        {copied ? <Check className="size-3 shrink-0 text-lime" /> : <Copy className="size-3 shrink-0 opacity-50" />}
      </button>
    </div>
  );
}

/* ─────────────────────── Bet amount panel ─────────────────────── */

/**
 * The bet control every game shares.
 *
 * Amounts are floats in currency units, not integers. The previous shared
 * control floored every input, which silently made any stake under 1.00
 * impossible and turned "½" into a rounding trap at low balances.
 */
export function BetPanel({
  amount,
  setAmount,
  balance,
  disabled,
  min = 0.1,
  children,
  action,
}: {
  amount: number;
  setAmount: (v: number) => void;
  balance: number;
  disabled?: boolean;
  min?: number;
  /** Game-specific inputs, rendered between the amount and the action button. */
  children?: React.ReactNode;
  action: React.ReactNode;
}) {
  const mode = useGameSettings((s) => s.mode);
  const setMode = useGameSettings((s) => s.setMode);

  const clamp = useCallback(
    (v: number) => {
      if (!Number.isFinite(v)) return min;
      return Math.max(0, Math.min(balance, Math.round(v * 100) / 100));
    },
    [balance, min],
  );

  return (
    <div className="tols-bet">
      {/* Mode tabs sit above the amount in every game, so the control the
          player reaches for first is always in the same place. */}
      <div className="tols-bet__modes" role="tablist" aria-label="Bet mode">
        {(["manual", "auto"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            data-active={mode === m || undefined}
            onClick={() => setMode(m)}
            disabled={disabled}
          >
            {m === "manual" ? "Manual" : "Auto"}
          </button>
        ))}
      </div>

      <label className="tols-bet__label" htmlFor="tols-bet-amount">
        {balance <= 0 ? "Practice play" : "Bet Amount"}
        <span className="tols-bet__balance">
          {balance <= 0 ? "No payout" : `$${balance.toFixed(2)}`}
        </span>
      </label>

      <div className="tols-bet__row">
        <input
          id="tols-bet-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          value={Number.isFinite(amount) ? amount : ""}
          disabled={disabled}
          onChange={(e) => setAmount(clamp(parseFloat(e.target.value)))}
          className="tols-bet__input font-mono"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAmount(clamp(Math.max(min, amount / 2)))}
          className="tols-bet__mult"
        >
          ½
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAmount(clamp(Math.max(min, amount * 2)))}
          className="tols-bet__mult"
        >
          2×
        </button>
      </div>

      <div className="tols-bet__chips">
        {[1, 5, 25, 100].map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled || v > balance}
            onClick={() => setAmount(clamp(v))}
            className="tols-bet__chip"
            data-active={Math.abs(amount - v) < 0.005 || undefined}
          >
            ${v}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || balance <= 0}
          onClick={() => setAmount(clamp(balance))}
          className="tols-bet__chip"
        >
          Max
        </button>
      </div>

      {children}

      <div className="tols-bet__action">{action}</div>
    </div>
  );
}

/* ─────────────────────── Action button ─────────────────────── */

export function BetButton({
  onClick,
  disabled,
  busy,
  children,
  tone = "primary",
  repeatable = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Keep instant games clickable while the serial bet queue is draining. */
  repeatable?: boolean;
  children: React.ReactNode;
  tone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || (busy && !repeatable)}
      aria-busy={busy || undefined}
      className="tols-btn"
      data-tone={tone}
      data-busy={busy || undefined}
    >
      {children}
    </button>
  );
}

/* ─────────────────── Small shared primitives ─────────────────── */

/** Label/value pair used for payout, win chance, profit-on-win. */
export function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "lime" | "muted";
}) {
  return (
    <div className="tols-stat">
      <span>{label}</span>
      <span data-tone={tone}>{value}</span>
    </div>
  );
}

/** Segmented control for risk / mode / rows — one look for all of them. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="tols-seg-wrap">
      {label && <span className="tols-seg-label">{label}</span>}
      <div className="tols-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            data-active={o.value === value || undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
