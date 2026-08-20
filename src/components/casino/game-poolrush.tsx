"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
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
  [310, 238], [292, 270], [328, 270], [274, 302], [310, 302], [346, 302],
  [256, 334], [292, 334], [328, 334], [364, 334], [238, 366], [274, 366],
  [310, 366], [346, 366], [382, 366],
] as const;
const POCKETS = [[28, 28], [592, 28], [20, 460], [600, 460], [28, 892], [592, 892]] as const;
const BALL_COLORS = ["#f5c542", "#2468d8", "#df3d45", "#7c42b5", "#e66f28", "#40b765", "#8f2631", "#11151b", "#f5c542", "#2468d8", "#df3d45", "#7c42b5", "#e66f28", "#40b765", "#8f2631"];
const RAIL_DIAMONDS_X = [132, 222, 398, 488] as const;
const RAIL_DIAMONDS_Y = [150, 300, 620, 770] as const;

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

  const updateAim = (element: HTMLDivElement, clientX: number) => {
    if (locked) return;
    const box = element.getBoundingClientRect();
    const relative = (clientX - (box.left + box.width / 2)) / box.width;
    setAim(Math.max(-9, Math.min(9, relative * 22)));
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
            updateAim(event.currentTarget, event.clientX);
          }}
          onPointerMove={(event) => {
            if (aiming.current) updateAim(event.currentTarget, event.clientX);
          }}
          onPointerUp={(event) => {
            aiming.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { aiming.current = false; }}
        >
          <PoolTableScene
            phase={phase}
            visualBalls={visualBalls}
            aim={aim + config.cueEffect}
            duration={skipAnimation ? 0.32 : config.animationMs / 1000}
            accent={config.accent}
          />
        </div>

        <div className="pool-rush__result" aria-live="polite">
          {phase === "requesting" && <><RefreshGlyph /> Server is setting the rack…</>}
          {phase === "breaking" && <><RefreshGlyph /> Break in progress — result locked</>}
          {(phase === "idle") && <span>Drag left or right to aim · choose your break · press BREAK</span>}
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

interface PoolTableSceneProps {
  phase: Phase;
  visualBalls: number;
  aim: number;
  duration: number;
  accent: string;
}

/**
 * Resolution-independent SVG table. Motion is transform-only, so the break
 * remains sharp on retina screens and does not trigger layout on every frame.
 */
function PoolTableScene({ phase, visualBalls, aim, duration, accent }: PoolTableSceneProps) {
  const breaking = phase === "breaking";
  const settled = breaking || phase === "result";
  const cinematic = duration >= 1;
  const travelDuration = cinematic ? duration - 1.15 : 0.18;

  return (
    <svg
      className="pool-table__scene"
      viewBox="0 0 620 920"
      role="img"
      aria-label="Vertical Pool Rush table with a racked set of balls"
      data-cinematic={cinematic || undefined}
      style={{ "--pool-cinema-duration": `${duration}s` } as CSSProperties}
    >
      <defs>
        <radialGradient id="pool-felt" cx="50%" cy="38%" r="76%">
          <stop offset="0" stopColor="#172839" />
          <stop offset="0.58" stopColor="#0d1b29" />
          <stop offset="1" stopColor="#050c14" />
        </radialGradient>
        <linearGradient id="pool-cushion" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d8ff38" />
          <stop offset="0.18" stopColor="#86b90c" />
          <stop offset="0.55" stopColor="#304a0a" />
          <stop offset="1" stopColor="#111c08" />
        </linearGradient>
        <linearGradient id="pool-cue-wood" x1="0" y1="1" x2="0" y2="0">
          <stop stopColor="#47210d" />
          <stop offset="0.3" stopColor="#8d542b" />
          <stop offset="0.72" stopColor="#e3b875" />
          <stop offset="0.91" stopColor="#f1dfbd" />
          <stop offset="0.92" stopColor="#35a0dd" />
          <stop offset="1" stopColor="#17618f" />
        </linearGradient>
        <radialGradient id="pool-ball-shine" cx="30%" cy="23%" r="74%">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".16" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".48" />
        </radialGradient>
        <filter id="pool-shadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#00160f" floodOpacity=".72" />
        </filter>
        <filter id="pool-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <pattern id="pool-cloth" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 1H9M1 0V9" stroke="#fff" strokeOpacity=".018" strokeWidth=".7" />
        </pattern>
      </defs>

      <rect width="620" height="920" rx="28" fill="url(#pool-felt)" />
      <rect width="620" height="920" rx="28" fill="url(#pool-cloth)" />
      <ellipse cx="310" cy="400" rx="265" ry="390" fill="#caff2c" opacity=".032" filter="url(#pool-glow)" />

      {/* Portrait cushions and lime tournament markings match the lobby art. */}
      <path d="M48 46L280 36L266 69L72 78Z M340 36L572 46L548 78L354 69Z" fill="url(#pool-cushion)" />
      <path d="M48 874L280 884L266 851L72 842Z M340 884L572 874L548 842L354 851Z" fill="url(#pool-cushion)" />
      <path d="M45 48L78 72V430L47 448Z M47 472L78 490V848L45 872Z" fill="url(#pool-cushion)" />
      <path d="M575 48L542 72V430L573 448Z M573 472L542 490V848L575 872Z" fill="url(#pool-cushion)" />
      <path d="M78 610H542" stroke="#caff2c" strokeOpacity=".11" strokeWidth="2" />
      <circle cx="310" cy="610" r="70" fill="none" stroke="#caff2c" strokeOpacity=".065" strokeWidth="2" />
      <circle cx="310" cy="238" r="3.5" fill="#dfff67" fillOpacity=".36" />

      {RAIL_DIAMONDS_X.map((x) => (
        <g key={x} fill="#d7ff38" opacity=".74">
          <path d={`M${x} 50l7 7-7 7-7-7z`} />
          <path d={`M${x} 870l7-7-7-7-7 7z`} />
        </g>
      ))}
      {RAIL_DIAMONDS_Y.map((y) => (
        <g key={y} fill="#d7ff38" opacity=".68">
          <path d={`M52 ${y}l7-7 7 7-7 7z`} />
          <path d={`M568 ${y}l-7-7-7 7 7 7z`} />
        </g>
      ))}

      {POCKETS.map(([x, y], index) => (
        <g key={index}>
          <circle cx={x} cy={y} r="28" fill="#01110d" stroke="#08251d" strokeWidth="8" />
          <ellipse cx={x} cy={y + 3} rx="17" ry="13" fill="#000" />
        </g>
      ))}

      {/* Cue approaches from below; the camera pushes in before contact. */}
      <g transform={`rotate(${aim} 310 690)`}>
        <motion.g
          initial={false}
          animate={{ y: settled ? [52, -92, -18] : 0, opacity: settled ? [1, 1, 0.42] : 1 }}
          transition={{ duration: Math.min(1.15, duration * 0.28), times: [0, 0.72, 1], ease: [0.45, 0, 0.2, 1] }}
        >
          <rect x="303" y="712" width="14" height="390" rx="7" fill="#000" opacity=".42" transform="translate(8 0)" />
          <rect x="304" y="712" width="12" height="390" rx="6" fill="url(#pool-cue-wood)" />
          <path d="M306 1080V744" stroke="#fff" strokeOpacity=".24" strokeWidth="2" strokeLinecap="round" />
        </motion.g>
      </g>
      <motion.g
        className="pool-svg-ball"
        initial={false}
        animate={{
          x: settled ? [0, 0, aim * -2.6, aim * 6] : 0,
          y: settled ? [0, 0, -448, -248] : 0,
          rotate: settled ? [0, 0, 520, 860] : 0,
        }}
        transition={{ duration: Math.min(1.7, duration * 0.43), times: [0, 0.34, 0.66, 1], ease: [0.2, 0.72, 0.25, 1] }}
      >
        <PoolBall x={310} y={690} index={-1} color="#f4f0da" />
      </motion.g>

      {RACK.map(([x, y], index) => {
        const pocketed = index < visualBalls;
        const [endX, endY] = pocketed
          ? POCKETS[index % POCKETS.length]
          : [88 + ((index * 197) % 445), 92 + ((index * 137) % 730)];
        const dx = endX - x;
        const dy = endY - y;
        const bend = ((index % 5) - 2) * 24;
        const delay = cinematic ? 0.82 + index * 0.018 : index * 0.003;

        return (
          <motion.g
            key={index}
            className="pool-svg-ball"
            initial={false}
            animate={{
              x: settled ? [0, bend, dx * 0.58 - bend, dx] : 0,
              y: settled ? [0, dy * 0.16, dy * 0.64, dy] : 0,
              rotate: settled ? [0, 120 + index * 17, 390 + index * 23, 680 + index * 31] : 0,
              scale: settled && pocketed ? [1, 1, 0.92, 0.12] : 1,
              opacity: settled && pocketed ? [1, 1, 1, 0] : 1,
            }}
            transition={{
              duration: travelDuration,
              delay: breaking ? delay : 0,
              times: [0, 0.22, 0.66, 1],
              ease: [0.16, 0.72, 0.25, 1],
            }}
            style={{ transformOrigin: `${x}px ${y}px` }}
          >
            <PoolBall x={x} y={y} index={index} color={BALL_COLORS[index]} />
          </motion.g>
        );
      })}

      <motion.g
        initial={false}
        animate={{ opacity: breaking ? [0, 0, 0.9, 0] : 0, scale: breaking ? [0.4, 0.4, 1.8, 2.6] : 0.4 }}
        transition={{ duration: cinematic ? 0.9 : 0.16, delay: breaking && cinematic ? 0.78 : 0, times: [0, 0.18, 0.52, 1], ease: "easeOut" }}
        style={{ transformOrigin: "310px 238px" }}
      >
        <circle cx="310" cy="238" r="34" fill="none" stroke={accent} strokeWidth="8" />
        <circle cx="310" cy="238" r="10" fill="#fff" filter="url(#pool-glow)" />
      </motion.g>
    </svg>
  );
}

function PoolBall({ x, y, index, color }: { x: number; y: number; index: number; color: string }) {
  const striped = index >= 8;
  return (
    <g filter="url(#pool-shadow)">
      <circle cx={x} cy={y} r="18" fill={color} />
      {striped && <path d={`M${x - 17} ${y - 7}Q${x} ${y - 13} ${x + 17} ${y - 7}V${y + 7}Q${x} ${y + 13} ${x - 17} ${y + 7}Z`} fill="#f3f1e8" />}
      <circle cx={x} cy={y} r="18" fill="url(#pool-ball-shine)" />
      {index >= 0 && (
        <>
          <circle cx={x} cy={y} r="7.2" fill="#f8f6ed" stroke="#d7d3c8" strokeWidth=".7" />
          <text x={x} y={y + 3.3} textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#11151a">{index + 1}</text>
        </>
      )}
    </g>
  );
}

function RefreshGlyph() {
  return <span className="pool-rush__spinner" aria-hidden="true" />;
}
