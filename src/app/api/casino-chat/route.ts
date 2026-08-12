import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/chat?channel=general
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "general";
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));
  const msgs = await db.casinoChatMessage.findMany({
    where: { channel },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return ok(
    msgs.reverse().map((m) => ({
      id: m.id,
      username: m.username,
      avatarColor: m.avatarColor,
      message: m.message,
      channel: m.channel,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

// POST /api/chat
// Simple profanity filter
const PROFANITY = ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "nigger", "faggot", "retard"];
function filterProfanity(text: string): string {
  let filtered = text;
  for (const word of PROFANITY) {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, word[0] + "*".repeat(word.length - 2) + word[word.length - 1]);
  }
  return filtered;
}

export async function POST(req: NextRequest) {
  // getSession() throws in production when there is no logged-in user; without
  // this guard an anonymous send crashed the route with a 500. Chatting
  // requires an account — return a clean 401 the client can act on.
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Sign in to chat", 401);
  }
  if (!user?.username) return err("Sign in to chat", 401);

  const body = await req.json().catch(() => null);
  if (!body?.message) return err("Message required", 400);
  const channel = body.channel || "general";
  const rawMessage = String(body.message).slice(0, 500).trim();
  if (!rawMessage) return err("Empty message", 400);
  const message = filterProfanity(rawMessage);

  const msg = await db.casinoChatMessage.create({
    data: {
      username: user.username,
      avatarColor: user.avatarColor,
      message,
      channel,
    },
  });
  return ok({
    id: msg.id,
    username: msg.username,
    avatarColor: msg.avatarColor,
    message: msg.message,
    channel: msg.channel,
    createdAt: msg.createdAt.toISOString(),
  });
}
