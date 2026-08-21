/**
 * Realtime event bus — the single fan-out point between "something happened
 * on the server" and "a browser needs to know now".
 *
 * Two channels:
 *
 *  - USER events carry a `userId` and are only delivered to that player's
 *    private SSE stream (/api/events). Balance moves, round results, support
 *    replies — anything that would leak state if broadcast.
 *  - PUBLIC events have no owner and go to every open public stream
 *    (/api/events/public): the bet feed, community chat, the jackpot ticker,
 *    big-win announcements. Nothing in a public payload may identify a player
 *    beyond the username they already publish by betting.
 *
 * Transport: in-process listener sets by default. When REDIS_URL is set the
 * bus upgrades itself to Redis pub/sub so multiple API instances (or the
 * standalone server next to serverless functions) see each other's events.
 * The upgrade is transparent — publish/subscribe keep the same signature —
 * and failure degrades back to in-process delivery rather than dropping
 * events on the floor.
 *
 * Listener sets live on globalThis for the same reason the Prisma client
 * does: Next's dev server re-evaluates modules on hot reload, and a fresh
 * module-scope Set would orphan every SSE stream opened before the edit.
 */

export type RealtimeEvent =
  | { event: "balance:update"; userId: string; data: { balance: number } }
  | { event: "round:started"; userId: string; data: Record<string, unknown> }
  | { event: "round:result"; userId: string; data: Record<string, unknown> }
  | { event: "auto-bet:status"; userId: string; data: Record<string, unknown> | object }
  | { event: "support:message"; userId: string; data: { ticketId: string; message: unknown } }
  | { event: "support:ticket"; userId: string; data: { ticket: unknown } }
  | { event: "bonus:update"; userId: string; data: { bonusBalance: number; wageringRemaining: number } }
  | { event: "error"; userId: string; data: { code: string; message?: string } };

/** Wire shape of a public bet-feed entry — mirrors /api/bets/feed rows. */
export interface FeedBetWire {
  id: string;
  gameId: string;
  gameName: string;
  username: string;
  avatarColor: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  currency: string;
  createdAt: string;
}

export interface ChatMessageWire {
  id: string;
  username: string;
  avatarColor: string;
  message: string;
  channel: string;
  createdAt: string;
}

export interface WinnerWire {
  id: string;
  username: string;
  avatarColor: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  createdAt: string;
}

export type PublicRealtimeEvent =
  | { event: "feed:bet"; data: FeedBetWire }
  | { event: "chat:message"; data: ChatMessageWire }
  | { event: "jackpot:update"; data: { amount: number; contributionsCount?: number } }
  | { event: "winner:new"; data: WinnerWire };

type Handler = (e: RealtimeEvent) => void;
type PublicHandler = (e: PublicRealtimeEvent) => void;

/* ------------------------------------------------------------------ *
 * Local listener registry (survives dev hot reload via globalThis).
 * ------------------------------------------------------------------ */

interface BusState {
  user: Set<Handler>;
  public: Set<PublicHandler>;
  redis: RedisState;
}

interface RedisState {
  status: "off" | "connecting" | "ready" | "failed";
  pub: { publish: (channel: string, msg: string) => Promise<unknown> } | null;
}

const g = globalThis as unknown as { __tolsRealtimeBus?: BusState };
const bus: BusState =
  g.__tolsRealtimeBus ??
  (g.__tolsRealtimeBus = {
    user: new Set<Handler>(),
    public: new Set<PublicHandler>(),
    redis: { status: "off", pub: null },
  });

function dispatchUser(e: RealtimeEvent): void {
  for (const h of bus.user) {
    try {
      h(e);
    } catch {
      /* isolate subscribers */
    }
  }
}

function dispatchPublic(e: PublicRealtimeEvent): void {
  for (const h of bus.public) {
    try {
      h(e);
    } catch {
      /* isolate subscribers */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Redis pub/sub upgrade — active only when REDIS_URL is configured.
 * ------------------------------------------------------------------ */

const REDIS_CHANNEL = "tols:realtime";

type WireEnvelope =
  | { scope: "user"; e: RealtimeEvent }
  | { scope: "public"; e: PublicRealtimeEvent };

/**
 * Lazily connect the pub/sub pair. `ioredis` is imported dynamically so the
 * dependency stays out of the bundle (and out of the boot path) for
 * deployments that never set REDIS_URL.
 */
function ensureRedis(): void {
  if (bus.redis.status !== "off") return;
  const url = process.env.REDIS_URL;
  if (!url) return;
  bus.redis.status = "connecting";

  void (async () => {
    try {
      const { default: Redis } = await import("ioredis");
      const opts = {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => Math.min(times * 500, 5000),
      };
      const pub = new Redis(url, opts);
      const sub = new Redis(url, opts);

      sub.on("message", (_channel: string, raw: string) => {
        try {
          const env = JSON.parse(raw) as WireEnvelope;
          if (env.scope === "user") dispatchUser(env.e);
          else dispatchPublic(env.e);
        } catch {
          /* malformed message — drop it, never crash the subscriber */
        }
      });

      // Degrade instead of throwing: an unreachable Redis must not take the
      // API down, it just narrows delivery back to this instance.
      pub.on("error", () => {
        bus.redis.status = "failed";
      });
      sub.on("error", () => {
        bus.redis.status = "failed";
      });
      pub.on("ready", () => {
        if (bus.redis.status !== "failed") bus.redis.status = "ready";
      });

      await sub.subscribe(REDIS_CHANNEL);
      bus.redis.pub = pub;
      if (bus.redis.status === "connecting") bus.redis.status = "ready";
    } catch {
      bus.redis.status = "failed";
    }
  })();
}

/**
 * Route an envelope through Redis when the connection is live, otherwise
 * dispatch locally. When Redis is active we deliberately do NOT also dispatch
 * locally: this instance is subscribed to the same channel, so the loopback
 * delivery covers local listeners and nobody sees the event twice.
 */
function route(env: WireEnvelope): void {
  ensureRedis();
  if (bus.redis.status === "ready" && bus.redis.pub) {
    bus.redis.pub.publish(REDIS_CHANNEL, JSON.stringify(env)).catch(() => {
      // Publish failed mid-flight — deliver locally so the player who caused
      // the event still sees it, and let the retry strategy handle Redis.
      if (env.scope === "user") dispatchUser(env.e);
      else dispatchPublic(env.e);
    });
    return;
  }
  if (env.scope === "user") dispatchUser(env.e);
  else dispatchPublic(env.e);
}

/* ------------------------------------------------------------------ *
 * Public API — same shape the rest of the codebase already uses.
 * ------------------------------------------------------------------ */

export function publish(e: RealtimeEvent): void {
  route({ scope: "user", e });
}

export function subscribe(h: Handler): () => void {
  ensureRedis();
  bus.user.add(h);
  return () => {
    bus.user.delete(h);
  };
}

/** Broadcast an event to every open public stream (no auth, no owner). */
export function publishPublic(e: PublicRealtimeEvent): void {
  route({ scope: "public", e });
}

export function subscribePublic(h: PublicHandler): () => void {
  ensureRedis();
  bus.public.add(h);
  return () => {
    bus.public.delete(h);
  };
}
