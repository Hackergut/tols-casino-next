/*
 * Fiat on-ramp ("Buy crypto") helper — client-safe (uses only NEXT_PUBLIC_ env,
 * because MoonPay/Transak widget API keys are public by design).
 *
 * Buy sends the purchased crypto to the platform's configured receive address
 * for the chain; once it lands on-chain, the existing deposit watcher credits
 * the wallet. We scope Buy to USDT (the wallet currency) so units line up with
 * the credit path; buying BTC/ETH to a USDT wallet needs a conversion layer
 * that is not part of this rail.
 */

export type BuyProvider = "moonpay" | "transak";

export function getBuyConfig(): { provider: BuyProvider | null; key: string } {
  const p = (process.env.NEXT_PUBLIC_BUY_PROVIDER || "").toLowerCase();
  const key = process.env.NEXT_PUBLIC_BUY_API_KEY || "";
  return { provider: p === "moonpay" || p === "transak" ? (p as BuyProvider) : null, key };
}

export function buildBuyUrl(args: {
  provider: BuyProvider;
  key: string;
  cryptoCode: string;
  walletAddress: string;
  fiatAmount: number;
  fiatCurrency: string;
}): string {
  const { provider, key, cryptoCode, walletAddress, fiatAmount, fiatCurrency } = args;
  if (provider === "moonpay") {
    const u = new URL("https://buy.moonpay.com");
    u.searchParams.set("apiKey", key);
    u.searchParams.set("currencyCode", cryptoCode);
    u.searchParams.set("walletAddress", walletAddress);
    u.searchParams.set("baseCurrencyAmount", String(fiatAmount));
    u.searchParams.set("baseCurrencyCode", fiatCurrency);
    return u.toString();
  }
  const u = new URL("https://global.transak.com");
  u.searchParams.set("apiKey", key);
  u.searchParams.set("cryptoCurrencyCode", cryptoCode);
  u.searchParams.set("walletAddress", walletAddress);
  u.searchParams.set("fiatAmount", String(fiatAmount));
  u.searchParams.set("fiatCurrency", fiatCurrency);
  return u.toString();
}
