"use client";

/*
 * Persistent game settings.
 *
 * Every Original reset itself completely on exit: the stake went back to a
 * hardcoded default (which differed per game — some 5, some 1), the risk
 * setting was forgotten, sound preference was per-component, and leaving a
 * game to check the lobby meant re-entering everything.
 *
 * This store keeps the setup a player has chosen. Two scopes:
 *
 *   - GLOBAL, shared by every game: stake, currency, sound, animation speed,
 *     and whether to skip result animations. A player who bets $5 in Dice
 *     almost certainly wants $5 in Mines, and having the stake silently change
 *     between games is how people bet more than they intended.
 *
 *   - PER-GAME, keyed by game id: the game-specific controls (risk, rows,
 *     mine count, target multiplier). These genuinely differ per game, so they
 *     are stored separately rather than flattened together.
 *
 * Persisted to localStorage. This is presentation state only — never balance,
 * never anything the server is authoritative for. Restoring a stake is
 * convenience; restoring a balance would be a security bug.
 */

import { useReducedMotion } from "framer-motion";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BetMode = "manual" | "auto";

/**
 * Auto-bet configuration, shared by every game. Mirrors what players expect
 * from the Auto tab: how many rounds to play automatically and when to stop
 * early. 0 means "no limit" on every field.
 */
export interface AutoBetConfig {
  /** Rounds to run; 0 = run until stopped (or until a stop limit hits). */
  rounds: number;
  /** Stop once the run is up by at least this much; 0 = off. */
  stopOnProfit: number;
  /** Stop once the run is down by at least this much; 0 = off. */
  stopOnLoss: number;
}

export interface GlobalGameSettings {
  /** Stake, shared across games so it does not silently jump. */
  stake: number;
  /** Manual or auto betting. */
  mode: BetMode;
  /** Auto-bet limits, applied when mode is "auto". */
  auto: AutoBetConfig;
  soundEnabled: boolean;
  /** Skip result animations — faster play, and the accessible default when
   *  the OS asks for reduced motion. */
  quickPlay: boolean;
  /** Show the running profit/loss counter in the frame header. */
  showProfit: boolean;
}

/**
 * Per-game controls. Everything optional: a game reads only what it uses.
 *
 * The value types are deliberately wide (a plain string for risk, a plain
 * number for rows) because this store is shared by games with different
 * option sets — Keno has a "classic" risk that Plinko does not, and Plinko's
 * rows are 8|12|16 while nothing else has rows at all. Narrowing back to each
 * game's own union happens at the call site via useGameSetting's type
 * parameter, so a game still gets an exact type without this file having to
 * know every game's vocabulary.
 */
export interface PerGameSettings {
  risk?: string;
  rows?: number;
  mines?: number;
  target?: number;
  picks?: number[];
  choice?: string;
  /** Roulette chip value. */
  chip?: number;
}

interface GameSettingsState extends GlobalGameSettings {
  perGame: Record<string, PerGameSettings>;
  setStake: (v: number) => void;
  setMode: (v: BetMode) => void;
  setAuto: (patch: Partial<AutoBetConfig>) => void;
  toggleSound: () => void;
  setSound: (on: boolean) => void;
  setQuickPlay: (v: boolean) => void;
  setShowProfit: (v: boolean) => void;
  /** Merge a patch into one game's settings. */
  setGameSetting: (gameId: string, patch: PerGameSettings) => void;
  getGameSetting: (gameId: string) => PerGameSettings;
  resetAll: () => void;
}

const DEFAULT_AUTO: AutoBetConfig = { rounds: 10, stopOnProfit: 0, stopOnLoss: 0 };

const DEFAULTS: GlobalGameSettings = {
  stake: 1,
  mode: "manual",
  auto: DEFAULT_AUTO,
  soundEnabled: true,
  quickPlay: false,
  showProfit: true,
};

