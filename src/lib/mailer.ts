/*
 * Outbound email. Pluggable:
 *   - prod: Resend HTTP API (RESEND_API_KEY + MAIL_FROM) — no extra dependency.
 *   - dev / not configured: logs the message (incl. the link) to the server
 *     console so verification/reset flows are testable without SMTP.
 * APP_URL is the public base used to build links (set it to the domain in prod,
 * the tunnel URL while testing).
 */
export interface MailInput { to: string; subject: string; html: string; text: string; }

export async function sendMail(m: MailInput): Promise<{ channel: "resend" | "dev-log" }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (key && from) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!r.ok) throw new Error("resend " + r.status);
    return { channel: "resend" };
  }
  // Dev fallback when no mail provider is configured. Gated to non-production
  // so recipient addresses and reset tokens never land in production logs.
  if (process.env.NODE_ENV !== "production") {
    console.log("[MAIL][DEV]", m.to, "|", m.subject, "|", m.text);
  }
  return { channel: "dev-log" };
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
