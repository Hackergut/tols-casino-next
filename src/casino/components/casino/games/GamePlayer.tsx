"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionStore, useUIStore } from "@/lib/store";
import { useSound as useSoundHook } from "@/hooks/use-sound";
import { formatCurrency } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SCOPA_MARKETS,
  SCOPA_ODDS,
  cardLabel,
  type ScopaMarket,
  type ScopaEvent,
  type Card as ScopaCard,
} from "@/lib/scopa";
import {
  applyEventTo,
  emptyBoard,
  finalBoard,
  scopaCardKey,
  type ScopaBoard,
} from "@/lib/scopa-playback";
import { SicilianCard, SicilianCardBack } from "@/components/casino/scopa-card";
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  HandCoins,
  Bomb,
  Trophy,
  Swords,
  Layers,
  FastForward,
} from "lucide-react";

// ============== Theme ==============
const LIME = "var(--color-lime)";
const INK = "var(--color-bg)";
const RED = "var(--color-loss)";

// ============== Types ==============
interface BetResponse {
  betId?: string;
  game: string;
  amount: number;
  multiplier: number;
  payout: number;
  won: boolean;
  payload: Record<string, unknown>;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
  newBalance: number;
}

type Risk = "low" | "medium" | "high";

// ============== API ==============
async function placeBet(body: {
  game: string;
  amount: number;
  clientSeed?: string;
  payload: Record<string, unknown>;
}): Promise<BetResponse> {
  const res = await fetch("/api/bets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || data?.message || `Bet failed (${res.status})`);
  }
  return (data.data ?? data) as BetResponse;
}

function useBet() {
  const qc = useQueryClient();
  const setBalance = useSessionStore((s) => s.setBalance);
  const { play } = useSoundHook();
  return useMutation({
    mutationFn: placeBet,
    onSuccess: (data) => {
      setBalance(data.newBalance);
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["live-bets"] });
      qc.invalidateQueries({ queryKey: ["winners"] });
      // Play sound effects
      if (data.won) {
        if (data.multiplier >= 10) play("jackpot");
        else play("win");
      } else {
        play("lose");
      }
      // Trigger win celebration for big wins
      if (data.won && data.payout > 0 && data.multiplier >= 2) {
        useUIStore.getState().setLastWin({ payout: data.payout, multiplier: data.multiplier, game: data.game });
      }
      // Store last bet for provably-fair verification
      if (data.clientSeed && data.serverSeedHash && data.nonce !== undefined) {
        useUIStore.getState().setLastBet({
          clientSeed: data.clientSeed,
          serverSeedHash: data.serverSeedHash,
          nonce: data.nonce,
        });
      }
    },
    onError: (err: Error) => toast.error(err.message || "Bet failed"),
  });
}

// ============== Shared: Bet Panel ==============
interface BetPanelProps {
  amount: number;
  setAmount: (n: number) => void;
  clientSeed: string;
  setClientSeed: (s: string) => void;
  onBet: () => void;
  isPending: boolean;
  disabled?: boolean;
  betLabel?: string;
  children?: React.ReactNode;
}

function BetPanel({
  amount,
  setAmount,
  clientSeed,
  setClientSeed,
  onBet,
  isPending,
  disabled,
  betLabel = "Place Bet",
  children,
}: BetPanelProps) {
  const balance = useSessionStore((s) => s.balance);
  const currency = useSessionStore((s) => s.currency);

  const quick = (op: "half" | "double" | "max") => {
    if (op === "half") setAmount(Math.max(0.01, +(amount / 2).toFixed(2)));
    else if (op === "double") setAmount(+(amount * 2).toFixed(2));
    else setAmount(+balance.toFixed(2));
  };

  const insufficient = amount > balance || amount <= 0;

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-card/40 border border-border/50">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-wider">
          Balance
        </span>
        <span className="font-mono font-semibold" style={{ color: LIME }}>
          {formatCurrency(balance, currency)}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Bet Amount
        </Label>
        <div className="flex gap-1.5">
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, +e.target.value))}
            className="font-mono h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => quick("half")}
            className="h-9 px-2.5 font-mono"
          >
            ½
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => quick("double")}
            className="h-9 px-2.5 font-mono"
          >
            2×
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => quick("max")}
            className="h-9 px-2.5 font-mono text-[10px]"
          >
            Max
          </Button>
        </div>
      </div>

      {children}

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Client Seed (optional)
        </Label>
        <Input
          value={clientSeed}
          onChange={(e) => setClientSeed(e.target.value)}
          placeholder="random"
          className="font-mono text-xs h-9"
        />
      </div>

      <Button
        onClick={onBet}
        disabled={isPending || disabled || insufficient}
        className="w-full h-11 uppercase tracking-wider text-base font-bold hover:brightness-110 transition"
        style={{ background: LIME, color: INK }}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          betLabel
        )}
      </Button>
      {insufficient && amount > 0 && (
        <p className="text-[10px] text-red-400 text-center -mt-2">
          Insufficient balance
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent = true }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-2.5 rounded-md bg-background/40 border border-border/30">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono text-sm font-semibold"
        style={{ color: accent ? LIME : "white" }}
      >
        {value}
      </span>
    </div>
  );
}

function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 w-full">{children}</div>
  );
}

function GameArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 rounded-lg bg-card/40 border border-border/50 min-h-[460px]">
      {children}
    </div>
  );
}

