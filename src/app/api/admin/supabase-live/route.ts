import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.SUPABASE_URL || `https://bnoajspucuigmsiamekm.supabase.co`;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function sbFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/functions/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
      ...(init?.headers as Record<string, string> || {}),
    },
  });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  
  const action = req.nextUrl.searchParams.get("action");
  
  try {
    if (action === "admin-logs") {
      const limit = req.nextUrl.searchParams.get("limit") || "50";
      const target_type = req.nextUrl.searchParams.get("target_type") || "";
      const params = new URLSearchParams({ limit });
      if (target_type) params.set("target_type", target_type);
      const r = await sbFetch(`/get-admin-logs?${params}`);
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    
    if (action === "list-players") {
      const limit = req.nextUrl.searchParams.get("limit") || "50";
      const offset = req.nextUrl.searchParams.get("offset") || "0";
      const is_banned = req.nextUrl.searchParams.get("is_banned") || "";
      const has_override = req.nextUrl.searchParams.get("has_override") || "";
      const params = new URLSearchParams({ limit, offset });
      if (is_banned) params.set("is_banned", is_banned);
      if (has_override) params.set("has_override", has_override);
      const r = await sbFetch(`/list-players?${params}`);
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    
    if (action === "get-games") {
      const r = await sbFetch("/get-games");
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    
    // Default: live stats
    const r = await sbFetch("/get-live-stats");
    const data = await r.json();
    return Response.json({ success: true, data });
  } catch (e: unknown) {
    return Response.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  
  const action = req.nextUrl.searchParams.get("action");
  const body = await req.json();
  
  try {
    if (action === "resolve-alert") {
      const r = await sbFetch("/resolve-alert", { method: "POST", body: JSON.stringify(body) });
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    if (action === "ban-player") {
      const r = await sbFetch("/ban-player", { method: "POST", body: JSON.stringify(body) });
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    if (action === "update-rtp") {
      const r = await sbFetch("/update-rtp", { method: "POST", body: JSON.stringify(body) });
      const data = await r.json();
      return Response.json({ success: true, data });
    }
    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    return Response.json({ success: false, error: String(e) }, { status: 500 });
  }
}
