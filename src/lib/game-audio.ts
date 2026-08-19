"use client";

/*
 * Synthesised game audio.
 *
 * The previous hook pointed at /sounds/*.mp3 — files that were never added, so
 * every game was silent and failed quietly. Rather than ship binary assets,
 * these are generated with the Web Audio API: no downloads, no cache misses,
 * no licensing, and each cue can be tuned by changing a number.
 *
 * The context is created lazily on the first gesture because browsers refuse
 * to start audio before the user interacts with the page.
 */

/*
 * The on/off state used to live in its own localStorage key while the frame
 * header's toggle wrote to the game-settings store — two truths, so muting in
 * one place left cues playing. The preference now lives only in
 * useGameSettings; these helpers are thin adapters kept so call sites do not
 * change shape, and the master gain follows the store live.
 */
import { useGameSettings } from "@/lib/game-settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function isSoundEnabled(): boolean {
  return useGameSettings.getState().soundEnabled;
}

export function setSoundEnabled(on: boolean): void {
  useGameSettings.getState().setSound(on);
}

// Keep a live master gain in step with the store, no matter which toggle
// (frame header or floating button) the player used.
if (typeof window !== "undefined") {
  useGameSettings.subscribe((s) => {
    if (master) master.gain.value = s.soundEnabled ? 0.5 : 0;
  });
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = isSoundEnabled() ? 0.5 : 0;
    master.connect(ctx.destination);
  }
  // Autoplay policy suspends the context until a gesture resumes it.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One shaped oscillator note. */
function tone(opts: {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}): void {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);

  // Short attack, exponential decay — percussive, never clicky.
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** Filtered noise burst — used for impacts and reel stops. */
function noise(dur: number, freq: number, gain = 0.15, delay = 0): void {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  /** UI tap. */
  click: () => tone({ freq: 620, to: 480, dur: 0.05, type: "triangle", gain: 0.12 }),
  /** Chip laid / bet accepted. */
  bet: () => { tone({ freq: 380, to: 620, dur: 0.09, type: "triangle", gain: 0.18 }); noise(0.05, 2600, 0.06); },
  /** Repeating counter tick (multiplier climbing, reels spinning). */
  tick: () => tone({ freq: 1100, dur: 0.03, type: "square", gain: 0.05 }),
  /** Something landed — reel stop, tile reveal, ball in pocket. */
  reveal: () => { noise(0.07, 1400, 0.12); tone({ freq: 520, to: 700, dur: 0.07, type: "sine", gain: 0.12 }); },
  /** Standard win: a bright major arpeggio. */
  win: () => {
    [0, 0.075, 0.15].forEach((d, i) => tone({ freq: [660, 830, 990][i], dur: 0.22, type: "triangle", gain: 0.2, delay: d }));
  },
  /** Big win: longer rising run with a shimmer on top. */
  bigWin: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone({ freq: f, dur: 0.4, type: "triangle", gain: 0.22, delay: i * 0.08 }));
    tone({ freq: 2200, to: 3400, dur: 0.7, type: "sine", gain: 0.07, delay: 0.3 });
  },
  /** Loss: two descending muted notes — present, not punishing. */
  lose: () => {
    tone({ freq: 300, to: 190, dur: 0.22, type: "sine", gain: 0.16 });
    tone({ freq: 190, to: 130, dur: 0.3, type: "sine", gain: 0.12, delay: 0.12 });
  },
  /** Explosion / bust. */
  bust: () => { noise(0.35, 220, 0.3); tone({ freq: 160, to: 55, dur: 0.42, type: "sawtooth", gain: 0.22 }); },
};

export type SfxName = keyof typeof sfx;
