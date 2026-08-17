"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GameFrame, BetButton, BetPanel, StatRow } from "@/components/casino/GameFrame";
import { useBet } from "@/components/casino/useBet";
import { useGameSetting, useGameSettings, useSkipAnimation } from "@/lib/game-settings";
import {
  POOL_RUSH_CONFIG,
  POOL_RUSH_LEVELS,
  POOL_RUSH_RTP,
  POOL_RUSH_MAX_BET,
  POOL_RUSH_MIN_BET,
  poolRushHitFrequency,
  type PoolRushLevel,
} from "@/lib/pool-rush";
import type { OriginalId } from "@/lib/originals-registry";

interface Props {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

interface PoolPayload {
  level: PoolRushLevel;
  balls: number;
  shot: string;
}

type Phase = "idle" | "requesting" | "breaking" | "result";

const RACK = [
  [71, 50], [75, 46], [75, 54], [79, 42], [79, 50], [79, 58], [83, 38], [83, 46],
  [83, 54], [83, 62], [87, 34], [87, 42], [87, 50], [87, 58], [87, 66],
] as const;
const POCKETS = [[3, 5], [50, 4], [97, 5], [3, 95], [50, 96], [97, 95], [3, 5]] as const;
const BALL_COLORS = ["#f6d44a", "#2878e5", "#e64545", "#8d48cf", "#ee7d24", "#35a766", "#8c2530", "#17191f", "#f6d44a", "#2878e5", "#e64545", "#8d48cf", "#ee7d24", "#35a766", "#8c2530"];

export function PoolRushGame({ onBack, initialBalance, onPickGame }: Props) {
  const skipAnimation = useSkipAnimation();
  const { balance, busy, error, history, fairness, profit, betCount, place } = useBet<PoolPayload>("poolrush", initialBalance);
  const betAmount = useGameSettings((state) => state.stake);
  const setBetAmount = useGameSettings((state) => state.setStake);
  const [level, setLevel] = useGameSetting<PoolRushLevel>("poolrush", "risk", "intermediate", POOL_RUSH_LEVELS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [visualBalls, setVisualBalls] = useState(0);
  const [aim, setAim] = useState(0);
  const aiming = useRef(false);
  const [outcome, setOutcome] = useState<null | { balls: number; multiplier: number; payout: number; won: boolean; practice: boolean }>(null);
  const revealTimer = useRef<number | undefined>(undefined);

  const config = POOL_RUSH_CONFIG[level];
  const maxMultiplier = config.bands[config.bands.length - 1].multiplier;
  const hitFrequency = poolRushHitFrequency(level);
  const locked = phase === "requesting" || phase === "breaking" || busy;

  useEffect(() => () => {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
  }, []);

  const breakRack = useCallback(async () => {
    if (locked) return;
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    setOutcome(null);
    setVisualBalls(0);
    setPhase("requesting");
    setRound((value) => value + 1);

    const data = await place(betAmount, { level });
    if (!data) {
      setPhase("idle");
      return;
    }

    // The server result exists here, but no result copy is committed to the UI
    // until the table animation has completed.
    setVisualBalls(data.payload.balls);
    setPhase("breaking");
    const duration = skipAnimation ? 320 : config.animationMs;
    revealTimer.current = window.setTimeout(() => {
      setOutcome({
        balls: data.payload.balls,
        multiplier: data.multiplier,
        payout: data.payout,
        won: data.won,
        practice: Boolean(data.practice),
      });
      setPhase("result");
    }, duration);
  }, [betAmount, config.animationMs, level, locked, place, skipAnimation]);

  const payoutRows = useMemo(
    () => config.bands.map((band) => `${band.balls} balls  ${band.multiplier}×  ${(band.probability * 100).toFixed(band.probability < 0.01 ? 3 : 1)}%`).join("   ·   "),
    [config],
  );

  const updateAim = (element: HTMLDivElement, clientY: number) => {
    if (locked) return;
    const box = element.getBoundingClientRect();
    const relative = (clientY - (box.top + box.height / 2)) / box.height;
    setAim(Math.max(-8, Math.min(8, relative * 24)));
  };

  return (
    <GameFrame
      gameId="poolrush"
      title="Pool Rush"
      subtitle="Fast Break — choose the shot, then watch the table"
      onBack={onBack}
      onPickGame={onPickGame}
      profit={profit}
      betCount={betCount}
      history={history}
      fairness={fairness}
      rtp={POOL_RUSH_RTP}
      controls={
        <BetPanel amount={betAmount} setAmount={setBetAmount} balance={balance} disabled={locked} min={POOL_RUSH_MIN_BET} action={
          <BetButton
            onClick={breakRack}
            disabled={balance > 0 && (betAmount < POOL_RUSH_MIN_BET || betAmount > POOL_RUSH_MAX_BET || betAmount > balance)}
            busy={locked}
          >
            {phase === "requesting" ? "Preparing break…" : phase === "breaking" ? "Balls in motion…" : "BREAK"}
          </BetButton>
        }>
          <div className="pool-levels" role="radiogroup" aria-label="Break difficulty">
            {POOL_RUSH_LEVELS.map((id) => {
              const item = POOL_RUSH_CONFIG[id];
              const selected = level === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  data-active={selected || undefined}
                  onClick={() => setLevel(id)}
                  style={{ "--pool-accent": item.accent } as CSSProperties}
                >
                  <span className="pool-levels__dot" />
                  <span><strong>{item.label}</strong><small>{item.shot} · {item.power}%</small></span>
                  <b>{item.bands[item.bands.length - 1].multiplier}×</b>
                </button>
              );
            })}
          </div>
          <div>
            <StatRow label="Hit frequency" value={`${(hitFrequency * 100).toFixed(0)}%`} />
            <StatRow label="Maximum win" value={`${maxMultiplier}×`} tone="lime" />
            <StatRow label="Bet range" value={`${POOL_RUSH_MIN_BET.toFixed(2)}–${POOL_RUSH_MAX_BET} USDT`} />
            <StatRow label="RTP" value={`${(POOL_RUSH_RTP * 100).toFixed(2)}%`} />
          </div>
          <p className="pool-paytable font-mono">{payoutRows}</p>
          {error && <p className="tols-error">{error}</p>}
        </BetPanel>
      }
    >
      <div className="pool-rush" data-phase={phase} data-level={level}>
        <div className="pool-rush__hud">
          <div><span>SHOT</span><strong style={{ color: config.accent }}>{config.shot}</strong></div>
          <div className="pool-rush__power"><span>POWER</span><i><b style={{ width: `${config.power}%`, background: config.accent }} /></i></div>
          <div><span>MAX</span><strong>{maxMultiplier}×</strong></div>
        </div>

        <div
          className="pool-table"
          key={round}
          data-aimable={!locked || undefined}
          onPointerDown={(event) => {
            if (locked) return;
            aiming.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateAim(event.currentTarget, event.clientY);
          }}
          onPointerMove={(event) => {
            if (aiming.current) updateAim(event.currentTarget, event.clientY);
          }}
          onPointerUp={(event) => {
            aiming.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { aiming.current = false; }}
        >
          <div className="pool-table__rail" />
          {POCKETS.slice(0, 6).map(([x, y], index) => <i key={index} className="pool-pocket" style={{ left: `${x}%`, top: `${y}%` }} />)}
          <div
            className="pool-cue"
            style={{ "--cue-angle": `${aim + config.cueEffect}deg` } as CSSProperties}
          />
          <div className="pool-ball pool-ball--cue"><span /></div>
          {RACK.map(([x, y], index) => {
            const pocketed = index < visualBalls;
            const pocket = POCKETS[index % POCKETS.length];
            const scatterX = 18 + ((index * 29) % 68);
            const scatterY = 15 + ((index * 37) % 70);
            const style = {
              left: `${x}%`, top: `${y}%`,
              "--ball-color": BALL_COLORS[index],
              "--ball-delay": `${0.18 + index * 0.02}s`,
              "--ball-x": `${pocketed ? pocket[0] : scatterX}%`,
              "--ball-y": `${pocketed ? pocket[1] : scatterY}%`,
              "--ball-scale": pocketed ? 0.15 : 1,
            } as CSSProperties;
            return <div key={index} className="pool-ball" data-pocketed={pocketed || undefined} style={style}><span>{index + 1}</span></div>;
          })}
          <div className="pool-table__flash" />
        </div>

        <div className="pool-rush__result" aria-live="polite">
          {phase === "requesting" && <><RefreshGlyph /> Server is setting the rack…</>}
          {phase === "breaking" && <><RefreshGlyph /> Break in progress — result locked</>}
          {(phase === "idle") && <span>Drag on the table to aim · choose your break · press BREAK</span>}
          {phase === "result" && outcome && (
            <div data-win={outcome.won || undefined}>
              <strong>{outcome.balls} {outcome.balls === 1 ? "ball" : "balls"} pocketed</strong>
              <b>{outcome.multiplier > 0 ? `${outcome.multiplier}×` : "NO WIN"}</b>
              <span>{outcome.practice ? "Practice round · no payout" : outcome.won ? `Payout ${outcome.payout.toFixed(2)} USDT` : "Rack lost"}</span>
            </div>
          )}
        </div>
      </div>
    </GameFrame>
  );
}

function RefreshGlyph() {
  return <span className="pool-rush__spinner" aria-hidden="true" />;
}
