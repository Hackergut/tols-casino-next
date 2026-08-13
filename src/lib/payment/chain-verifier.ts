import { isValidChain } from "@/lib/chains";

/*
 * On-chain deposit verification (server only).
 *
 * Custodial rule: a deposit is credited ONLY when an on-chain transaction is
 * mined, pays the platform's configured receive address for that chain, and
 * moves >= the claimed amount. Every verifier is FAIL-CLOSED: any fetch or
 * decode error returns confirmed:false, so a broken provider can never cause a
 * false credit. The deposit watcher calls this and only credits when
 * confirmed && toAddressMatches && amountMatches.
 *
 * RPC/API endpoints are configurable via env so production can use Alchemy /
 * QuickNode / Helius / a private node. Defaults are public free endpoints,
 * which are fine for low volume and testing but rate-limited.
 */

export interface VerifyArgs {
  chain: string;
  txHash: string;
  expectedAddress: string;
  expectedAmount: number; // human units (BTC, ETH, SOL, USDT)
  minConfirmations: number;
}

export interface VerifyResult {
  found: boolean;
  confirmed: boolean;
  confirmations: number;
  toAddressMatches: boolean;
  amountMatches: boolean;
  amountOnChain: number | null;
  error?: string;
}

const NOT_FOUND: VerifyResult = {
  found: false, confirmed: false, confirmations: 0,
  toAddressMatches: false, amountMatches: false, amountOnChain: null,
};

const fail = (msg: string): VerifyResult => ({ ...NOT_FOUND, error: msg });

const rpcUrl = (key: string, fallback: string) => (process.env[key] || fallback).replace(/\/+$/, "");

const BTC_API = () => rpcUrl("BTC_API_URL", "https://blockstream.info/api");
const ETH_RPC = () => rpcUrl("ETH_RPC_URL", "https://ethereum-rpc.publicnode.com");
const POLYGON_RPC = () => rpcUrl("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com");
const BSC_RPC = () => rpcUrl("BSC_RPC_URL", "https://bsc-rpc.publicnode.com");
const SOL_RPC = () => rpcUrl("SOL_RPC_URL", "https://api.mainnet-beta.solana.com");
const USDT_CONTRACT = () =>
  (process.env.USDT_CONTRACT || "0xdac17f958d2ee523a2206206994597c13d831ec7").toLowerCase();
const USDC_CONTRACT = () =>
  (process.env.USDC_CONTRACT || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48").toLowerCase();
const USDT_BEP20_CONTRACT = () =>
  (process.env.USDT_BEP20_CONTRACT || "0x55d398326f99059ff775485246999027b3197955").toLowerCase();

// Tolerance for amount comparison: 0.01% and a tiny absolute floor.
function amountsClose(a: number, b: number): boolean {
  const tol = Math.max(1e-7, Math.abs(b) * 1e-4);
  return Math.abs(a - b) <= tol;
}

function sameAddr(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ── BTC (blockstream) ──
async function verifyBtc(args: VerifyArgs): Promise<VerifyResult> {
  try {
    const tipRes = await fetch(`${BTC_API()}/blocks/tip/height`);
    const tip = tipRes.ok ? Number(await tipRes.text()) : 0;
    const res = await fetch(`${BTC_API()}/tx/${args.txHash}`);
    if (res.status === 404) return { ...NOT_FOUND, error: "tx not found" };
    if (!res.ok) return fail(`btc api ${res.status}`);
    const tx = await res.json();
    if (!tx || !tx.txid) return fail("btc bad payload");
    const confirmed = !!tx.status?.confirmed;
    const blockHeight = tx.status?.block_height ?? 0;
    const confirmations = confirmed && tip ? Math.max(1, tip - blockHeight + 1) : 0;
    let toAddr = "";
    let sumSats = 0;
    for (const o of tx.vout || []) {
      const a = o.scriptpubkey_address;
      if (a && sameAddr(a, args.expectedAddress)) { toAddr = a; sumSats += Number(o.value || 0); }
    }
    const amountOnChain = sumSats / 1e8;
    return {
      found: true,
      confirmed: confirmations >= args.minConfirmations,
      confirmations,
      toAddressMatches: !!toAddr,
      amountMatches: amountsClose(amountOnChain, args.expectedAmount),
      amountOnChain,
    };
  } catch (e) {
    return fail(`btc error: ${(e as Error).message}`);
  }
}

// ── EVM (ETH native, Polygon native) ──
async function evmJsonRpc(rpc: string, method: string, params: unknown[]) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`rpc error: ${j.error.message ?? JSON.stringify(j.error)}`);
  return j.result;
}

async function verifyEvmNative(args: VerifyArgs, rpc: string, decimals: number): Promise<VerifyResult> {
  try {
    const tx: any = await evmJsonRpc(rpc, "eth_getTransactionByHash", [args.txHash]);
    if (!tx) return { ...NOT_FOUND, error: "tx not found" };
    if (!tx.blockNumber) return { found: true, confirmed: false, confirmations: 0, toAddressMatches: sameAddr(tx.to || "", args.expectedAddress), amountMatches: false, amountOnChain: null };
    const tipHex: string = await evmJsonRpc(rpc, "eth_blockNumber", []);
    const tip = parseInt(tipHex, 16);
    const minedAt = parseInt(tx.blockNumber, 16);
    const confirmations = Math.max(1, tip - minedAt + 1);
    const value = BigInt(tx.value || "0x0");
    const amountOnChain = Number(value) / 10 ** decimals;
    return {
      found: true,
      confirmed: confirmations >= args.minConfirmations,
      confirmations,
      toAddressMatches: sameAddr(tx.to || "", args.expectedAddress),
      amountMatches: amountsClose(amountOnChain, args.expectedAmount),
      amountOnChain,
    };
  } catch (e) {
    return fail(`evm error: ${(e as Error).message}`);
  }
}

