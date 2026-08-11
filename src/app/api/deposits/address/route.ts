import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, Unauthorized } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { CHAINS, isValidChain } from "@/lib/chains";
import QRCode from "qrcode";

// GET /api/deposits/address?chain=btc&amount=100
// Returns the static receive address for the chain (set by an admin from Trust
// Wallet) and a QR code encoding the payment URI. Watch-only: the server has no
// private key and cannot move funds.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Unauthorized) return err("Sign in to deposit", 401);
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain") ?? "";
  const amountRaw = searchParams.get("amount");
  const amount = amountRaw ? Number(amountRaw) : undefined;

  if (!isValidChain(chain)) return err("Unsupported chain", 400);

  const record = await db.depositAddress.findUnique({ where: { chain } });
  if (!record || !record.enabled || !record.address) {
    return err("Deposits for this chain are not available yet", 503);
  }

  const meta = CHAINS[chain];
  const uri = meta.uri(record.address, amount, record.memo || undefined);

  // Generate a QR of the payment URI as a PNG data URL.
  const qr = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0c0e17", light: "#ffffff" },
  }).catch(() => null);

  return ok({
    chain,
    name: meta.name,
    symbol: meta.symbol,
    color: meta.color,
    address: record.address,
    memo: record.memo || null,
    minConfirmations: record.minConfirmations,
    uri,
    qr, // data:image/png;base64,...
    userRef: user.id.slice(0, 8), // shown to user so support can match a payment
  });
}
