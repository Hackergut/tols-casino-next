import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/session";

export async function POST() {
  await destroySession();
  return ok({ loggedOut: true });
}
