import { db } from "@/lib/db";

// ── Telegram notifications ──────────────────────────────────────────────
// Sends operational alerts (registrations, deposits, withdrawals) to a
// Telegram chat. Config comes from env so no secrets live in code:
//   TELEGRAM_BOT_TOKEN   — from @BotFather
//   TELEGRAM_CHAT_ID     — target chat/channel/group id
//   TELEGRAM_THREAD_ID   — optional topic thread id (supergroups)
//
// Every alert is also persisted to the TelegramNotification table so the
// admin panel's monitoring view has a full audit trail even if delivery fails.

type AlertEvent =
  | "registration"
  | "login"
  | "deposit"
  | "withdrawal"
  | "deposit_pending"
  | "stars_invoice"
  | "stars_paid";

interface AlertInput {
  event: AlertEvent;
  title: string;
  message: string;
}

function esc(s: string): string {
  // Escape HTML for Telegram parse_mode=HTML
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramAlert({ event, title, message }: AlertInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_THREAD_ID;

  // Persist first so we always have a record, even on delivery failure.
  const record = await db.telegramNotification
    .create({
      data: {
        eventType: event,
        title,
        message,
        chatId: chatId ?? "",
        threadId: threadId ?? null,
        status: "pending",
      },
    })
    .catch(() => null);

  if (!token || !chatId) {
    // Not configured — leave the record as pending so the operator can see
    // that alerts are firing but delivery isn't wired up yet.
    if (record) {
      await db.telegramNotification
        .update({
          where: { id: record.id },
          data: { status: "unconfigured", errorMessage: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" },
        })
        .catch(() => {});
    }
    return;
  }

  const text = `<b>${esc(title)}</b>\n${esc(message)}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: threadId ? Number(threadId) : undefined,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const ok = res.ok;
    if (record) {
      await db.telegramNotification
        .update({
          where: { id: record.id },
          data: ok
            ? { status: "sent", sentAt: new Date() }
            : { status: "failed", errorMessage: `HTTP ${res.status}` },
        })
        .catch(() => {});
    }
  } catch (e) {
    if (record) {
      await db.telegramNotification
        .update({
          where: { id: record.id },
          data: { status: "failed", errorMessage: e instanceof Error ? e.message : "send error" },
        })
        .catch(() => {});
    }
  }
}

// Fire-and-forget wrapper so request latency never depends on Telegram.
export function fireTelegramAlert(input: AlertInput): void {
  void sendTelegramAlert(input).catch(() => {});
}
