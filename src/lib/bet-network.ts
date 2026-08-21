/*
 * Shared classification for Originals network traffic.
 *
 * GameFeedback used to monkey-patch `window.fetch` and toast
 * "Connection lost / Your bet was not sent" on ANY thrown request whose URL
 * merely contained "/api/bets". That string also matches:
 *
 *   GET /api/bets?limit=20          (live-feed poll, every few seconds)
 *   GET /api/bets/history           (Recent page, aborted on every re-render)
 *   GET /api/bets/feed              (in-game table, aborted when switching tabs)
 *
 * AbortError is the browser's way of saying "we cancelled this on purpose"
 * (navigation, React effect cleanup). It is not a lost bet. Only an actual
 * POST to the settlement endpoints that fails at the network layer should
 * tell the player their stake never left the device.
 */

export type BetToastKind = "network" | "http";

export interface BetHttpDetail {
  status: number;
  reason: string;
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: string }).name === "AbortError";
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url ?? "";
}

export function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const fromInit = init?.method;
  const fromReq =
    typeof Request !== "undefined" && input instanceof Request ? input.method : undefined;
  return String(fromInit || fromReq || "GET").toUpperCase();
}

/** Pathname only — query strings must not change the classification. */
export function requestPath(url: string): string {
  try {
    return new URL(url, "http://local.invalid").pathname;
  } catch {
    const q = url.indexOf("?");
    const path = q === -1 ? url : url.slice(0, q);
    const hash = path.indexOf("#");
    return hash === -1 ? path : path.slice(0, hash);
  }
}

/**
 * True only for requests that place or continue a wager. Reads of history,
 * the public feed, and live-bet polls are not bets and must never surface
 * as "Your bet was not sent."
 */
export function isOriginalsMutation(url: string, method: string): boolean {
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return false;
  const path = requestPath(url);
  return path === "/api/bets" || /^\/api\/games\/[^/]+\/(action|auto-bet)$/.test(path);
}

export function betFailureToast(
  status: number,
  reason: string,
): { titleKey: string; descriptionKey: string; reason?: string } {
  if (status === 429) return { titleKey: "error.tooMany", descriptionKey: "error.wait" };
  if (/insufficient/i.test(reason)) return { titleKey: "error.balance", descriptionKey: "error.reduce" };
  return { titleKey: "error.betFailed", descriptionKey: "error.retry", reason: reason || undefined };
}

type ToastFn = (kind: BetToastKind, detail?: BetHttpDetail) => void;

interface GuardState {
  count: number;
  original: typeof fetch | null;
  handler: ToastFn | null;
}

const g = globalThis as unknown as { __tolsBetFetchGuard?: GuardState };
const state: GuardState =
  g.__tolsBetFetchGuard ?? (g.__tolsBetFetchGuard = { count: 0, original: null, handler: null });

/**
 * Ref-counted `window.fetch` wrapper. Survives Fast Refresh / Strict Mode
 * remounts without nesting wrappers, and always delegates to the native fetch
 * captured on first install.
 */
export function installBetFetchGuard(onToast: ToastFn): () => void {
  if (typeof window === "undefined") return () => {};
  state.handler = onToast;
  state.count += 1;
  if (state.count === 1) {
    const original = window.fetch.bind(window);
    state.original = original;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      const mutation = isOriginalsMutation(url, method);
      try {
        const res = await original(input, init);
        if (mutation) {
          void res
            .clone()
            .json()
            .then((j: { success?: boolean; error?: unknown }) => {
              if (!res.ok || !j?.success) {
                state.handler?.("http", { status: res.status, reason: String(j?.error ?? "") });
              }
            })
            .catch(() => {
              /* non-JSON error body — the caller already has the Response */
            });
        }
        return res;
      } catch (error) {
        if (mutation && !isAbortError(error)) state.handler?.("network");
        throw error;
      }
    };
  }
  return () => {
    state.count = Math.max(0, state.count - 1);
    if (state.count === 0 && state.original) {
      window.fetch = state.original;
      state.original = null;
      state.handler = null;
    }
  };
}
