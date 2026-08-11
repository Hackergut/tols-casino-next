import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { sendMail, appUrl } from "@/lib/mailer";
import { randomBytes } from "crypto";

// POST /api/auth/forgot-password { email } — emails a reset link if the account
// exists. Always returns 200 (no account enumeration).
export async function POST(req: NextRequest) {
  const limited = await rateLimit("forgot", LIMITS.auth);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return err("Email required", 400);
  const user = await db.casinoUser.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.casinoUser.update({ where: { id: user.id }, data: { resetToken: token, resetExpires: expires } });
    const link = `${appUrl()}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "Reset your TOLS Casino password",
      text: `Reset link (expires in 1 hour): ${link}`,
      html: `<p>Reset your password: <a href="${link}">${link}</a></p><p>Expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    }).catch(() => {});
  }
  return ok({ sent: true });
}
