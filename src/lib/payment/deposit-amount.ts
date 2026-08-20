/*
 * Unique-amount deposit fingerprinting (server only).
 *
 * A watch-only platform shares ONE receive address per chain, so a raw on-chain
 * payment doesn't say who sent it. Instead of asking every player to paste a tx
 * hash, we make each pending deposit's amount unique: the real converted amount,
 * plus a tiny random "tag" in the least-significant decimals. The player sends
 * that exact figure, and the watcher matches the incoming payment back to the
 * player purely by amount — no hash required.
 *
 * The tag lives strictly BELOW the base amount's last place, so it never
 * distorts the quoted value by more than a sub-cent (stablecoins) or a few
 * cents of coin (BTC/ETH). Crediting always uses `amountUsd`, so the player is
 * never short-changed for the extra dust they send.
 */

import { usdToCrypto } from "@/lib/payment/price-feed";

// baseDecimals = how coarsely the converted amount is rounded.
// tagDecimals  = full precision; the unique tag occupies the decimals between.
const FP: Record<string, { baseDecimals: number; tagDecimals: number }> = {
  btc: { baseDecimals: 4, tagDecimals: 8 },
  eth: { baseDecimals: 3, tagDecimals: 6 },
  polygon: { baseDecimals: 3, tagDecimals: 6 },
  bnb: { baseDecimals: 3, tagDecimals: 6 },
  solana: { baseDecimals: 3, tagDecimals: 6 },
  usdt_erc20: { baseDecimals: 2, tagDecimals: 4 },
  usdc_erc20: { baseDecimals: 2, tagDecimals: 4 },
  usdt_bep20: { baseDecimals: 2, tagDecimals: 4 },
};

const cfgFor = (chain: string) => FP[chain] ?? { baseDecimals: 6, tagDecimals: 8 };

export interface UniqueAmount {
  amount: number; // fingerprinted crypto amount to send (native unit)
  amountUsd: number; // USD value credited on confirmation
  price: number | null;
  decimals: number; // display precision (tagDecimals)
}

/**
 * Build a unique crypto amount for a USD deposit. `taken` is the set of crypto
 * amounts already reserved by other pending deposits on the same chain, so the
 * new one doesn't collide. Returns null when no price is available.
 */
export async function computeUniqueAmount(
  chain: string,
  amountUsd: number,
  taken: number[] = []
): Promise<UniqueAmount | null> {
  const conv = await usdToCrypto(chain, amountUsd);
  if (!conv) return null;

  const { baseDecimals, tagDecimals } = cfgFor(chain);
  const scale = 10 ** tagDecimals;
  const tagSlots = 10 ** (tagDecimals - baseDecimals); // e.g. 100 for stablecoins
  // Base amount expressed in the smallest (tagDecimals) unit — a multiple of tagSlots.
  const baseUnits = Math.round(conv.amount * 10 ** baseDecimals) * tagSlots;

  const takenUnits = new Set(taken.map((t) => Math.round(t * scale)));
  let finalUnits = baseUnits + 1; // never leave the tag at 0 (that's the un-tagged base)
  for (let i = 0; i < 200; i++) {
    const tag = 1 + Math.floor(Math.random() * (tagSlots - 1)); // [1, tagSlots-1]
    const candidate = baseUnits + tag;
    if (!takenUnits.has(candidate)) {
      finalUnits = candidate;
      break;
    }
    finalUnits = candidate; // fallback: keep last even if colliding (watcher skips ambiguous)
  }

  return {
    amount: finalUnits / scale,
    amountUsd,
    price: conv.price,
    decimals: tagDecimals,
  };
}

/** Exact match of two crypto amounts at the chain's fingerprint precision. */
export function sameUniqueAmount(chain: string, a: number, b: number): boolean {
  const scale = 10 ** cfgFor(chain).tagDecimals;
  return Math.round(a * scale) === Math.round(b * scale);
}

/** Display precision for a chain's amounts. */
export function amountDecimals(chain: string): number {
  return cfgFor(chain).tagDecimals;
}
