import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { sendMail, appUrl } from "@/lib/mailer";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

// POST /api/auth/resend-verification — re-send the email verification link.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("resend", LIMITS.auth);
  if (limited) return limited;
  const user = await getSession();
  if (user.emailVerified) return err("Already verified", 400);
  const token = randomBytes(16).toString("hex");
  await db.casinoUser.update({ where: { id: user.id }, data: { emailVerifyToken: token } });
  const link = `${appUrl()}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Verify your TOLS Casino account",
    text: `Verify: ${link}`,
    html: `<p>Verify your email: <a href="${link}">${link}</a></p>`,
  }).catch(() => {});
  return ok({ sent: true });
}