// ============== DICE ==============
function DiceGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);

  const mutation = useBet();

  const winChance = isOver ? 100 - target : target;
  const multiplier = Math.max(1.01, 99 / winChance);
  const payout = amount * multiplier;

  const onBet = () => {
    setLastRoll(null);
    setLastWon(null);
    mutation.mutate(
      {
        game: "dice",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { target, isOver },
      },
      {
        onSuccess: (data) => {
          const roll = Number(
            (data.payload as { roll: number }).roll
          );
          setLastRoll(roll);
          setLastWon(data.won);
          if (data.won)
            toast.success(
              `Rolled ${roll.toFixed(2)} — Won ${formatCurrency(data.payout)}!`
            );
          else toast.error(`Rolled ${roll.toFixed(2)} — Lost.`);
        },
      }
    );
  };

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={onBet}
        isPending={mutation.isPending}
        betLabel="Roll Dice"
      />
      <GameArea>
        <div className="flex flex-col items-center justify-center py-6">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Roll Result
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={lastRoll ?? "idle"}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="font-mono text-6xl sm:text-7xl font-bold mt-2"
              style={{
                color:
                  lastWon === null ? "#6b7280" : lastWon ? LIME : RED,
                textShadow:
                  lastWon === true
                    ? `0 0 24px ${LIME}80`
                    : lastWon === false
                    ? `0 0 24px ${RED}80`
                    : "none",
              }}
            >
              {lastRoll !== null ? lastRoll.toFixed(2) : "—"}
            </motion.div>
          </AnimatePresence>
          {lastWon !== null && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs uppercase tracking-widest"
              style={{ color: lastWon ? LIME : RED }}
            >
              {lastWon ? "Win" : "Lose"}
            </motion.span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">
              Target
            </span>
            <span className="font-mono font-bold" style={{ color: LIME }}>
              {target.toFixed(2)}
            </span>
          </div>

          <div className="relative h-10 select-none">
            <div className="absolute inset-x-0 top-3 h-3 rounded-full overflow-hidden flex">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${target}%`,
                  background: isOver ? "#2a2f3d" : LIME,
                }}
              />
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${100 - target}%`,
                  background: isOver ? LIME : "#2a2f3d",
                }}
              />
            </div>
            <input
              type="range"
              min={2}
              max={98}
              step={0.01}
              value={target}
              onChange={(e) => setTarget(+e.target.value)}
              className="absolute inset-x-0 top-1.5 w-full h-6 opacity-0 cursor-pointer z-10"
              aria-label="Dice target"
            />
            <div
              className="absolute top-2 h-5 w-1.5 rounded-full bg-white shadow-lg pointer-events-none transition-all duration-150"
              style={{ left: `calc(${target}% - 3px)` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={!isOver ? "default" : "outline"}
              onClick={() => setIsOver(false)}
              className="h-9 uppercase tracking-wider text-xs"
              style={!isOver ? { background: LIME, color: INK } : {}}
            >
              <ChevronDown className="h-3.5 w-3.5" /> Roll Under
            </Button>
            <Button
              variant={isOver ? "default" : "outline"}
              onClick={() => setIsOver(true)}
              className="h-9 uppercase tracking-wider text-xs"
              style={isOver ? { background: LIME, color: INK } : {}}
            >
              <ChevronUp className="h-3.5 w-3.5" /> Roll Over
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-auto">
          <Stat label="Win Chance" value={`${winChance.toFixed(2)}%`} />
          <Stat label="Multiplier" value={`${multiplier.toFixed(4)}×`} />
          <Stat label="Payout" value={formatCurrency(payout)} />
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== CRASH ==============
function CrashGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [autoCashout, setAutoCashout] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "crashed" | "cashed">(
    "idle"
  );
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [history, setHistory] = useState<{ point: number; won: boolean }[]>([]);
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([]);

  const qc = useQueryClient();
  const setBalance = useSessionStore((s) => s.setBalance);
  const balance = useSessionStore((s) => s.balance);
  const mutation = useMutation({ mutationFn: placeBet });

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const clientCrashRef = useRef(1);
  const cashedRef = useRef(false);
  const autoRef = useRef(0);
  const amountRef = useRef(amount);
  const seedRef = useRef(clientSeed);
  const pathRef = useRef<{ x: number; y: number }[]>([]);
  const settleRef = useRef<(cashOutAt: number) => void>(() => {});
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);
  useEffect(() => {
    seedRef.current = clientSeed;
  }, [clientSeed]);
  useEffect(() => {
    autoRef.current = autoCashout;
  }, [autoCashout]);
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const genClientCrash = () => {
    const r = Math.random();
    if (r < 0.02) return 1.0;
    return Math.max(1.0, Math.floor((0.99 / (1 - r)) * 100) / 100);
  };

  // Keep settle/tick refs updated with latest closure (assignment in effect avoids
  // the "ref-during-render" lint rule while still giving rAF access to fresh state).
  useEffect(() => {
    settleRef.current = (cashOutAt: number) => {
      if (cashedRef.current) return;
      cashedRef.current = true;
      setCashedOut(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      mutation.mutate(
        {
          game: "crash",
          amount: amountRef.current,
          clientSeed: seedRef.current || undefined,
          payload: { cashOutAt },
        },
        {
          onSuccess: (data) => {
            setBalance(data.newBalance);
            qc.invalidateQueries({ queryKey: ["session"] });
            qc.invalidateQueries({ queryKey: ["live-bets"] });
            qc.invalidateQueries({ queryKey: ["winners"] });
            useUIStore.getState().setLastBet({
              clientSeed: data.clientSeed || "",
              serverSeedHash: data.serverSeedHash || "",
              nonce: data.nonce || 0,
            });
            if (data.won && data.payout > 0 && data.multiplier >= 2) {
              useUIStore.getState().setLastWin({ payout: data.payout, multiplier: data.multiplier, game: "crash" });
            }
            const serverCrash = Number(
              (data.payload as { crashPoint: number }).crashPoint
            );
            setCrashPoint(serverCrash);
            if (data.won) {
              setCashedAt(cashOutAt);
              setPhase("cashed");
              toast.success(
                `Cashed out @ ${cashOutAt.toFixed(2)}× — Won ${formatCurrency(
                  data.payout
                )}!`
              );
              setHistory((h) =>
                [{ point: serverCrash, won: true }, ...h].slice(0, 12)
              );
            } else {
              setPhase("crashed");
              setMultiplier(serverCrash);
              toast.error(`Crashed @ ${serverCrash.toFixed(2)}× — Lost.`);
              setHistory((h) =>
                [{ point: serverCrash, won: false }, ...h].slice(0, 12)
              );
            }
          },
          onError: (err: Error) => {
            toast.error(err.message || "Bet failed");
            setPhase("idle");
          },
        }
      );
    };
  }, [mutation, qc, setBalance]);

  useEffect(() => {
    tickRef.current = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.exp(0.12 * elapsed);
      const rounded = Math.floor(m * 100) / 100;

      if (
        !cashedRef.current &&
        autoRef.current > 1 &&
        rounded >= autoRef.current
      ) {
        settleRef.current(autoRef.current);
        return;
      }

      if (rounded >= clientCrashRef.current) {
        setMultiplier(clientCrashRef.current);
        settleRef.current(0);
        return;
      }

      setMultiplier(rounded);
      const x = Math.min(elapsed / 15, 1) * 380 + 10;
      const y = 290 - Math.min((rounded - 1) / 49, 1) * 270;
      pathRef.current = [...pathRef.current, { x, y }];
      setPathPoints(pathRef.current);

      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, []);

  const startRound = () => {
    if (amount > balance || amount <= 0) return;
    setBalance(balance - amount);
    setPhase("running");
    setMultiplier(1);
    setCrashPoint(null);
    setCashedAt(null);
    setCashedOut(false);
    pathRef.current = [{ x: 10, y: 290 }];
    setPathPoints(pathRef.current);
    cashedRef.current = false;
    clientCrashRef.current = genClientCrash();
    startTimeRef.current = Date.now();
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  };

  const cashOut = () => {
    if (phase !== "running" || cashedOut) return;
    settleRef.current(Math.floor(multiplier * 100) / 100);
  };

  const reset = () => {
    setPhase("idle");
    setMultiplier(1);
    setPathPoints([]);
    pathRef.current = [];
    setCrashPoint(null);
    setCashedAt(null);
    setCashedOut(false);
  };

  const pathD =
    pathPoints.length > 0
      ? pathPoints
          .map(
            (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          )
          .join(" ")
      : "";
  const areaD =
    pathPoints.length > 0
      ? `${pathD} L ${pathPoints[pathPoints.length - 1].x.toFixed(1)} 290 L 10 290 Z`
      : "";
  const currentPoint = pathPoints[pathPoints.length - 1] ?? { x: 10, y: 290 };

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={startRound}
        isPending={mutation.isPending}
        disabled={phase === "running"}
        betLabel={
          phase === "running"
            ? "Round Live"
            : phase === "idle"
            ? "Start Round"
            : "Round Over"
        }
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Auto Cashout (0 = off)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={autoCashout}
            onChange={(e) => setAutoCashout(Math.max(0, +e.target.value))}
            className="font-mono h-9"
            disabled={phase === "running"}
          />
        </div>
      </BetPanel>

      <GameArea>
        <div className="flex gap-1.5 flex-wrap min-h-[20px]">
          {history.length === 0 && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              No history yet
            </span>
          )}
          {history.map((h, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                color: h.won ? LIME : RED,
                background: h.won
                  ? "color-mix(in oklab, var(--color-lime) 10%, transparent)"
                  : "color-mix(in oklab, var(--color-loss) 10%, transparent)",
                border: `1px solid ${
                  h.won ? "color-mix(in oklab, var(--color-lime) 30%, transparent)" : "color-mix(in oklab, var(--color-loss) 30%, transparent)"
                }`,
              }}
            >
              {h.point.toFixed(2)}×
            </span>
          ))}
        </div>

        <div className="relative flex-1 flex items-center justify-center min-h-[280px]">
          <svg
            viewBox="0 0 400 300"
            className="w-full h-full max-h-[340px]"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="crashGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={LIME} stopOpacity="0" />
                <stop offset="100%" stopColor={LIME} stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {[1, 2, 3, 4].map((i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={i * 60}
                x2="400"
                y2={i * 60}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            ))}
            {[1, 2, 3, 4].map((i) => (
              <line
                key={`v${i}`}
                x1={i * 80}
                y1="0"
                x2={i * 80}
                y2="300"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            ))}
            {phase !== "idle" && areaD && (
              <path d={areaD} fill="url(#crashGrad)" />
            )}
            {phase !== "idle" && pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={phase === "crashed" ? RED : LIME}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: `drop-shadow(0 0 6px ${
                    phase === "crashed" ? RED : LIME
                  })`,
                }}
              />
            )}
          </svg>

          {phase !== "idle" && (
            <div
              className="absolute text-2xl pointer-events-none"
              style={{
                left: `${(currentPoint.x / 400) * 100}%`,
                top: `${(currentPoint.y / 300) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {phase === "crashed" ? "💥" : phase === "cashed" ? "💰" : "🚀"}
            </div>
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <motion.div
              key={phase + multiplier.toFixed(2)}
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="font-mono text-5xl sm:text-6xl font-bold"
              style={{
                color:
                  phase === "crashed"
                    ? RED
                    : phase === "cashed"
                    ? LIME
                    : "white",
                textShadow:
                  phase === "crashed"
                    ? `0 0 24px ${RED}`
                    : phase === "cashed"
                    ? `0 0 24px ${LIME}`
                    : "none",
              }}
            >
              {multiplier.toFixed(2)}×
            </motion.div>
            {phase === "idle" && (
              <span className="mt-2 text-xs text-muted-foreground uppercase tracking-wider">
                Place a bet to start
              </span>
            )}
            {phase === "crashed" && crashPoint !== null && (
              <span
                className="mt-2 text-xs uppercase tracking-wider"
                style={{ color: RED }}
              >
                Crashed @ {crashPoint.toFixed(2)}×
              </span>
            )}
            {phase === "cashed" && cashedAt !== null && (
              <span
                className="mt-2 text-xs uppercase tracking-wider"
                style={{ color: LIME }}
              >
                Cashed Out @ {cashedAt.toFixed(2)}×
              </span>
            )}
          </div>
        </div>

        {phase === "running" && (
          <Button
            onClick={cashOut}
            disabled={cashedOut || mutation.isPending}
            className="h-12 uppercase tracking-wider text-base font-bold hover:brightness-110"
            style={{ background: LIME, color: INK }}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Cash Out @ ${multiplier.toFixed(2)}×`
            )}
          </Button>
        )}
        {(phase === "crashed" || phase === "cashed") && (
          <Button
            onClick={reset}
            variant="outline"
            className="h-12 uppercase tracking-wider"
          >
            <RotateCcw className="h-4 w-4" /> New Round
          </Button>
        )}
      </GameArea>
    </GameShell>
  );
}