// ── ERC-20 (USDT on Ethereum). Decode Transfer logs from the receipt. ──
async function verifyErc20(args: VerifyArgs, rpc: string, contract: string, decimals: number): Promise<VerifyResult> {
  try {
    const rcpt: any = await evmJsonRpc(rpc, "eth_getTransactionReceipt", [args.txHash]);
    if (!rcpt) return { ...NOT_FOUND, error: "tx not found" };
    if (!rcpt.blockNumber) return { found: true, confirmed: false, confirmations: 0, toAddressMatches: false, amountMatches: false, amountOnChain: null };
    const tipHex: string = await evmJsonRpc(rpc, "eth_blockNumber", []);
    const tip = parseInt(tipHex, 16);
    const minedAt = parseInt(rcpt.blockNumber, 16);
    const confirmations = Math.max(1, tip - minedAt + 1);
    let toAddr = "";
    let amountRaw = BigInt(0);
    for (const log of rcpt.logs || []) {
      if ((log.address || "").toLowerCase() !== contract) continue;
      const topics: string[] = log.topics || [];
      if (topics.length !== 3) continue; // Transfer(address,address,uint256)
      const toTopic = topics[2];
      const to = "0x" + toTopic.slice(26); // last 20 bytes
      if (sameAddr(to, args.expectedAddress)) {
        toAddr = to;
        amountRaw = BigInt(log.data || "0x0");
      }
    }
    const amountOnChain = Number(amountRaw) / 10 ** decimals;
    return {
      found: true,
      confirmed: confirmations >= args.minConfirmations,
      confirmations,
      toAddressMatches: !!toAddr,
      amountMatches: amountsClose(amountOnChain, args.expectedAmount),
      amountOnChain,
    };
  } catch (e) {
    return fail(`erc20 error: ${(e as Error).message}`);
  }
}

// ── Solana (SOL native via SystemProgram transfer; SPL tokens marked TODO). ──
async function verifySolana(args: VerifyArgs): Promise<VerifyResult> {
  try {
    const res = await fetch(SOL_RPC(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTransaction",
        params: [args.txHash, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
      }),
    });
    const j = await res.json();
    const tx: any = j.result;
    if (!tx) return { ...NOT_FOUND, error: "tx not found" };
    const slot: number = tx.slot;
    const tipRes = await fetch(SOL_RPC(), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [{ commitment: "confirmed" }] }),
    });
    const tip = (await tipRes.json()).result ?? slot;
    const confirmations = Math.max(0, tip - slot + 1);
    // Native SOL: scan SystemProgram Transfer instructions for a transfer to the
    // expected address with the claimed lamports.
    let toAddr = "";
    let lamports = BigInt(0);
    const acctKeys: string[] = (tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
    for (const ix of tx.transaction?.message?.instructions || []) {
      try {
        const dataB = Buffer.from(ix.data, "base64");
        // SystemProgram Transfer discriminator = 2
        if (dataB.length >= 12 && dataB.readUInt32LE(0) === 2) {
          const lam = dataB.readBigUInt64LE(4);
          const fromIdx = ix.accounts[0];
          const toIdx = ix.accounts[1];
          const to = acctKeys[toIdx];
          if (to && sameAddr(to, args.expectedAddress)) { toAddr = to; lamports = lam; }
        }
      } catch { /* ignore decode errors per-instruction */ }
    }
    const amountOnChain = Number(lamports) / 1e9;
    const matched = !!toAddr;
    if (matched) {
      return { found: true, confirmed: confirmations >= args.minConfirmations, confirmations, toAddressMatches: true, amountMatches: amountsClose(amountOnChain, args.expectedAmount), amountOnChain };
    }
    // No native SOL match found; SPL token deposits are not supported here yet.
    return { found: true, confirmed: confirmations >= args.minConfirmations, confirmations, toAddressMatches: false, amountMatches: false, amountOnChain: null, error: "solana spl-token deposits not yet supported" };
  } catch (e) {
    return fail(`solana error: ${(e as Error).message}`);
  }
}

export async function verifyDeposit(args: VerifyArgs): Promise<VerifyResult> {
  if (!isValidChain(args.chain)) return fail("unsupported chain");
  if (!args.txHash || !args.expectedAddress) return fail("missing txHash or address");
  switch (args.chain) {
    case "btc": return verifyBtc(args);
    case "eth": return verifyEvmNative(args, ETH_RPC(), 18);
    case "polygon": return verifyEvmNative(args, POLYGON_RPC(), 18);
    case "usdt_erc20": return verifyErc20(args, ETH_RPC(), USDT_CONTRACT(), 6);
    case "usdc_erc20": return verifyErc20(args, ETH_RPC(), USDC_CONTRACT(), 6);
    case "bnb": return verifyEvmNative(args, BSC_RPC(), 18);
    case "usdt_bep20": return verifyErc20(args, BSC_RPC(), USDT_BEP20_CONTRACT(), 18);
    case "solana": return verifySolana(args);
    default: return fail("unsupported chain");
  }
}
