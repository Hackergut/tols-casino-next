import { NextRequest } from "next/server";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import { evEnvConfigured } from "@/lib/eurovirtuals";
import {
  deleteEurovirtualsConnection,
  eurovirtualsCallbackUrls,
  getEurovirtualsConnection,
  publicEurovirtualsConnection,
  saveEurovirtualsConnection,
  type EurovirtualsConnectionInput,
} from "@/lib/eurovirtuals-connection";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const connection = await getEurovirtualsConnection().catch(() => null);
  return Response.json({
    success: true,
    data: {
      connection: publicEurovirtualsConnection(connection),
      environment: {
        live: evEnvConfigured(),
        apiBase: process.env.EV_API_BASE || "https://api.staging.betkraft.co.uk",
      },
      callbacks: eurovirtualsCallbackUrls(),
      encryptionConfigured: Boolean(process.env.CONNECTION_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET),
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null) as EurovirtualsConnectionInput | null;
  if (!body) return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  try {
    const existing = await getEurovirtualsConnection().catch(() => null);
    const connection = await saveEurovirtualsConnection({
      ...body,
      apiKey: body.apiKey || existing?.apiKey || "",
      appKey: body.appKey || existing?.appKey || "",
    });
    await auditLog(guard.session, existing ? "eurovirtuals.connection.update" : "eurovirtuals.connection.create", { id: connection.id, apiBase: connection.apiBase });
    return Response.json({ success: true, data: { connection: publicEurovirtualsConnection(connection), callbacks: eurovirtualsCallbackUrls() } }, { status: existing ? 200 : 201 });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not save connection" }, { status: 400 });
  }
}

export async function DELETE() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  await deleteEurovirtualsConnection();
  await auditLog(guard.session, "eurovirtuals.connection.delete", {});
  return Response.json({ success: true, data: { deleted: true } });
}
