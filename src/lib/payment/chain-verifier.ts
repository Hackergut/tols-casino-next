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

// ── Solana (SOL native and SPL tokens) ──
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

    let matchedAddress = false;
    let amountMatches = false;
    let bestAmount = 0;

    // 1. Native SOL: scan SystemProgram Transfer instructions
    const acctKeys: string[] = (tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
    for (const ix of tx.transaction?.message?.instructions || []) {
      try {
        const dataB = Buffer.from(ix.data, "base64");
        // SystemProgram Transfer discriminator = 2
        if (dataB.length >= 12 && dataB.readUInt32LE(0) === 2) {
          const lam = dataB.readBigUInt64LE(4);
          const toIdx = ix.accounts[1];
          const to = acctKeys[toIdx];
          if (to && sameAddr(to, args.expectedAddress)) {
            matchedAddress = true;
            const solReceived = Number(lam) / 1e9;
            if (amountsClose(solReceived, args.expectedAmount)) {
              amountMatches = true;
              bestAmount = solReceived;
            } else if (!bestAmount) {
              bestAmount = solReceived;
            }
          }
        }
      } catch { /* ignore decode errors per-instruction */ }
    }

    // 2. SPL Tokens: check postTokenBalances against preTokenBalances
    if (!amountMatches && tx.meta?.postTokenBalances) {
      for (const post of tx.meta.postTokenBalances) {
        if (post.owner && sameAddr(post.owner, args.expectedAddress)) {
          const pre = (tx.meta.preTokenBalances || []).find(
            (p: any) => p.accountIndex === post.accountIndex && p.mint === post.mint
          );
          const preAmt = Number(pre?.uiTokenAmount?.uiAmountString || pre?.uiTokenAmount?.uiAmount || 0);
          const postAmt = Number(post.uiTokenAmount?.uiAmountString || post.uiTokenAmount?.uiAmount || 0);
          const received = postAmt - preAmt;

          if (received > 0) {
            matchedAddress = true;
            if (amountsClose(received, args.expectedAmount)) {
              amountMatches = true;
              bestAmount = received;
              break; // exact match found
            } else if (!bestAmount) {
              bestAmount = received;
            }
          }
        }
      }
    }

    if (matchedAddress) {
      return {
        found: true,
        confirmed: confirmations >= args.minConfirmations,
        confirmations,
        toAddressMatches: true,
        amountMatches,
        amountOnChain: bestAmount
      };
    }

    return {
      found: true,
      confirmed: confirmations >= args.minConfirmations,
      confirmations,
      toAddressMatches: false,
      amountMatches: false,
      amountOnChain: null,
      error: "no matching transfer found"
    };
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

/*
 * ── Hash-less matching: list recent INCOMING transactions to an address ──
 *
 * The deposit flow assigns each pending deposit a unique crypto amount (a tiny
 * per-deposit "fingerprint" in the least-significant decimals). That lets the
 * watcher credit a deposit WITHOUT the player pasting a tx hash: it lists what
 * actually landed on the receive address and matches the exact unique amount.
 *
 * Every lister is FAIL-CLOSED: any error returns [] so a flaky provider can
 * never manufacture a phantom incoming payment. Native ETH/BNB/MATIC can't be
 * enumerated on public RPC without an indexer, so those return [] and still
 * require a hash. The common rails — BTC, stablecoins, SOL — are covered.
 */
export interface IncomingTx {
  txHash: string;
  amount: number; // human units credited to the address in this tx
  confirmations: number;
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function padAddressTopic(address: string): string {
  return "0x" + address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

async function listIncomingBtc(address: string): Promise<IncomingTx[]> {
  try {
    const tipRes = await fetch(`${BTC_API()}/blocks/tip/height`);
    const tip = tipRes.ok ? Number(await tipRes.text()) : 0;
    const res = await fetch(`${BTC_API()}/address/${address}/txs`);
    if (!res.ok) return [];
    const txs = await res.json();
    if (!Array.isArray(txs)) return [];
    const out: IncomingTx[] = [];
    for (const tx of txs) {
      let sats = 0;
      for (const o of tx.vout || []) {
        if (o.scriptpubkey_address && sameAddr(o.scriptpubkey_address, address)) sats += Number(o.value || 0);
      }
      if (sats <= 0) continue;
      const confirmed = !!tx.status?.confirmed;
      const bh = tx.status?.block_height ?? 0;
      const confirmations = confirmed && tip ? Math.max(1, tip - bh + 1) : 0;
      out.push({ txHash: tx.txid, amount: sats / 1e8, confirmations });
    }
    return out;
  } catch {
    return [];
  }
}

async function listIncomingErc20(rpc: string, contract: string, decimals: number, address: string): Promise<IncomingTx[]> {
  try {
    const tipHex: string = await evmJsonRpc(rpc, "eth_blockNumber", []);
    const tip = parseInt(tipHex, 16);
    // Recent-only window: deposits are checked minutes after they're sent, and
    // public nodes cap getLogs ranges. Configurable for a private/archive node.
    const lookback = Number(process.env.DEPOSIT_LOG_LOOKBACK || 5000);
    const fromBlock = "0x" + Math.max(0, tip - lookback).toString(16);
    const logs: any[] = await evmJsonRpc(rpc, "eth_getLogs", [
      {
        address: contract,
        topics: [TRANSFER_TOPIC, null, padAddressTopic(address)],
        fromBlock,
        toBlock: "latest",
      },
    ]);
    if (!Array.isArray(logs)) return [];
    const out: IncomingTx[] = [];
    for (const log of logs) {
      const raw = BigInt(log.data || "0x0");
      const block = parseInt(log.blockNumber, 16);
      const confirmations = Number.isFinite(block) ? Math.max(1, tip - block + 1) : 0;
      out.push({ txHash: log.transactionHash, amount: Number(raw) / 10 ** decimals, confirmations });
    }
    return out;
  } catch {
    return [];
  }
}

async function solRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(SOL_RPC(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`sol rpc ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`sol rpc ${JSON.stringify(j.error)}`);
  return j.result;
}

async function listIncomingSolana(address: string): Promise<IncomingTx[]> {
  try {
    const sigs: any[] = await solRpc("getSignaturesForAddress", [address, { limit: 15 }]);
    if (!Array.isArray(sigs)) return [];
    const tip: number = await solRpc("getSlot", [{ commitment: "confirmed" }]).catch(() => 0);
    const out: IncomingTx[] = [];
    for (const s of sigs) {
      if (s.err) continue;
      const tx: any = await solRpc("getTransaction", [
        s.signature,
        { maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]).catch(() => null);
      if (!tx?.meta || !tx.transaction) continue;
      const confirmations = tip && tx.slot ? Math.max(1, tip - tx.slot + 1) : 1;



      // 1. Check native SOL received
      const acctKeys: string[] = (tx.transaction.message?.accountKeys || []).map((k: any) =>
        typeof k === "string" ? k : k.pubkey
      );
      const idx = acctKeys.findIndex((k) => sameAddr(k, address));
      if (idx >= 0) {
        const pre = Number(tx.meta.preBalances?.[idx] ?? 0);
        const post = Number(tx.meta.postBalances?.[idx] ?? 0);
        const lamports = post - pre;
        if (lamports > 0) {
          out.push({ txHash: s.signature, amount: lamports / 1e9, confirmations });

        }
      }

      // 2. Check SPL tokens received
      if (tx.meta.postTokenBalances) {
        for (const postTok of tx.meta.postTokenBalances) {
          if (postTok.owner && sameAddr(postTok.owner, address)) {
            const preTok = (tx.meta.preTokenBalances || []).find(
              (p: any) => p.accountIndex === postTok.accountIndex && p.mint === postTok.mint
            );
            const preAmt = Number(preTok?.uiTokenAmount?.uiAmountString || preTok?.uiTokenAmount?.uiAmount || 0);
            const postAmt = Number(postTok.uiTokenAmount?.uiAmountString || postTok.uiTokenAmount?.uiAmount || 0);
            const received = postAmt - preAmt;
            if (received > 0) {
              out.push({ txHash: s.signature, amount: received, confirmations });

            }
          }
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** List recent incoming transactions to `address` on `chain`. [] when unsupported or on any error (fail-closed). */
export async function listIncoming(chain: string, address: string): Promise<IncomingTx[]> {
  if (!isValidChain(chain) || !address) return [];
  switch (chain) {
    case "btc": return listIncomingBtc(address);
    case "usdt_erc20": return listIncomingErc20(ETH_RPC(), USDT_CONTRACT(), 6, address);
    case "usdc_erc20": return listIncomingErc20(ETH_RPC(), USDC_CONTRACT(), 6, address);
    case "usdt_bep20": return listIncomingErc20(BSC_RPC(), USDT_BEP20_CONTRACT(), 18, address);
    case "solana": return listIncomingSolana(address);
    // Native ETH/BNB/MATIC need an indexer to enumerate — hash still required.
    default: return [];
  }
}

/** True when `chain` supports hash-less matching via listIncoming. */
export function supportsHashlessMatch(chain: string): boolean {
  return ["btc", "usdt_erc20", "usdc_erc20", "usdt_bep20", "solana"].includes(chain);
}
