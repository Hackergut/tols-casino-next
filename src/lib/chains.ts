// Supported deposit chains. Addresses themselves live in the DepositAddress
// table (pasted from Trust Wallet by an admin) — this file only holds the
// static display metadata and the URI scheme each chain uses for QR codes.

export interface ChainMeta {
  id: string; // db key
  name: string;
  symbol: string;
  color: string;
  // How the address is encoded into a scannable payment URI for wallets.
  uri: (address: string, amount?: number, memo?: string) => string;
  needsMemo?: boolean;
  decimals: number;
}

export const CHAINS: Record<string, ChainMeta> = {
  btc: {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    color: "#f7931a",
    decimals: 8,
    uri: (address, amount) => `bitcoin:${address}${amount ? `?amount=${amount}` : ""}`,
  },
  eth: {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    color: "#627eea",
    decimals: 18,
    uri: (address, amount) => `ethereum:${address}${amount ? `?value=${amount}` : ""}`,
  },
  usdt_erc20: {
    id: "usdt_erc20",
    name: "USDT (ERC-20)",
    symbol: "USDT",
    color: "#26a17b",
    decimals: 6,
    // ERC-20 transfer URI; wallets that support EIP-681 will prefill the token.
    uri: (address) => `ethereum:${address}`,
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    color: "#9945ff",
    decimals: 9,
    uri: (address, amount) => `solana:${address}${amount ? `?amount=${amount}` : ""}`,
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    color: "#8247e5",
    decimals: 18,
    uri: (address, amount) => `polygon:${address}${amount ? `?value=${amount}` : ""}`,
  },
};

export const CHAIN_IDS = Object.keys(CHAINS);

export function isValidChain(id: string): boolean {
  return id in CHAINS;
}
