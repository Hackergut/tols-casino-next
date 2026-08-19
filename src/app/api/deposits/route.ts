import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getCurrentUser, Unauthorized } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { isValidChain, CHAINS } from "@/lib/chains";
import { computeUniqueAmount } from "@/lib/payment/deposit-amount";
import { fireTelegramAlert } from "@/lib/telegram";
import QRCode from "qrcode";

// GET /api/deposits — current user's deposit history
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok([]);
  const deposits = await db.casinoDeposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(
    deposits.map((d) => ({
      id: d.id,
      chain: d.chain,
      amount: d.amount,
      amountUsd: d.amountUsd,
      currency: d.currency,
      status: d.status,
      credited: d.credited,
      txHash: d.txHash.startsWith("pending_") ? null : d.txHash,
      createdAt: d.createdAt.toISOString(),
    }))
  );
}

async function buildQr(uri: string): Promise<string | null> {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0c0e17", light: "#ffffff" },
  }).catch(() => null);
}

// POST /api/deposits
//   • create intent:  { chain, amountUsd }  → reserves a UNIQUE crypto amount,
//     returns the locked address + QR + exact amount to send. Credited later by
//     the watcher (by amount, no hash needed).
//   • attach hash:    { depositId, txHash } → speeds up crediting for an intent
//     the player already paid.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Unauthorized) return err("Sign in to deposit", 401);
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  // ── Attach-hash path ──
  const depositId = body.depositId ? String(body.depositId) : "";
  if (depositId) {
    const txHash = String(body.txHash ?? "").trim();
    if (!txHash) return err("Missing transaction hash", 400);
    const dep = await db.casinoDeposit.findFirst({ where: { id: depositId, userId: user.id } });
    if (!dep) return err("Deposit not found", 404);
    if (dep.credited) return err("Deposit already credited", 409);
    // Only overwrite the pending_ placeholder; never let a client relabel a hash.
    if (!dep.txHash.startsWith("pending_")) return ok({ id: dep.id, status: dep.status, message: "Transaction already recorded." });
    // Guard the (chain, txHash) unique index.
    const clash = await db.casinoDeposit.findFirst({ where: { chain: dep.chain, txHash } });
    if (clash) return err("That transaction hash is already registered", 409);
    await db.casinoDeposit.update({ where: { id: dep.id }, data: { txHash } });
    return ok({ id: dep.id, status: dep.status, message: "Transaction registered — crediting after on-chain confirmation." });
  }

  // ── Create-intent path ──
  const chain = String(body.chain ?? "");
  const amountUsd = Number(body.amountUsd ?? body.amount);
  const currency = String(body.currency ?? (CHAINS[chain]?.symbol ?? "USDT"));

  if (!isValidChain(chain)) return err("Unsupported chain", 400);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return err("Enter a valid amount", 400);

  const record = await db.depositAddress.findUnique({ where: { chain } });
  if (!record || !record.enabled || !record.address) {
    return err("Deposits for this chain are not available yet", 503);
  }

  const meta = CHAINS[chain];

  // Reuse a recent, still-unpaid intent for the same (user, chain, USD) so
  // re-opening the panel doesn't pile up duplicate pending rows.
  const reuseSince = new Date(Date.now() - 30 * 60_000);
  const existing = await db.casinoDeposit.findFirst({
    where: {
      userId: user.id,
      chain,
      amountUsd,
      credited: false,
      status: "pending",
      txHash: { startsWith: "pending_" },
      createdAt: { gte: reuseSince },
    },
    orderBy: { createdAt: "desc" },
  });

  let deposit = existing;
  if (!deposit) {
    // Collect amounts already reserved on this chain to avoid a fingerprint clash.
    const pending = await db.casinoDeposit.findMany({
      where: { chain, credited: false, status: "pending" },
      select: { amount: true },
    });
    const unique = await computeUniqueAmount(chain, amountUsd, pending.map((p) => p.amount));
    if (!unique) return err("Price feed unavailable — try again in a moment", 503);

    deposit = await db.casinoDeposit.create({
      data: {
        userId: user.id,
        chain,
        txHash: `pending_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        amount: unique.amount,
        amountUsd,
        currency,
        status: "pending",
        credited: false,
        toAddress: record.address,
      },
    });

    fireTelegramAlert({
      event: "deposit_pending",
      title: "⏳ Deposit pending",
      message:
        `User: ${user.username}\n` +
        `Chain: ${meta.name}\n` +
        `Send: ${unique.amount} ${meta.symbol} (=$${amountUsd})\n` +
        `To: ${record.address}\n` +
        `Deposit id: ${deposit.id}`,
    });
  }

  const uri = meta.uri(record.address, deposit.amount, record.memo || undefined);
  const qr = await buildQr(uri);

  return ok({
    id: deposit.id,
    chain,
    name: meta.name,
    symbol: meta.symbol,
    color: meta.color,
    address: record.address,
    memo: record.memo || null,
    minConfirmations: record.minConfirmations,
    amount: deposit.amount, // exact crypto amount to send (native unit)
    amountUsd: deposit.amountUsd,
    uri,
    qr,
    status: deposit.status,
    userRef: user.id.slice(0, 8),
    message: "Send the exact amount shown. Your balance is credited automatically once it confirms on-chain.",
  });
}
