import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { fireTelegramAlert } from "@/lib/telegram";
import { ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { randomBytes } from "crypto";
import { sendMail, appUrl } from "@/lib/mailer";
import { isOfAge, MIN_AGE } from "@/lib/compliance";
import { WEB_WELCOME_BONUS } from "@/lib/welcome-bonus";

const RANDOM_COLORS = ["#ccff00", "#22d3ee", "#a855f7", "#f59e0b", "#ec4899", "#4ade80"];

export async function POST(req: NextRequest) {
  const limited = await rateLimit("auth", LIMITS.auth);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const referralCode = String(body.referralCode ?? "").trim();

  // ── Validation ──
  if (username.length < 3 || username.length > 20) return err("Username must be 3–20 characters", 400);
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return err("Username may only contain letters, numbers, and underscores", 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address", 400);
  if (password.length < 8) return err("Password must be at least 8 characters", 400);

  // ── Age verification (legal minimum) ──
  // Calendar-correct, not an average-year division: 365.25 days per year drifts
  // by up to a day around a birthday, which on the boundary either admits a
  // minor or refuses someone who turned 18 today. Both are wrong here.
  const LEGAL_AGE = Number(process.env.LEGAL_AGE ?? MIN_AGE);
  const dobRaw = String(body.dateOfBirth ?? "");
  const dob = new Date(dobRaw);
  if (!dobRaw || isNaN(dob.getTime())) return err("Date of birth is required", 400);
  if (dob.getTime() > Date.now()) return err("Invalid date of birth", 400);
  if (!isOfAge(dob, LEGAL_AGE)) {
    return err("You must be at least " + LEGAL_AGE + " years old to register", 403);
  }
  // Implausible age — a typo'd year, not a real player.
  if (isOfAge(dob, 130)) return err("Invalid date of birth", 400);

  // ── Uniqueness ──
  const existing = await db.casinoUser.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return err(existing.email === email ? "An account with that email already exists" : "That username is taken", 409);
  }

  const passwordHash = await hashPassword(password);
  const avatarColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

  const verifyToken = randomBytes(16).toString("hex");
  const user = await db.casinoUser.create({
    data: {
      username,
      email,
      password: passwordHash,
      role: "user",
      status: "active",
      avatarColor,
      level: 1,
      xp: 0,
      dateOfBirth: dob,
      kycStatus: "unverified",
      emailVerifyToken: verifyToken,
      wallet: { create: { balance: WEB_WELCOME_BONUS, currency: "USDT", vipLevel: 1, totalWagered: 0, totalWon: 0 } },
    },
    include: { wallet: true },
  });

  // ── If a valid referral code was supplied, attach the referral ──
  if (referralCode) {
    const affiliate = await db.affiliate.findUnique({ where: { referralCode } });
    if (affiliate) {
      await db.referral.create({
        data: { affiliateId: affiliate.id, playerAlias: username, status: "active" },
      });
      await db.affiliate.update({
        where: { id: affiliate.id },
        data: { totalReferrals: { increment: 1 } },
      });
    }
  }

  await createSession(user.id);

  // Send verification email (dev: logged to console; prod: Resend).
  sendMail({
    to: email,
    subject: "Verify your TOLS Casino account",
    text: "Verify: " + appUrl() + "/api/auth/verify-email?token=" + verifyToken,
    html: '<p>Verify your email: <a href="' + appUrl() + '/api/auth/verify-email?token=' + verifyToken + '">' + appUrl() + '/api/auth/verify-email?token=' + verifyToken + '</a></p>',
  }).catch(() => {});

  // ── Telegram: new registration ──
  fireTelegramAlert({
    event: "registration",
    title: "🆕 New registration",
    message: `User: ${username}\nEmail: ${email}${referralCode ? `\nReferral: ${referralCode}` : ""}\nTime: ${new Date().toISOString()}`,
  });

  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
    level: user.level,
    balance: user.wallet?.balance ?? 0,
    currency: user.wallet?.currency ?? "USDT",
    vipLevel: user.wallet?.vipLevel ?? 1,
  });
}
