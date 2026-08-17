import { NextRequest } from "next/server";
import {
  tg,
  esc,
  appUrl,
  sendMessage,
  answerCallback,
  miniAppButton,
  type InlineButton,
} from "@/lib/telegram-api";

/*
 * Telegram bot webhook.
 *
 * Everything the bot can do arrives here as an Update. The bot is deliberately
 * a thin shell around the Mini App: it does not run games, hold balances or
 * take bets in chat. Chat is an untrusted, unauthenticated surface — a message
 * proves only that some Telegram account sent text, so anything touching money
 * happens inside the Mini App where initData is HMAC-verified against the bot
 * token and a real session exists.
 *
 * That is also why /balance does not print a balance: see the handler.
 *
 * Security: Telegram signs nothing, so the only proof an update is genuine is
 * the secret token header configured with setWebhook. It is compared in
 * constant time and the route refuses everything else.
 *
 * The database-backed helpers (Stars crediting, operational alerts) are
 * imported lazily inside the handlers rather than at module scope. A static
 * import pulls Prisma in at module load, so if the client cannot initialise
 * the whole route 500s BEFORE the secret check runs — turning an
 * authentication failure into a server error and, worse, making an
 * unauthenticated caller indistinguishable from a genuine one.
 */

export const dynamic = "force-dynamic";

/* ───────────────────────────── Types ───────────────────────────── */

interface TgChat { id: number; type?: string }
interface TgFrom { id: number; first_name?: string; username?: string }
interface TgMessage {
  chat?: TgChat;
  from?: TgFrom;
  text?: string;
  successful_payment?: { invoice_payload: string; total_amount?: number };
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: { id: string; data?: string; from?: TgFrom; message?: TgMessage };
  pre_checkout_query?: { id: string };
}

/* ─────────────────────────── Verification ─────────────────────────── */

/** Constant-time string compare, to avoid leaking the secret by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ──────────────────────────── Commands ──────────────────────────── */

const GAMES: Array<{ id: string; label: string }> = [
  { id: "dice", label: "🎲 Dice" },
  { id: "crash", label: "📈 Crash" },
  { id: "mines", label: "💣 Mines" },
  { id: "plinko", label: "🔻 Plinko" },
  { id: "wheel", label: "🎡 Wheel" },
  { id: "roulette", label: "🎰 Roulette" },
];

/** Keyboard that opens the Mini App, plus a game shortcut grid. */
function playKeyboard(): InlineButton[][] {
  const open = miniAppButton("🎮 Open TOLS Casino");
  const rows: InlineButton[][] = [];
  if (open) rows.push([open]);

  // Two per row keeps the labels readable on a narrow phone.
  const shortcuts = GAMES.map((g) => miniAppButton(g.label, `/?game=${g.id}`)).filter(
    (b): b is InlineButton => b !== null,
  );
  for (let i = 0; i < shortcuts.length; i += 2) rows.push(shortcuts.slice(i, i + 2));
  return rows;
}

/** Sent when APP_URL is missing or not HTTPS — the buttons cannot be built. */
const NOT_CONFIGURED =
  "⚠️ The casino link is not configured yet.\n\nSet <code>APP_URL</code> to the public HTTPS address of the site and re-run the webhook setup.";