export const useGameSettings = create<GameSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      perGame: {},

      setStake: (v) =>
        set({
          // Guard here rather than at every call site: a NaN from a cleared
          // number input used to propagate into the bet body as null.
          stake: Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : DEFAULTS.stake,
        }),
      setMode: (mode) => set({ mode }),
      setAuto: (patch) =>
        set((s) => {
          const next = { ...s.auto, ...patch };
          // Sanitised here rather than at every input: a negative round count
          // or a NaN limit would make the auto loop's stop checks meaningless.
          next.rounds = Number.isFinite(next.rounds) ? Math.max(0, Math.floor(next.rounds)) : 0;
          next.stopOnProfit = Number.isFinite(next.stopOnProfit)
            ? Math.max(0, Math.round(next.stopOnProfit * 100) / 100)
            : 0;
          next.stopOnLoss = Number.isFinite(next.stopOnLoss)
            ? Math.max(0, Math.round(next.stopOnLoss * 100) / 100)
            : 0;
          return { auto: next };
        }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setSound: (on) => set({ soundEnabled: Boolean(on) }),
      setQuickPlay: (quickPlay) => set({ quickPlay }),
      setShowProfit: (showProfit) => set({ showProfit }),

      setGameSetting: (gameId, patch) =>
        set((s) => ({
          perGame: { ...s.perGame, [gameId]: { ...s.perGame[gameId], ...patch } },
        })),

      getGameSetting: (gameId) => get().perGame[gameId] ?? {},

      resetAll: () => set({ ...DEFAULTS, perGame: {} }),
    }),
    {
      name: "tols_game_settings",
      /*
       * v2 adds the auto-bet config and takes over the sound preference from
       * game-audio's old standalone localStorage key ("tols-sound-enabled").
       * Two sound toggles kept two separate truths — the frame header switched
       * this store while the audio engine read its own key, so muting in one
       * place left sound playing. Honour the legacy choice once, then it is
       * this store that speaks.
       */
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          if (!state.auto || typeof state.auto !== "object") state.auto = { ...DEFAULT_AUTO };
          try {
            const legacy = window.localStorage.getItem("tols-sound-enabled");
            if (legacy !== null) {
              state.soundEnabled = legacy !== "false";
              window.localStorage.removeItem("tols-sound-enabled");
            }
          } catch {
            // Storage unavailable (SSR or privacy mode) — keep the default.
          }
        }
        return state as unknown as GameSettingsState;
      },
      storage: createJSONStorage(() => localStorage),
      // Only the settings, never anything derived from the server.
      partialize: (s) => ({
        stake: s.stake,
        mode: s.mode,
        auto: s.auto,
        soundEnabled: s.soundEnabled,
        quickPlay: s.quickPlay,
        showProfit: s.showProfit,
        perGame: s.perGame,
      }),
    },
  ),
);

/**
 * Read a per-game setting with a fallback, as a hook so components re-render
 * when it changes.
 *
 * `T` narrows the stored value to the calling game's own union, so
 * `useGameSetting<Risk>("wheel", "risk", "medium")` yields Risk rather than
 * the wider string this store holds. The fallback is what a first-time player
 * sees, and it is also the recovery value if persisted state is stale — a
 * saved "classic" risk from Keno must not leak into Plinko, which has no such
 * option, so the value is validated against `allowed` when supplied.
 */
export function useGameSetting<T extends PerGameSettings[keyof PerGameSettings]>(
  gameId: string,
  key: keyof PerGameSettings,
  fallback: T,
  allowed?: readonly T[],
): [T, (v: T) => void] {
  const stored = useGameSettings((s) => s.perGame[gameId]?.[key]) as T | undefined;
  const setGameSetting = useGameSettings((s) => s.setGameSetting);

  const valid =
    stored !== undefined && (!allowed || allowed.includes(stored)) ? stored : fallback;

  const set = (v: T) => setGameSetting(gameId, { [key]: v } as PerGameSettings);
  return [valid, set];
}

/**
 * Whether this game should skip its result animation.
 *
 * Two independent reasons to do so, and every game needs both: the OS-level
 * reduced-motion preference (accessibility, non-negotiable) and the player's
 * own Quick Play toggle (they have seen the animation a hundred times and
 * want the result). Games used to consult only the first, so Quick Play had
 * nothing to switch off.
 *
 * Wrapping them here means a game asks one question instead of two, and
 * cannot honour one while forgetting the other.
 */
export function useSkipAnimation(): boolean {
  const reduced = useReducedMotion();
  const quickPlay = useGameSettings((s) => s.quickPlay);
  return Boolean(reduced) || quickPlay;
}
