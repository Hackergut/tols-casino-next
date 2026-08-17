import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { err, ok } from "@/lib/session";
import { shuffledShoe } from "@/lib/blackjack-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { serverSeed?: string; serverSeedHash?: string; clientSeed?: string; nonce?: number } | null;
  if (!body?.serverSeed || !body.serverSeedHash || !body.clientSeed || !Number.isInteger(body.nonce)) return err("serverSeed, serverSeedHash, clientSeed and nonce are required", 400);
  const hash = createHash("sha256").update(body.serverSeed).digest("hex");
  if (hash !== body.serverSeedHash) return err("Server seed does not match commitment", 400);
  const shoe = shuffledShoe(body.serverSeed, body.clientSeed, body.nonce!);
  const deal = [shoe.pop(), shoe.pop(), shoe.pop(), shoe.pop()];
  return ok({ verified: true, dealOrder: deal, cardsAfterBurn: 311 });
}
