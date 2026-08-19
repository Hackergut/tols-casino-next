import { db } from "@/lib/db";
import { verifyDeposit, listIncoming, supportsHashlessMatch } from "@/lib/payment/chain-verifier";
import { sameUniqueAmount } from "@/lib/payment/deposit-amount";
import { fireTelegramAlert } from "@/lib/telegram";
import { CHAINS } from "@/lib/chains";

/*
 * Deposit watcher (server only).
 *
 * Two ways a pending deposit gets credited, both fail-closed and idempotent:
 *
 *   Pass A — the player pasted a real tx hash. We ask the chain verifier for
 *   on-chain proof (mined, paid to our address, moved >= the claimed amount).
 *
 *   Pass B — no hash. Each pending deposit carries a UNIQUE crypto amount
 *   (fingerprinted at creation), so we list what actually landed on the receive
 *   address and match by that exact amount. This is what makes the tx-hash
 *   optional for the player.
 *
 * Idempotency: crediting flips credited:false→true inside a transaction with a
 * conditional updateMany, and the (chain, txHash) unique index means a tx can
 * only ever be claimed once. A verifier/listing error simply leaves rows
 * pending — a broken provider can never cause a credit. Crediting always uses
 * `amountUsd` (the wallet is USD-denominated); `amount` is the chain-native unit
 * used only for on-chain matching.
 */

export interface WatchDetail {
  txHash: string;
  chain: string;
  status: string;
}

export interface WatchResult {
  checked: number;
  credited: number;
  failed: number;
  details: WatchDetail[];
}

async function creditDeposit(depId: string, userId: string, amountUsd: number, txHash?: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const upd = await tx.casinoDeposit.updateMany({
      where: { id: depId, credited: false },
      data: txHash
        ? { status: "confirmed", credited: true, txHash }
        : { status: "confirmed", credited: true },
    });
    if (upd.count === 0) return false;
    await tx.casinoWallet.update({
      where: { userId },
      data: { balance: { increment: amountUsd } },
    });
    return true;
  });
}

async function alertCredited(userId: string, chain: string, amountUsd: number, currency: string, txHash: string, confirmations: number) {
  const player = await db.casinoUser
    .findUnique({ where: { id: userId }, select: { username: true } })
    .catch(() => null);
  fireTelegramAlert({
    event: "deposit",
    title: "Deposit auto-credited",
    message:
      `User: ${player?.username ?? userId}\n` +
      `Chain: ${CHAINS[chain]?.name ?? chain}\n` +
      `Amount: $${amountUsd} ${currency}\n` +
      `Tx: ${txHash}\n` +
      `Confirmations: ${confirmations}`,
  });
}

export async function watchDeposits(limit = 50): Promise<WatchResult> {
  const details: WatchDetail[] = [];
  let credited = 0;
  let failed = 0;

  // ── Pass A: deposits that carry a real tx hash ──
  const withHash = await db.casinoDeposit.findMany({
    where: {
      credited: false,
      status: "pending",
      txHash: { not: { startsWith: "pending_" } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const passAChains = Array.from(new Set(withHash.map((d) => d.chain)));
  const passAAddrRows = await db.depositAddress.findMany({ where: { chain: { in: passAChains } } });
  const passAAddrByChain = new Map(passAAddrRows.map((r) => [r.chain, r]));

  for (const dep of withHash) {
    const addrRow = passAAddrByChain.get(dep.chain);
    if (!addrRow || !addrRow.enabled || !addrRow.address) {
      details.push({ txHash: dep.txHash, chain: dep.chain, status: "address not configured" });
      continue;
    }

    const v = await verifyDeposit({
      chain: dep.chain,
      txHash: dep.txHash,
      expectedAddress: addrRow.address,
      expectedAmount: dep.amount,
      minConfirmations: addrRow.minConfirmations ?? 2,
    });

    if (v.confirmed && v.toAddressMatches && v.amountMatches) {
      const claimed = await creditDeposit(dep.id, dep.userId, dep.amountUsd);
      if (claimed) {
        credited++;
        details.push({ txHash: dep.txHash, chain: dep.chain, status: "credited" });
        await alertCredited(dep.userId, dep.chain, dep.amountUsd, dep.currency, dep.txHash, v.confirmations);
      } else {
        details.push({ txHash: dep.txHash, chain: dep.chain, status: "already credited (skipped)" });
      }
    } else if (!v.found) {
      details.push({ txHash: dep.txHash, chain: dep.chain, status: "not found on-chain yet" });
    } else {
      details.push({
        txHash: dep.txHash,
        chain: dep.chain,
        status: `not creditable (conf=${v.confirmations} toAddr=${v.toAddressMatches} amount=${v.amountMatches}${v.error ? " " + v.error : ""})`,
      });
      if (v.error) failed++;
    }
  }

  // ── Pass B: hash-less deposits matched by unique amount ──
  const hashless = await db.casinoDeposit.findMany({
    where: {
      credited: false,
      status: "pending",
      txHash: { startsWith: "pending_" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const byChain = new Map<string, typeof hashless>();
  for (const d of hashless) {
    if (!supportsHashlessMatch(d.chain)) {
      details.push({ txHash: d.txHash, chain: d.chain, status: "awaiting tx hash (chain not listable)" });
      continue;
    }
    const arr = byChain.get(d.chain) ?? [];
    arr.push(d);
    byChain.set(d.chain, arr);
  }

  const passBChains = Array.from(byChain.keys());
  const passBAddrRows = await db.depositAddress.findMany({ where: { chain: { in: passBChains } } });
  const passBAddrByChain = new Map(passBAddrRows.map((r) => [r.chain, r]));

  for (const [chain, deps] of byChain) {
    const addrRow = passBAddrByChain.get(chain);
    if (!addrRow || !addrRow.enabled || !addrRow.address) {
      for (const d of deps) details.push({ txHash: d.txHash, chain, status: "address not configured" });
      continue;
    }

    const incoming = await listIncoming(chain, addrRow.address);
    const minConf = addrRow.minConfirmations ?? 2;
    const claimedIds = new Set<string>();

    for (const inc of incoming) {
      if (inc.confirmations < minConf) continue;
      // Exactly one pending deposit must match this incoming amount. Zero =
      // nothing to credit; more than one = ambiguous, so we skip to stay safe.
      const matches = deps.filter((d) => !claimedIds.has(d.id) && sameUniqueAmount(chain, d.amount, inc.amount));
      if (matches.length !== 1) continue;
      const dep = matches[0];

      // Guard against reusing a tx hash already recorded for this chain.
      const dup = await db.casinoDeposit.findFirst({ where: { chain, txHash: inc.txHash } });
      if (dup) continue;

      const claimed = await creditDeposit(dep.id, dep.userId, dep.amountUsd, inc.txHash);
      if (claimed) {
        claimedIds.add(dep.id);
        credited++;
        details.push({ txHash: inc.txHash, chain, status: "credited (hash-less match)" });
        await alertCredited(dep.userId, chain, dep.amountUsd, dep.currency, inc.txHash, inc.confirmations);
      }
    }

    for (const d of deps) {
      if (!claimedIds.has(d.id)) details.push({ txHash: d.txHash, chain, status: "awaiting matching payment" });
    }
  }

  return { checked: withHash.length + hashless.length, credited, failed, details };
}
