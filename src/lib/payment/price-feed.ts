/*
 * USD → crypto price feed (server only), backed by CoinGecko's public API (no
 * key required for this volume). Cached in-memory for a short TTL so every
 * QR-code request doesn't hit their rate limit.
 *
 * Why this exists: the deposit panel lets a player pick a USD amount ("$50"),
 * but the address only understands the chain's native unit. Without a
 * conversion, the UI previously told players to "send exactly 50 BTC" for a
 * $50 deposit — fifty whole bitcoin. This is the fix.
 */

const COINGECKO_IDS: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  solana: "solana",
  polygon: "matic-network",
  bnb: "binancecoin",
};
// Stablecoins are treated as 1:1 with USD — no external lookup needed, and no
// price-feed outage can ever break a stablecoin deposit.
const STABLECOINS = new Set(["usdt_erc20", "usdc_erc20", "usdt_bep20"]);

let cache: { at: number; prices: Record<string, number> } | null = null;
const TTL_MS = 60_000;

async function fetchPrices(): Promise<Record<string, number>> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const j = (await r.json()) as Record<string, { usd: number }>;
  const out: Record<string, number> = {};
  for (const [chain, id] of Object.entries(COINGECKO_IDS)) {
    const p = j[id]?.usd;
    if (typeof p === "number" && p > 0) out[chain] = p;
  }
  return out;
}

/** USD price of one unit of the chain's native/quoted asset, or null if unknown. */
export async function usdPrice(chain: string): Promise<number | null> {
  if (STABLECOINS.has(chain)) return 1;
  if (!(chain in COINGECKO_IDS)) return null;
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      cache = { at: Date.now(), prices: await fetchPrices() };
    } catch {
      // Keep serving the previous cache (even if stale) rather than failing
      // the whole deposit flow because the price API had one bad request.
      if (!cache) return null;
    }
  }
  return cache.prices[chain] ?? null;
}

/** Convert a USD amount into the chain's native unit, rounded to its display precision. */
export async function usdToCrypto(chain: string, usdAmount: number): Promise<{ amount: number; price: number | null } | null> {
  const price = await usdPrice(chain);
  if (!price) return null;
  const decimalsShown = STABLECOINS.has(chain) ? 2 : 8;
  const amount = Math.round((usdAmount / price) * 10 ** decimalsShown) / 10 ** decimalsShown;
  return { amount, price };
}
