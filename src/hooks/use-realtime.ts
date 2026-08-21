"use client";

/*
 * Client side of the realtime gateways — one shared connection per stream.
 *
 * Before this existed every component owned its own polling loop (chat every
 * 5s, winners every 15s, jackpot on mount only) and SupportChat opened a
 * private EventSource all by itself. Realtime is a shared resource: the
 * browser caps concurrent connections per origin at 6 for HTTP/1.1, and every
 * SSE stream holds one of them for its whole life. Two components each
 * opening /api/events would spend a third of the budget on duplicate data.
 *
 * So this module keeps exactly one EventSource per stream:
 *
 *   - PUBLIC  (/api/events/public) — bet feed, chat, jackpot, winners.
 *     Opened lazily when the first subscriber appears, closed when the last
 *     one leaves.
 *   - PRIVATE (/api/events) — balance, bonus, rounds, support. Same
 *     lifecycle, but the server answers 401 for guests; the manager backs off
 *     and retries slowly instead of hammering the endpoint.
 *
 * Components subscribe with `usePublicEvent` / `useUserEvent`. Handlers are
 * kept in a ref so re-renders never tear down the underlying connection.
 *
 * Reconnect: native EventSource retries on its own for transient drops, but
 * gives up permanently when the server responds with an HTTP error. The
 * manager watches for that terminal state and reopens with exponential
 * backoff, because "the tab survived a deploy" is exactly the moment players
 * must not silently stop receiving balance updates.
 */

import { useEffect, useRef } from "react";

type Listener = (data: unknown) => void;

interface StreamManager {
  url: string;
  es: EventSource | null;
  listeners: Map<string, Set<Listener>>;
  /** Event names already bound with addEventListener on the current socket. */
  bound: Set<string>;
  retry: number;
  timer: ReturnType<typeof setTimeout> | null;
}

function makeManager(url: string): StreamManager {
  return { url, es: null, listeners: new Map(), bound: new Set(), retry: 0, timer: null };
}

/* Survive Fast Refresh: a new module instance must not leak the previous
 * module's open sockets. */
const g = globalThis as unknown as { __tolsSSE?: Record<string, StreamManager> };
const managers = (g.__tolsSSE ??= {
  public: makeManager("/api/events/public"),
  user: makeManager("/api/events"),
});

function dispatch(m: StreamManager, event: string, raw: MessageEvent) {
  const set = m.listeners.get(event);
  if (!set || set.size === 0) return;
  let data: unknown = null;
  try {
    data = JSON.parse(raw.data as string);
  } catch {
    /* non-JSON payload — deliver null rather than crash the listener */
  }
  for (const fn of set) {
    try {
      fn(data);
    } catch {
      /* isolate subscribers */
    }
  }
}

function bindEvent(m: StreamManager, event: string) {
  if (!m.es || m.bound.has(event)) return;
  m.bound.add(event);
  m.es.addEventListener(event, (e) => dispatch(m, event, e as MessageEvent));
}

function open(m: StreamManager) {
  if (m.es || typeof window === "undefined") return;
  const es = new EventSource(m.url);
  m.es = es;
  m.bound = new Set();
  for (const event of m.listeners.keys()) bindEvent(m, event);

  es.addEventListener("hello", () => {
    m.retry = 0; // server accepted the stream — reset the backoff
  });

  es.onerror = () => {
    // readyState CLOSED means EventSource gave up (HTTP-level failure, e.g.
    // 401 on the private stream for a guest). CONNECTING means it is retrying
    // by itself — leave it alone.
    if (es.readyState !== EventSource.CLOSED) return;
    m.es = null;
    m.bound = new Set();
    if (m.listeners.size === 0) return;
    const delay = Math.min(30_000, 1000 * 2 ** m.retry);
    m.retry += 1;
    m.timer = setTimeout(() => {
      m.timer = null;
      if (m.listeners.size > 0) open(m);
    }, delay);
  };
}

function closeIfIdle(m: StreamManager) {
  if (m.listeners.size > 0) return;
  if (m.timer) {
    clearTimeout(m.timer);
    m.timer = null;
  }
  m.es?.close();
  m.es = null;
  m.bound = new Set();
  m.retry = 0;
}

function addListener(m: StreamManager, event: string, fn: Listener): () => void {
  let set = m.listeners.get(event);
  if (!set) {
    set = new Set();
    m.listeners.set(event, set);
  }
  set.add(fn);
  open(m);
  bindEvent(m, event);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) m.listeners.delete(event);
    closeIfIdle(m);
  };
}

/**
 * Subscribe to one event on the shared PUBLIC stream. `handler` may be an
 * unstable closure — it lives in a ref, so re-renders don't reconnect.
 * Pass `enabled: false` to park the subscription without unmounting.
 */
export function usePublicEvent<T = unknown>(event: string, handler: (data: T) => void, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    return addListener(managers.public, event, (d) => ref.current(d as T));
  }, [event, enabled]);
}

/**
 * Subscribe to one event on the shared PRIVATE stream (requires a session —
 * pass `enabled` = "is the user authenticated" so guests never poke a 401).
 */
export function useUserEvent<T = unknown>(event: string, handler: (data: T) => void, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    return addListener(managers.user, event, (d) => ref.current(d as T));
  }, [event, enabled]);
}