// ============== PLINKO ==============
const PLINKO_TABLES: Record<string, number[]> = {
  "16-low": [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  "16-medium": [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  "16-high": [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  "12-low": [10, 3, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 3, 10],
  "12-medium": [58, 15, 7, 3, 1.5, 1, 0.5, 1, 1.5, 3, 7, 15, 58],
  "12-high": [420, 70, 14, 5, 2, 1, 0.2, 1, 2, 5, 14, 70, 420],
  "8-low": [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
  "8-medium": [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
  "8-high": [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
};

function PlinkoGame() {
  const boardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState<8 | 12 | 16>(12);
  const [landedSlot, setLandedSlot] = useState<number | null>(null);
  const [ballPath, setBallPath] = useState<{ x: number; y: number }[]>([]);
  const [isDropping, setIsDropping] = useState(false);
  const [lastMult, setLastMult] = useState<number | null>(null);

  const mutation = useBet();

  const multipliers = useMemo(() => PLINKO_TABLES[`${rows}-${risk}`] ?? PLINKO_TABLES["12-medium"], [rows, risk]);

  const drop = () => {
    if (isDropping) return;
    setIsDropping(true);
    setLandedSlot(null);
    setLastMult(null);
    setBallPath([]);

    mutation.mutate(
      {
        game: "plinko",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { risk, rows },
      },
      {
        onSuccess: (data) => {
          const slot = Number((data.payload as { slot: number }).slot);
          setLandedSlot(slot);
          setLastMult(data.multiplier);

          // Build a path that ends at the server-determined slot
          let pos = 0;
          const path: { x: number; y: number }[] = [{ x: 50, y: 4 }];
          const slotWidthPct = 100 / (rows + 1);
          for (let i = 0; i < rows; i++) {
            const remainingRows = rows - i;
            const remainingRightsNeeded = slot - pos;
            const probRight = remainingRightsNeeded / remainingRows;
            const goRight = Math.random() < probRight;
            if (goRight) pos++;
            const x = 50 + (pos - (i + 1) / 2) * slotWidthPct;
            const y = 4 + ((i + 1) / rows) * 78;
            path.push({ x, y });
          }
          const slotX = slotWidthPct * (slot + 0.5);
          path.push({ x: slotX, y: 88 });
          setBallPath(path);

          window.setTimeout(() => {
            if (data.won) {
              toast.success(
                `Slot ${slot} — ${data.multiplier}× — Won ${formatCurrency(
                  data.payout
                )}!`
              );
            } else {
              toast.error(`Slot ${slot} — ${data.multiplier}×.`);
            }
            setIsDropping(false);
          }, 1500);
        },
        onError: () => {
          setIsDropping(false);
        },
      }
    );
  };

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={drop}
        isPending={mutation.isPending || isDropping}
        betLabel="Drop Ball"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Risk
            </Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["low", "medium", "high"] as Risk[]).map((r) => (
                <Button
                  key={r}
                  variant={risk === r ? "default" : "outline"}
                  onClick={() => setRisk(r)}
                  className="h-8 uppercase text-[10px]"
                  style={risk === r ? { background: LIME, color: INK } : {}}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Rows
            </Label>
            <div className="grid grid-cols-3 gap-1.5">
              {([8, 12, 16] as const).map((r) => (
                <Button
                  key={r}
                  variant={rows === r ? "default" : "outline"}
                  onClick={() => setRows(r)}
                  className="h-8 uppercase text-xs font-mono"
                  style={rows === r ? { background: LIME, color: INK } : {}}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </BetPanel>

      <GameArea>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Plinko Board
          </span>
          {lastMult !== null && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-bold"
              style={{ color: lastMult >= 1 ? LIME : RED }}
            >
              {lastMult}×
            </motion.span>
          )}
        </div>

        <div ref={boardRef} className="relative w-full max-w-md mx-auto aspect-[10/11] flex-1">
          {/* Pegs */}
          {Array.from({ length: rows }, (_, i) =>
            Array.from({ length: i + 1 }, (_, j) => {
              const slotWidthPct = 100 / (rows + 1);
              const x = 50 + (j - i / 2) * slotWidthPct;
              const y = 4 + ((i + 1) / rows) * 78;
              return (
                <div
                  key={`peg-${i}-${j}`}
                  className="absolute w-1 h-1 rounded-full bg-white/30"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })
          )}

          {/* Ball */}
          <AnimatePresence>
            {ballPath.length > 0 &&
              (() => {
                // Transform-only ball: map container-percent path points to pixel
                // x/y keyframes so the drop composites on the GPU instead of
                // re-laying-out via left/top every frame.
                const rect = boardRef.current?.getBoundingClientRect();
                const w = rect?.width ?? 400;
                const h = rect?.height ?? 440;
                const toPx = (p: { x: number; y: number }) => ({
                  x: (p.x / 100) * w - 6,
                  y: (p.y / 100) * h - 6,
                });
                const end = toPx(ballPath[ballPath.length - 1]);
                return (
                  <motion.div
                    key={ballPath.length + "-" + landedSlot}
                    className="absolute left-0 top-0 w-3 h-3 rounded-full z-10"
                    style={{
                      background: LIME,
                      boxShadow: `0 0 12px ${LIME}, 0 0 4px ${LIME}`,
                    }}
                    initial={reduced ? end : { x: 0.5 * w - 6, y: 0.04 * h - 6 }}
                    animate={
                      reduced
                        ? end
                        : {
                            x: ballPath.map((p) => toPx(p).x),
                            y: ballPath.map((p) => toPx(p).y),
                          }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            duration: 1.4,
                            times: ballPath.map((_, i) =>
                              i / Math.max(1, ballPath.length - 1)
                            ),
                            ease: "easeIn",
                          }
                    }
                  />
                );
              })()}
          </AnimatePresence>

          {/* Slots */}
          <div className="absolute inset-x-0 bottom-0 flex h-[12%] gap-0.5">
            {multipliers.map((m, i) => {
              const isLanded = landedSlot === i;
              const isPositive = m >= 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 flex items-center justify-center rounded-t-md text-[8px] sm:text-[10px] font-mono font-bold transition-all",
                    isLanded && "scale-y-110"
                  )}
                  style={{
                    background: isLanded
                      ? LIME
                      : isPositive
                      ? "color-mix(in oklab, var(--color-lime) 8%, transparent)"
                      : "color-mix(in oklab, var(--color-loss) 8%, transparent)",
                    color: isLanded
                      ? INK
                      : isPositive
                      ? LIME
                      : RED,
                    border: `1px solid ${
                      isLanded
                        ? LIME
                        : isPositive
                        ? "color-mix(in oklab, var(--color-lime) 20%, transparent)"
                        : "color-mix(in oklab, var(--color-loss) 20%, transparent)"
                    }`,
                    boxShadow: isLanded ? `0 0 16px ${LIME}` : "none",
                  }}
                >
                  {m}
                </div>
              );
            })}
          </div>
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== MINES ==============
const MINES_TILES = 25;

function minesMultiplier(picks: number, mines: number): number {
  let m = 1;
  for (let i = 0; i < picks; i++) {
    m *= (MINES_TILES - i) / (MINES_TILES - mines - i);
  }
  return Math.max(1, m * 0.99);
}

function MinesGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [minesCount, setMinesCount] = useState(3);
  const [status, setStatus] = useState<"idle" | "playing" | "lost" | "won">(
    "idle"
  );
  const [picks, setPicks] = useState<number[]>([]);
  const [clientLayout, setClientLayout] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [lastPayout, setLastPayout] = useState<number | null>(null);

  const qc = useQueryClient();
  const setBalance = useSessionStore((s) => s.setBalance);
  const balance = useSessionStore((s) => s.balance);
  const mutation = useMutation({ mutationFn: placeBet });

  const currentMult = picks.length > 0 ? minesMultiplier(picks.length, minesCount) : 1;
  const nextMult = minesMultiplier(picks.length + 1, minesCount);
  const currentPayout = amount * currentMult;
  const gemsTotal = MINES_TILES - minesCount;

  const startRound = () => {
    if (amount > balance || amount <= 0) return;
    setBalance(balance - amount);
    const layout = new Array(MINES_TILES).fill(false);
    const indices = Array.from({ length: MINES_TILES }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < minesCount; k++) layout[indices[k]] = true;
    setClientLayout(layout);
    setPicks([]);
    setRevealed([]);
    setLastPayout(null);
    setStatus("playing");
  };

  const settle = (finalPicks: number[]) => {
    mutation.mutate(
      {
        game: "mines",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { mines: minesCount, picks: finalPicks },
      },
      {
        onSuccess: (data) => {
          setBalance(data.newBalance);
          qc.invalidateQueries({ queryKey: ["session"] });
          qc.invalidateQueries({ queryKey: ["live-bets"] });
          qc.invalidateQueries({ queryKey: ["winners"] });
          useUIStore.getState().setLastBet({
            clientSeed: data.clientSeed || "",
            serverSeedHash: data.serverSeedHash || "",
            nonce: data.nonce || 0,
          });
          if (data.won && data.payout > 0 && data.multiplier >= 2) {
            useUIStore.getState().setLastWin({ payout: data.payout, multiplier: data.multiplier, game: "mines" });
          }
          setLastPayout(data.payout);
          if (data.won) {
            setStatus("won");
            toast.success(
              `Cashed out @ ${data.multiplier.toFixed(2)}× — Won ${formatCurrency(
                data.payout
              )}!`
            );
          } else {
            setStatus("lost");
            toast.error(`Mine hit — Lost.`);
          }
        },
        onError: (err: Error) => {
          toast.error(err.message || "Bet failed");
          setStatus("idle");
        },
      }
    );
  };

  const pickTile = (idx: number) => {
    if (status !== "playing" || picks.includes(idx) || revealed.includes(idx))
      return;
    const newRevealed = [...revealed, idx];
    setRevealed(newRevealed);
    if (clientLayout[idx]) {
      setStatus("lost");
      settle(picks);
    } else {
      const newPicks = [...picks, idx];
      setPicks(newPicks);
      if (newPicks.length === gemsTotal) {
        setStatus("won");
        settle(newPicks);
      }
    }
  };

  const cashOut = () => {
    if (status !== "playing" || picks.length === 0) return;
    setStatus("won");
    settle(picks);
  };

  const showAllMines = status === "lost" || status === "won";

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={startRound}
        isPending={mutation.isPending}
        disabled={status === "playing"}
        betLabel={status === "playing" ? "Round Live" : "Start Round"}
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Mines (1-24)
          </Label>
          <div className="flex gap-1.5">
            <Input
              type="number"
              min={1}
              max={24}
              value={minesCount}
              onChange={(e) =>
                setMinesCount(Math.max(1, Math.min(24, +e.target.value || 1)))
              }
              className="font-mono h-9"
              disabled={status === "playing"}
            />
            {[1, 3, 5, 10, 24].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMinesCount(n)}
                disabled={status === "playing"}
                className="h-9 px-2 font-mono text-xs"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      </BetPanel>

      <GameArea>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Gems Found"
            value={`${picks.length}/${gemsTotal}`}
          />
          <Stat
            label="Next Mult"
            value={`${nextMult.toFixed(2)}×`}
          />
          <Stat
            label="Payout"
            value={formatCurrency(currentPayout)}
          />
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mx-auto max-w-md w-full">
          {Array.from({ length: MINES_TILES }, (_, i) => {
            const isRevealed = revealed.includes(i);
            const isGem = isRevealed && !clientLayout[i];
            const isMineHit = isRevealed && clientLayout[i];
            const isMineShown =
              showAllMines && clientLayout[i] && !isRevealed;
            return (
              <button
                key={i}
                onClick={() => pickTile(i)}
                disabled={status !== "playing" || isRevealed}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center text-lg sm:text-xl transition-all",
                  isGem &&
                    "bg-lime/20 border border-lime/60",
                  isMineHit && "bg-red-500/30 border border-red-500",
                  isMineShown && "bg-red-500/15 border border-red-500/40",
                  !isRevealed &&
                    !isMineShown &&
                    "bg-background/60 border border-border/50 hover:border-lime/40 hover:bg-background/90 cursor-pointer"
                )}
                style={
                  isGem
                    ? { boxShadow: `0 0 10px ${LIME}55` }
                    : isMineHit
                    ? { boxShadow: `0 0 10px ${RED}55` }
                    : {}
                }
              >
                {isGem && "💎"}
                {(isMineHit || isMineShown) && "💣"}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mt-auto">
          {status === "playing" && (
            <Button
              onClick={cashOut}
              disabled={picks.length === 0 || mutation.isPending}
              className="flex-1 h-11 uppercase tracking-wider text-base font-bold hover:brightness-110"
              style={{ background: LIME, color: INK }}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <HandCoins className="h-4 w-4" />
                  Cash Out {formatCurrency(currentPayout)}
                </>
              )}
            </Button>
          )}
          {(status === "won" || status === "lost") && (
            <Button
              onClick={() => {
                setStatus("idle");
                setPicks([]);
                setRevealed([]);
                setClientLayout([]);
                setLastPayout(null);
              }}
              variant="outline"
              className="flex-1 h-11 uppercase tracking-wider"
            >
              <RotateCcw className="h-4 w-4" /> New Round
            </Button>
          )}
          {status === "idle" && (
            <div className="flex-1 h-11 flex items-center justify-center rounded-md border border-dashed border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Bomb className="h-3.5 w-3.5 mr-2" />
              Set mines & place bet to start
            </div>
          )}
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== LIMBO ==============
function LimboGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [target, setTarget] = useState(2);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);

  const mutation = useBet();

  const winChance = Math.min(99, (1 / target) * 99);
  const payout = amount * target;

  const onBet = () => {
    setLastRoll(null);
    setLastWon(null);
    mutation.mutate(
      {
        game: "limbo",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { target },
      },
      {
        onSuccess: (data) => {
          const roll = Number(
            (data.payload as { roll: number }).roll
          );
          setLastRoll(roll);
          setLastWon(data.won);
          if (data.won)
            toast.success(
              `Rolled ${roll.toFixed(2)}× — Won ${formatCurrency(
                data.payout
              )}!`
            );
          else toast.error(`Rolled ${roll.toFixed(2)}× — Lost.`);
        },
      }
    );
  };

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={onBet}
        isPending={mutation.isPending}
        betLabel="Roll Limbo"
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Target Multiplier (1.01 - 1000)
          </Label>
          <Input
            type="number"
            min={1.01}
            max={1000}
            step={0.01}
            value={target}
            onChange={(e) =>
              setTarget(Math.max(1.01, Math.min(1000, +e.target.value || 1.01)))
            }
            className="font-mono h-9"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {[1.5, 2, 5, 10].map((t) => (
              <Button
                key={t}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTarget(t)}
                className="h-8 font-mono text-xs"
              >
                {t}×
              </Button>
            ))}
          </div>
        </div>
      </BetPanel>

      <GameArea>
        <div className="flex flex-col items-center justify-center py-10 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Result Multiplier
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={lastRoll ?? "idle"}
              initial={{ scale: 0.5, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="font-mono text-6xl sm:text-7xl font-bold mt-2"
              style={{
                color:
                  lastWon === null ? "#6b7280" : lastWon ? LIME : RED,
                textShadow:
                  lastWon === true
                    ? `0 0 24px ${LIME}80`
                    : lastWon === false
                    ? `0 0 24px ${RED}80`
                    : "none",
              }}
            >
              {lastRoll !== null ? `${lastRoll.toFixed(2)}×` : "—"}
            </motion.div>
          </AnimatePresence>
          {lastWon !== null && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-xs uppercase tracking-widest"
              style={{ color: lastWon ? LIME : RED }}
            >
              {lastWon ? "Win" : "Lose"} · Target {target.toFixed(2)}×
            </motion.span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-auto">
          <Stat label="Win Chance" value={`${winChance.toFixed(2)}%`} />
          <Stat label="Target" value={`${target.toFixed(2)}×`} />
          <Stat label="Payout" value={formatCurrency(payout)} />
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== COINFLIP ==============
function CoinflipGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<"heads" | "tails" | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);

  const mutation = useBet();

  const flip = (sel: "heads" | "tails") => {
    if (flipping) return;
    setChoice(sel);
    setFlipping(true);
    setResult(null);
    setLastWon(null);
    mutation.mutate(
      {
        game: "coinflip",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { choice: sel },
      },
      {
        onSuccess: (data) => {
          const flipResult = (data.payload as { flip: "heads" | "tails" })
            .flip;
          setResult(flipResult);
          setLastWon(data.won);
          setFlipping(false);
          if (data.won)
            toast.success(
              `${flipResult.toUpperCase()} — Won ${formatCurrency(
                data.payout
              )}!`
            );
          else
            toast.error(
              `${flipResult.toUpperCase()} — Lost.`
            );
        },
        onError: () => setFlipping(false),
      }
    );
  };

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={() => flip(choice)}
        isPending={mutation.isPending || flipping}
        betLabel={`Flip ${choice}`}
      />

      <GameArea>
        <div className="flex flex-col items-center justify-center py-8 flex-1 gap-6">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {flipping ? "Flipping..." : "Pick a side"}
          </span>

          <motion.div
            className="relative"
            animate={{
              rotateY: flipping ? [0, 720, 1440, 2160] : 0,
              scale: flipping ? [1, 1.15, 1] : 1,
            }}
            transition={{
              duration: flipping ? 1.2 : 0.3,
              ease: "easeOut",
              times: flipping ? [0, 0.5, 1] : [0, 1],
            }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center font-bold text-2xl sm:text-3xl"
              style={{
                background:
                  result === "heads"
                    ? `radial-gradient(circle at 30% 30%, ${LIME}, #9bbb00)`
                    : result === "tails"
                    ? "radial-gradient(circle at 30% 30%, #ffffff, var(--color-muted-foreground))"
                    : "radial-gradient(circle at 30% 30%, #2a2f3d, #131720)",
                color: result === "tails" ? INK : result === "heads" ? INK : "#6b7280",
                boxShadow:
                  result !== null
                    ? `0 0 30px ${lastWon ? LIME : RED}80`
                    : "0 8px 24px rgba(0,0,0,0.4)",
                border: `2px solid ${
                  result === null
                    ? "rgba(255,255,255,0.1)"
                    : lastWon
                    ? LIME
                    : RED
                }`,
              }}
            >
              {flipping ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : result === "heads" ? (
                "H"
              ) : result === "tails" ? (
                "T"
              ) : (
                "?"
              )}
            </div>
          </motion.div>

          {lastWon !== null && result && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs uppercase tracking-widest"
              style={{ color: lastWon ? LIME : RED }}
            >
              {result} — {lastWon ? "Win" : "Lose"}
            </motion.span>
          )}

          <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
            <Button
              variant={choice === "heads" ? "default" : "outline"}
              onClick={() => flip("heads")}
              disabled={flipping || mutation.isPending}
              className="h-12 uppercase tracking-wider text-sm font-bold"
              style={choice === "heads" ? { background: LIME, color: INK } : {}}
            >
              Heads
            </Button>
            <Button
              variant={choice === "tails" ? "default" : "outline"}
              onClick={() => flip("tails")}
              disabled={flipping || mutation.isPending}
              className="h-12 uppercase tracking-wider text-sm font-bold"
              style={choice === "tails" ? { background: LIME, color: INK } : {}}
            >
              Tails
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Stat label="Multiplier" value="1.98×" />
          <Stat label="Payout" value={formatCurrency(amount * 1.98)} />
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== WHEEL ==============
const WHEEL_TABLES: Record<string, number[]> = {
  "20-low": [0, 0, 1.5, 0, 1.2, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 1.2, 0, 1.5, 0],
  "20-medium": [0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5],
  "20-high": [0, 0, 0, 0, 9.9, 0, 0, 0, 0, 0, 0, 0, 4.5, 0, 0, 0, 0, 0, 0, 2],
};

function WheelGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [risk, setRisk] = useState<Risk>("medium");
  const [segments] = useState(20);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultSeg, setResultSeg] = useState<number | null>(null);
  const [lastMult, setLastMult] = useState<number | null>(null);

  const mutation = useBet();

  const mults = useMemo(() => WHEEL_TABLES[`${segments}-${risk}`] ?? WHEEL_TABLES["20-medium"], [segments, risk]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResultSeg(null);
    setLastMult(null);
    mutation.mutate(
      {
        game: "wheel",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { segments, risk },
      },
      {
        onSuccess: (data) => {
          const seg = Number(
            (data.payload as { segment: number }).segment
          );
          setResultSeg(seg);
          setLastMult(data.multiplier);
          const segAngle = 360 / segments;
          // pointer is at top (0deg = up). segment i is centered at angle i*segAngle from top.
          // rotate wheel so segment seg lands at top.
          const spins = 5;
          const targetAngle =
            360 * spins + (360 - seg * segAngle - segAngle / 2);
          setRotation(targetAngle);
          window.setTimeout(() => {
            setSpinning(false);
            if (data.won) {
              toast.success(
                `Segment ${seg} — ${data.multiplier}× — Won ${formatCurrency(
                  data.payout
                )}!`
              );
            } else {
              toast.error(`Segment ${seg} — No win.`);
            }
          }, 4200);
        },
        onError: () => setSpinning(false),
      }
    );
  };

  const segAngle = 360 / segments;

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={spin}
        isPending={mutation.isPending || spinning}
        betLabel="Spin Wheel"
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Risk
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["low", "medium", "high"] as Risk[]).map((r) => (
              <Button
                key={r}
                variant={risk === r ? "default" : "outline"}
                onClick={() => setRisk(r)}
                disabled={spinning}
                className="h-8 uppercase text-[10px]"
                style={risk === r ? { background: LIME, color: INK } : {}}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      </BetPanel>

      <GameArea>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Wheel · {segments} segments
          </span>
          {lastMult !== null && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-bold"
              style={{ color: lastMult > 0 ? LIME : RED }}
            >
              {lastMult}×
            </motion.span>
          )}
        </div>

        <div className="relative w-full max-w-sm mx-auto aspect-square flex-1 flex items-center justify-center">
          {/* Pointer */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-20"
            style={{
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: `16px solid ${LIME}`,
              filter: `drop-shadow(0 0 6px ${LIME})`,
            }}
          />

          <motion.div
            animate={{ rotate: rotation }}
            transition={{
              duration: spinning ? 4 : 0,
              ease: "easeOut",
            }}
            className="w-full h-full relative"
          >
            <svg
              viewBox="-110 -110 220 220"
              className="w-full h-full"
              style={{
                filter: "drop-shadow(0 0 16px color-mix(in oklab, var(--color-lime) 15%, transparent))",
              }}
            >
              {mults.map((m, i) => {
                const startA = i * segAngle - 90 - segAngle / 2;
                const endA = startA + segAngle;
                const toRad = (a: number) => (a * Math.PI) / 180;
                const r = 100;
                const x1 = r * Math.cos(toRad(startA));
                const y1 = r * Math.sin(toRad(startA));
                const x2 = r * Math.cos(toRad(endA));
                const y2 = r * Math.sin(toRad(endA));
                const largeArc = segAngle > 180 ? 1 : 0;
                const isWin = m > 0;
                const isResult = resultSeg === i;
                const fill = isWin
                  ? isResult
                    ? LIME
                    : "color-mix(in oklab, var(--color-lime) 35%, transparent)"
                  : isResult
                  ? RED
                  : "rgba(40,45,55,0.7)";
                // label position
                const midA = startA + segAngle / 2;
                const lr = 70;
                const lx = lr * Math.cos(toRad(midA));
                const ly = lr * Math.sin(toRad(midA));
                return (
                  <g key={i}>
                    <path
                      d={`M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                      fill={fill}
                      stroke="var(--color-bg)"
                      strokeWidth="1.5"
                    />
                    <text
                      x={lx}
                      y={ly}
                      fill={isWin ? INK : "var(--color-muted-foreground)"}
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${midA + 90}, ${lx}, ${ly})`}
                    >
                      {m > 0 ? `${m}×` : "—"}
                    </text>
                  </g>
                );
              })}
              <circle cx="0" cy="0" r="14" fill={INK} stroke={LIME} strokeWidth="2" />
            </svg>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Stat label="Win Segments" value={`${mults.filter((m) => m > 0).length}/${segments}`} />
          <Stat label="Max Mult" value={`${Math.max(...mults)}×`} />
        </div>
      </GameArea>
    </GameShell>
  );
}

// ============== SCOPA SICILIANA ==============
interface ScopaPayload {
  market: ScopaMarket;
  odds: number;
  outcome: "player" | "bank" | "draw";
  timeline: ScopaEvent[];
  playerCardsCount: number;
  bankCardsCount: number;
  playerPoints: number;
  bankPoints: number;
  totalPoints: number;
  playerScopa: number;
  bankScopa: number;
  playerSettebello: boolean;
  bankSettebello: boolean;
  playerDenari: number;
  bankDenari: number;
  playerPrimiera: number;
  bankPrimiera: number;
}

type ScopaPhase = "idle" | "dealing" | "playing" | "scoring" | "done";

function ScopaCardChip({
  card,
  size,
  layoutId,
  style,
}: {
  card: ScopaCard;
  size: "sm" | "md" | "lg";
  layoutId: string;
  style?: React.CSSProperties;
}) {
  const w = size === "sm" ? "w-8 h-11" : size === "md" ? "w-10 h-14" : "w-12 h-16";
  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, scale: 0.5, y: -14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        layout: { type: "spring", stiffness: 480, damping: 40, mass: 0.75 },
        opacity: { duration: 0.16 },
        scale: { duration: 0.16 },
        y: { duration: 0.16 },
      }}
      className={cn("rounded-md shadow-lg flex-shrink-0 overflow-hidden", w)}
      style={style}
      title={cardLabel(card)}
    >
      <SicilianCard card={card} />
    </motion.div>
  );
}

function ScopaGame() {
  const [amount, setAmount] = useState(1);
  const [clientSeed, setClientSeed] = useState("");
  const [market, setMarket] = useState<ScopaMarket>("player");
  const [round, setRound] = useState<ScopaPayload | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [board, setBoard] = useState<ScopaBoard>(emptyBoard());
  const [phase, setPhase] = useState<ScopaPhase>("idle");
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState<{ id: number; kind: "scopa" | "sweep" } | null>(null);
  const [lastActor, setLastActor] = useState<0 | 1 | null>(null);

  const reduced = useReducedMotion();
  const cancelRef = useRef<{ done: boolean }>({ done: false });
  const timersRef = useRef<number[]>([]);

  const mutation = useBet();

  const odds = SCOPA_ODDS[market] ?? 2;
  const selectedLabel = SCOPA_MARKETS.find((m) => m.id === market)?.label ?? market;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Scheduling only — state resets happen in `onBet`, steps fire from timers.
  useEffect(() => {
    if (!round || reduced) return;
    const timeline = round.timeline;
    const cancel = { done: false };
    cancelRef.current = cancel;
    clearTimers();
    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(window.setTimeout(() => { if (!cancel.done) fn(); }, ms));
    };
    let i = 0;
    const run = () => {
      if (cancel.done) return;
      if (i >= timeline.length) {
        setPhase("scoring");
        for (let s = 1; s <= 5; s++) at(s * 130, () => setRevealed(s));
        at(5 * 130 + 160, () => setPhase("done"));
        return;
      }
      const ev = timeline[i++];
      setBoard((b) => applyEventTo(ev, b));
      if (ev.kind === "move") {
        setLastActor(ev.player);
        if (ev.scopa) setFlash({ id: Date.now() + i, kind: "scopa" });
        else if (ev.sweep) setFlash({ id: Date.now() + i, kind: "sweep" });
      }
      at(ev.kind === "deal" ? 70 : 175, run);
    };
    at(180, run);
    return () => {
      cancel.done = true;
      clearTimers();
    };
  }, [round, reduced, clearTimers]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  const skip = useCallback(() => {
    if (!round) return;
    cancelRef.current.done = true;
    clearTimers();
    setBoard(finalBoard(round.timeline));
    setRevealed(5);
    setFlash(null);
    setPhase("done");
  }, [round, clearTimers]);

  const onBet = () => {
    setRound(null);
    setLastWon(null);
    setFlash(null);
    setLastActor(null);
    mutation.mutate(
      {
        game: "scopa",
        amount,
        clientSeed: clientSeed || undefined,
        payload: { market },
      },
      {
        onSuccess: (data) => {
          const payload = data.payload as unknown as ScopaPayload;
          if (reduced) {
            setBoard(finalBoard(payload.timeline));
            setRevealed(5);
            setPhase("done");
          } else {
            setBoard(emptyBoard());
            setRevealed(0);
            setPhase("dealing");
          }
          setRound(payload);
          setLastWon(data.won);
          if (data.won)
            toast.success(`${selectedLabel} — Won ${formatCurrency(data.payout)}!`);
          else toast.error(`${selectedLabel} — Lost.`);
        },
      }
    );
  };

  const busy = mutation.isPending || (phase !== "idle" && phase !== "done");
  const remaining = round
    ? 40 - (board.hands[0].length + board.hands[1].length + board.table.length + board.piles[0].length + board.piles[1].length)
    : 40;
  const done = phase === "done";

  const cells = round
    ? [
        { label: "Carte", g: round.playerCardsCount, b: round.bankCardsCount, text: (v: number) => String(v) },
        { label: "Denari", g: round.playerDenari, b: round.bankDenari, text: (v: number) => String(v) },
        { label: "Settebello", g: round.playerSettebello ? 1 : 0, b: round.bankSettebello ? 1 : 0, text: (v: number) => (v ? "✓" : "—") },
        { label: "Primiera", g: round.playerPrimiera, b: round.bankPrimiera, text: (v: number) => String(v) },
        { label: "Scope", g: round.playerScopa, b: round.bankScopa, text: (v: number) => String(v) },
      ]
    : [];

  const scoreSide = (side: 0 | 1) =>
    round
      ? {
          name: side === 0 ? "Giocatore" : "Banco",
          points: side === 0 ? round.playerPoints : round.bankPoints,
          winner: side === 0 ? round.outcome === "player" : round.outcome === "bank",
          cells: cells.map((c) => ({
            label: c.label,
            value: c.text(side === 0 ? c.g : c.b),
            win: side === 0 ? c.g > c.b : c.b > c.g,
          })),
        }
      : null;

  return (
    <GameShell>
      <BetPanel
        amount={amount}
        setAmount={setAmount}
        clientSeed={clientSeed}
        setClientSeed={setClientSeed}
        onBet={onBet}
        isPending={mutation.isPending}
        betLabel={`Bet ${selectedLabel} @ ${odds.toFixed(2)}×`}
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Market · Esito 1X2
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["player", "bank", "draw"] as ScopaMarket[]).map((m) => (
              <Button
                key={m}
                variant={market === m ? "default" : "outline"}
                onClick={() => setMarket(m)}
                disabled={busy}
                className="h-8 uppercase text-[10px] px-1"
                style={market === m ? { background: LIME, color: INK } : {}}
              >
                {SCOPA_MARKETS.find((x) => x.id === m)?.label}
              </Button>
            ))}
          </div>

          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Totale punti
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(["over", "under"] as ScopaMarket[]).map((m) => (
              <Button
                key={m}
                variant={market === m ? "default" : "outline"}
                onClick={() => setMarket(m)}
                disabled={busy}
                className="h-8 uppercase text-[10px] px-1"
                style={market === m ? { background: LIME, color: INK } : {}}
              >
                {SCOPA_MARKETS.find((x) => x.id === m)?.label}
              </Button>
            ))}
          </div>

          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Settebello · Scopa
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["settebello_player", "settebello_bank", "scopa_over"] as ScopaMarket[]).map((m) => (
              <Button
                key={m}
                variant={market === m ? "default" : "outline"}
                onClick={() => setMarket(m)}
                disabled={busy}
                className="h-8 uppercase text-[9px] leading-tight px-1"
                style={market === m ? { background: LIME, color: INK } : {}}
              >
                {SCOPA_MARKETS.find((x) => x.id === m)?.label}
              </Button>
            ))}
          </div>
        </div>
      </BetPanel>

      <GameArea>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Scopa Siciliana · Fast Bet
          </span>
          {round && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-bold"
              style={{ color: lastWon ? LIME : RED }}
            >
              {round.outcome === "draw" ? "X" : round.outcome === "player" ? "1 · Giocatore" : "2 · Banco"} ·{" "}
              {lastWon ? `${round.odds.toFixed(2)}×` : "perso"}
            </motion.span>
          )}
        </div>

        {!round ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <Swords className="h-10 w-10 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Due mani virtuali (Giocatore e Banco) giocano una partita automatica di Scopa
              Siciliana con strategia fissa e pubblica. Scegli un mercato e piazza la scommessa:
              l'esito è provably fair e verificabile con i seed.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Stat label="Carte" value="40 siciliane" />
              <Stat label="RTP" value="96% target" />
              <Stat label="Odds" value={`${odds.toFixed(2)}×`} />
            </div>
          </div>
        ) : (
          <>
            {/* Felt table */}
            <div
              className="relative flex-1 flex flex-col gap-2 rounded-lg border overflow-hidden p-2.5 min-h-[300px]"
              style={{
                background: "radial-gradient(140% 120% at 50% -10%, #14351f 0%, #0c2416 55%, #07160d 100%)",
                borderColor: done ? (lastWon ? "color-mix(in oklab, var(--color-lime) 40%, transparent)" : "rgba(255,59,59,0.3)") : "var(--color-border)",
              }}
            >
              <div className="absolute top-1.5 right-1.5 z-[6] flex items-center gap-1.5 rounded border border-border/30 bg-black/40 pl-0.5 pr-2 py-0.5 font-mono text-[10px] text-white/60">
                <span className="relative h-6 w-[1.05rem]">
                  <SicilianCardBack />
                </span>
                <span className="font-bold">× {remaining}</span>
              </div>
              {busy && !reduced && (
                <button
                  onClick={skip}
                  className="absolute top-1.5 left-1.5 z-[6] flex items-center gap-1 rounded border border-border/30 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white/70 hover:bg-black/60 hover:text-white"
                >
                  <FastForward className="h-3 w-3" /> Salta
                </button>
              )}

              {/* hands + table + piles */}
              {([0, 1] as const).map((side) => (
                <div key={`hand-${side}`} className={cn("relative flex items-center justify-center gap-1.5 min-h-[52px]", lastActor === side && busy && "opacity-100")}>
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-white/35">
                    {side === 0 ? "Giocatore" : "Banco"}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {board.hands[side].map((c) => (
                      <ScopaCardChip key={scopaCardKey(c)} card={c} size="sm" layoutId={`admin-scopa-${scopaCardKey(c)}`} />
                    ))}
                  </div>
                </div>
              ))}

              <div className="relative flex-1 flex items-center justify-center gap-6 min-h-[120px]">
                {([0, 1] as const).map((side) => (
                  <div key={`pile-${side}`} className="relative w-8 h-11 flex items-end justify-center">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-white/35 whitespace-nowrap">
                      {side === 0 ? "G" : "B"}
                    </span>
                    <div className="relative w-8 h-11">
                      {board.piles[side].map((c, i) => (
                        <ScopaCardChip
                          key={scopaCardKey(c)}
                          card={c}
                          size="sm"
                          layoutId={`admin-scopa-${scopaCardKey(c)}`}
                          style={{ position: "absolute", top: `${Math.min(i, 14) * 0.1}rem`, left: 0, zIndex: i }}
                        />
                      ))}
                    </div>
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] text-white/50">
                      {board.piles[side].length}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[60%]">
                  {board.table.map((c) => (
                    <ScopaCardChip key={scopaCardKey(c)} card={c} size="md" layoutId={`admin-scopa-${scopaCardKey(c)}`} />
                  ))}
                </div>
              </div>

              {/* flash */}
              <AnimatePresence>
                {flash && !done && (
                  <motion.div
                    key={flash.id}
                    className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="rounded-lg px-4 py-1.5 font-mono text-2xl font-bold uppercase text-[#141414]"
                      style={{
                        background: flash.kind === "scopa" ? "#fbbf24" : LIME,
                        boxShadow: flash.kind === "scopa" ? "0 0 24px rgba(251,191,36,0.5)" : "0 0 24px rgba(204,255,0,0.4)",
                        animation: "scopa-flash 0.8s ease forwards",
                      }}
                    >
                      {flash.kind === "scopa" ? "SCOPA!" : "RACCOLTA"}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* outcome */}
              <AnimatePresence>
                {done && (
                  <motion.div
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1 bg-black/70 backdrop-blur-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="font-mono text-3xl font-bold uppercase"
                      style={{
                        color: lastWon ? LIME : round.outcome === "draw" ? "#fbbf24" : RED,
                        textShadow: lastWon ? "0 0 18px rgba(204,255,0,0.4)" : undefined,
                        animation: "scopa-outcome-pop 0.5s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      {lastWon ? "Vittoria" : round.outcome === "draw" ? "Pareggio" : "Sconfitta"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Giocatore {round.playerPoints} · Banco {round.bankPoints} · {selectedLabel}
                    </div>
                    {lastWon && <div className="font-mono font-bold" style={{ color: LIME }}>+{formatCurrency(mutation.data?.payout ?? 0)}</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scoreboard */}
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((side) => {
                const s = scoreSide(side);
                if (!s) return null;
                return (
                  <div
                    key={side}
                    className="rounded-md border p-2.5"
                    style={{
                      borderColor: s.winner && done ? "color-mix(in oklab, var(--color-lime) 45%, transparent)" : "var(--color-border)",
                      background: s.winner && done ? "color-mix(in oklab, var(--color-lime) 5%, transparent)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.name}</span>
                      {s.winner && done && <Trophy className="h-3.5 w-3.5" style={{ color: LIME }} />}
                    </div>
                    <div className="font-mono text-2xl font-bold" style={{ color: s.winner && done ? LIME : "white" }}>
                      {done ? s.points : "•"}
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      {s.cells.map((c, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <span>{c.label}</span>
                          {revealed > j ? <b className="font-mono" style={{ color: c.win && done ? LIME : "var(--color-foreground)" }}>{c.value}</b> : <b className="opacity-30">•</b>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2">
              <Stat label="Esito" value={round.outcome === "draw" ? "Pareggio" : round.outcome === "player" ? "Giocatore" : "Banco"} />
              <Stat label="Totale punti" value={String(round.totalPoints)} />
              <Stat label={lastWon ? "Vincita" : "Esito"} value={lastWon ? formatCurrency(mutation.data?.payout ?? 0) : "Persa"} accent={!!lastWon} />
            </div>
          </>
        )}
      </GameArea>
    </GameShell>
  );
}

// ============== MAIN SWITCH ==============
// ============== MAIN SWITCH ==============
export function GamePlayer({ slug }: { slug: string }) {
  switch (slug) {
    case "dice":
      return <DiceGame />;
    case "crash":
      return <CrashGame />;
    case "plinko":
      return <PlinkoGame />;
    case "mines":
      return <MinesGame />;
    case "limbo":
      return <LimboGame />;
    case "coinflip":
      return <CoinflipGame />;
    case "wheel":
      return <WheelGame />;
    case "scopa":
      return <ScopaGame />;
    default:
      return (
        <div className="p-8 text-center text-muted-foreground rounded-lg bg-card/40 border border-border/50">
          <p className=" uppercase tracking-wider text-sm">
            Unknown game
          </p>
          <p className="font-mono text-xs mt-1">{slug}</p>
        </div>
      );
  }
}

export default GamePlayer;
