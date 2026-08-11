import { NextRequest } from "next/server";
import { creditStarsDeposit } from "@/lib/payment/stars";
import { fireTelegramAlert } from "@/lib/telegram";

async function tg(token: string, method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!botToken || !secret || got !== secret) return new Response("Unauthorized", { status: 401 });

  const update = await req.json().catch(() => null);
  if (!update) return Response.json({ ok: true });

  // /start → welcome text (user taps the ☰ menu button to open the Web App)
  if (update.message?.text === "/start" && update.message?.chat?.id) {
    await tg(botToken, "sendMessage", {
      chat_id: update.message.chat.id,
      text: "Welcome to TOLS Casino!\n\nTap the menu button below to open the casino.",
    }).catch(() => {});
    return Response.json({ ok: true });
  }

  // pre_checkout_query → allow (for Telegram Stars payments)
  if (update.pre_checkout_query) {
    await tg(botToken, "answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    }).catch(() => {});
    return Response.json({ ok: true });
  }

  // successful_payment (Telegram Stars) → credit
  const sp = update.message?.successful_payment;
  if (sp) {
    const payload: string = sp.invoice_payload;
    const r = await creditStarsDeposit(payload);
    if (r.credited) {
      fireTelegramAlert({
        event: "registration",
        title: "Stars deposit paid",
        message: `User: ${r.userId}\nUSDT credited: ${r.usdt}`,
      });
    }
  }

  return Response.json({ ok: true });
}
