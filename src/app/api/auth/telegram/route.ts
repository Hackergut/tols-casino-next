import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import { fireTelegramAlert } from "@/lib/telegram";

// POST /api/auth/telegram — sign in (or silently create) a Telegram Mini App
// user. The client sends the initData string Telegram injects; the server
// validates its HMAC signature, so the account is reachable only via Telegram
// (no password is set — a random opaque hash blocks normal password login).
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return err("Telegram login is not configured", 503);

  // Optional welcome balance for new Telegram players (TEST/promo only; 0 = none).
  const WELCOME = Number(process.env.TELEGRAM_WELCOME_BONUS ?? 0) || 0;
  const body = await req.json().catch(() => null);
  const initData = String(body?.initData ?? "");
  if (!initData) return err("initData is required", 400);

  const parsed = validateTelegramInitData(initData, botToken);
  if (!parsed) return err("Invalid or expired Telegram credentials", 401);

  const tgId = String(parsed.user.id);
  const username = parsed.user.username || `tg_${tgId}`;

  let user = await db.casinoUser.findUnique({
    where: { telegramId: tgId },
    include: { wallet: true },
  });

  if (!user) {
    try {
      user = await db.casinoUser.create({
        data: {
          username,
          email: `tg_${tgId}@telegram.local`,
          password: randomBytes(16).toString("hex"),
          role: "user",
          status: "active",
          telegramId: tgId,
          kycStatus: "unverified",
          wallet: { create: { balance: WELCOME, currency: "USDT" } },
        },
        include: { wallet: true },
      });
      fireTelegramAlert({
        event: "registration",
        title: "Telegram sign-up",
        message: `User: ${username}\nTG id: ${tgId}\nName: ${parsed.user.first_name ?? ""}`,
      });
    } catch (e) {
      // username/email collision: make them unique and retry once.
      const suffix = "_" + randomBytes(2).toString("hex");
      user = await db.casinoUser.create({
        data: {
          username: username + suffix,
          email: `tg_${tgId}_${randomBytes(2).toString("hex")}@telegram.local`,
          password: randomBytes(16).toString("hex"),
          role: "user",
          status: "active",
          telegramId: tgId,
          kycStatus: "unverified",
          wallet: { create: { balance: WELCOME, currency: "USDT" } },
        },
        include: { wallet: true },
      });
    }
  }

  await createSession(user.id);
  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
    level: user.level,
    balance: user.wallet?.balance ?? 0,
    currency: user.wallet?.currency ?? "USDT",
    vipLevel: user.wallet?.vipLevel ?? 1,
    telegram: true,
  });
}
