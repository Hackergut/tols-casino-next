import { NextRequest } from "next/server";
import { db } from "@/lib/db";

function page(msg: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;background:#0c0e17;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center"><div><h1 style="color:#ccff00;margin:0 0 12px">TOLS Casino</h1><p>${msg}</p></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// GET /api/auth/verify-email?token=... — marks the account email-verified.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return page("Missing token.");
  const user = await db.casinoUser.findUnique({ where: { emailVerifyToken: token } });
  if (!user) return page("This verification link is invalid or already used.");
  await db.casinoUser.update({ where: { id: user.id }, data: { emailVerified: new Date(), emailVerifyToken: null } });
  return page("Email verified. You can close this tab and return to TOLS Casino.");
}