async function handleCommand(cmd: string, chatId: number, from?: TgFrom): Promise<void> {
  const name = from?.first_name ? esc(from.first_name) : "there";
  const buttons = playKeyboard();
  const configured = buttons.length > 0;

  switch (cmd) {
    case "/start":
      await sendMessage({
        chatId,
        text: configured
          ? `👋 Welcome to <b>TOLS Casino</b>, ${name}!\n\n` +
            `Provably fair originals — every result is signed by the server before you bet, ` +
            `and you can verify it afterwards.\n\n` +
            `Tap below to play, or use /help to see what I can do.`
          : NOT_CONFIGURED,
        buttons: configured ? buttons : undefined,
      });
      return;

    case "/play":
      await sendMessage({
        chatId,
        text: configured ? "Pick a game 👇" : NOT_CONFIGURED,
        buttons: configured ? buttons : undefined,
      });
      return;

    case "/balance":
      /*
       * A chat message authenticates nobody: `from.id` is not proof of a
       * session, and mapping it to a wallet in chat would leak a balance to
       * anyone who could get the bot to reply in a group. The Mini App is the
       * only place where identity is cryptographically established, so the
       * balance is shown there.
       */
      await sendMessage({
        chatId,
        text:
          "💰 Your balance lives in the casino, where your Telegram identity is " +
          "cryptographically verified.\n\nOpen it below to see it and to top up.",
        buttons: configured ? [[miniAppButton("💰 Open wallet", "/?section=wallet")!]] : undefined,
      });
      return;

    case "/help":
      await sendMessage({
        chatId,
        text:
          "<b>TOLS Casino — commands</b>\n\n" +
          "/start — open the casino\n" +
          "/play — jump straight into a game\n" +
          "/balance — view your wallet\n" +
          "/support — get help\n" +
          "/help — this message\n\n" +
          "All games run inside the Mini App. Every round is provably fair: " +
          "the server commits to a hashed seed before your bet and reveals it on request.",
        buttons: configured ? buttons.slice(0, 1) : undefined,
      });
      return;

    case "/support": {
      const handle = process.env.TELEGRAM_SUPPORT_HANDLE?.trim();
      const base = appUrl();
      const rows: InlineButton[][] = [];
      if (handle) {
        rows.push([{ text: "💬 Contact support", url: `https://t.me/${handle.replace(/^@/, "")}` }]);
      }
      if (base) rows.push([{ text: "❓ Help centre", url: `${base}/help` }]);
      await sendMessage({
        chatId,
        text:
          "<b>Need a hand?</b>\n\n" +
          "For account, deposit or withdrawal questions, reach us below. " +
          "We never ask for your password, seed phrase or 2FA codes.",
        buttons: rows.length ? rows : undefined,
      });
      return;
    }

    default:
      await sendMessage({
        chatId,
        text: "I don't know that command. Try /help.",
      });
  }
}

/* ───────────────────────────── Handler ───────────────────────────── */

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";

  // Fail closed. Without a configured secret the endpoint stays shut rather
  // than accepting unauthenticated updates.
  if (!secret || !safeEqual(got, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  // Always 200 to Telegram once authenticated: a non-2xx makes it retry the
  // same update for hours, and a malformed body will never parse on retry.
  if (!update) return Response.json({ ok: true });

  try {
    await route(update);
  } catch (e) {
    console.error("[telegram/webhook]", e);
  }

  return Response.json({ ok: true });
}

async function route(update: TgUpdate): Promise<void> {
  /* Stars checkout: must be answered within 10s or the payment is cancelled. */
  if (update.pre_checkout_query) {
    await tg("answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    });
    return;
  }

  /* Stars payment completed → credit the wallet (idempotent downstream). */
  const paid = update.message?.successful_payment;
  if (paid) {
    const chatId = update.message?.chat?.id;
    const { creditStarsDeposit } = await import("@/lib/payment/stars");
    const { fireTelegramAlert } = await import("@/lib/telegram");
    const r = await creditStarsDeposit(paid.invoice_payload);
    if (r.credited) {
      fireTelegramAlert({
        event: "stars_paid",
        title: "Stars deposit paid",
        message: `User: ${r.userId}\nUSDT credited: ${r.usdt}`,
      });
      if (chatId) {
        await sendMessage({
          chatId,
          text: `✅ Payment received — <b>${r.usdt} USDT</b> added to your balance.`,
          buttons: [[miniAppButton("🎮 Back to the casino")].filter((b): b is InlineButton => b !== null)],
        });
      }
    } else if (chatId) {
      // Already credited, or an unknown payload. Never silently swallow it:
      // the player has paid and needs to know where the money went.
      await sendMessage({
        chatId,
        text:
          "We received your payment. If your balance has not updated within a " +
          "few minutes, contact /support with the time of the transaction.",
      });
    }
    return;
  }

  /* Inline buttons. */
  if (update.callback_query) {
    const q = update.callback_query;
    await answerCallback({ id: q.id });
    const chatId = q.message?.chat?.id;
    if (chatId && q.data?.startsWith("cmd:")) {
      await handleCommand("/" + q.data.slice(4), chatId, q.from);
    }
    return;
  }

  /* Text commands. */
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text?.trim();
  if (!chatId || !text) return;

  if (text.startsWith("/")) {
    // Strip the @botname suffix Telegram appends in group chats, and any
    // deep-link argument after the command.
    const cmd = text.split(/[\s@]/)[0].toLowerCase();
    await handleCommand(cmd, chatId, msg?.from);
    return;
  }

  // Only answer free text in private chats. Replying to every message in a
  // group would make the bot unusable there.
  if (msg?.chat?.type === "private") {
    await sendMessage({ chatId, text: "Use /help to see what I can do." });
  }
}
