import { db } from "@/lib/db";
import { verifyDeposit } from "@/lib/payment/chain-verifier";
import { fireTelegramAlert } from "@/lib/telegram";
import { CHAINS } from "@/lib/chains";

/*
 * Deposit watcher (server only).
 *
 * Iterates pending, not-yet-credited deposits that carry a real txHash, and
 * asks the chain verifier for on-chain proof. When the tx is confirmed, paid to
 * the platform's configured receive address, and moves >= the claimed amount,
 * the deposit is credited atomically: a conditional updateMany on
 * credited:false flips it and increments the wallet in the same transaction.
 *
 * Idempotent by design: the (chain, txHash) unique constraint plus the
 * credited:false guard means a concurrent watcher run, a manual admin confirm,
 * or a re-run after a crash can never double-credit. Fail-closed: a verifier
 * error or an unconfirmed/mismatched tx simply leaves the row pending.
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

export async function watchDeposits(limit = 50): Promise<WatchResult> {
  const pending = await db.casinoDeposit.findMany({
    where: {
      credited: false,
      status: "pending",
      txHash: { not: { startsWith: "pending_" } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const details: WatchDetail[] = [];
  let credited = 0;
  let failed = 0;

  for (const dep of pending) {
    const addrRow = await db.depositAddress.findUnique({ where: { chain: dep.chain } });
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
      const claimed = await db.$transaction(async (tx) => {
        const upd = await tx.casinoDeposit.updateMany({
          where: { id: dep.id, credited: false },
          data: { status: "confirmed", credited: true },
        });
        if (upd.count === 0) return false;
        await tx.casinoWallet.update({
          where: { userId: dep.userId },
          data: { balance: { increment: dep.amount } },
        });
        return true;
      });

      if (claimed) {
        credited++;
        details.push({ txHash: dep.txHash, chain: dep.chain, status: "credited" });
        const player = await db.casinoUser
          .findUnique({ where: { id: dep.userId }, select: { username: true } })
          .catch(() => null);
        fireTelegramAlert({
          event: "deposit",
          title: "Deposit auto-credited",
          message:
            `User: ${player?.username ?? dep.userId}\n` +
            `Chain: ${CHAINS[dep.chain]?.name ?? dep.chain}\n` +
            `Amount: ${dep.amount} ${dep.currency}\n` +
            `Tx: ${dep.txHash}\n` +
            `Confirmations: ${v.confirmations}`,
        });
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

  return { checked: pending.length, credited, failed, details };
}
