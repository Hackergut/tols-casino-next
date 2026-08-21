import { NextRequest } from "next/server";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import { getBridgeConfig } from "@/lib/governance-bridge";
import {
  deleteGovernanceConnection, getGovernanceConnection, publicGovernanceConnection,
  saveGovernanceConnection, type GovernanceConnectionInput,
} from "@/lib/governance-connection";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const connection = await getGovernanceConnection().catch(() => null);
  const cfg = getBridgeConfig();
  return Response.json({
    success: true,
    data: {
      connection: publicGovernanceConnection(connection),
      environment: {
        live: cfg.hasBridgeSecret,
        towerOrigin: cfg.towerOrigin,
        towerApiBase: cfg.towerApiBase,
        casinoOrigin: cfg.casinoOrigin,
        hasBridgeSecret: cfg.hasBridgeSecret,
      },
      encryptionConfigured: Boolean(process.env.CONNECTION_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET),
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null) as GovernanceConnectionInput | null;
  if (!body) return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  try {
    const existing = await getGovernanceConnection().catch(() => null);
    const connection = await saveGovernanceConnection({
      ...body,
      bridgeSecret: body.bridgeSecret || existing?.bridgeSecret || "",
      apiKey: body.apiKey === undefined || body.apiKey === "" ? existing?.apiKey : body.apiKey,
      appKey: body.appKey === undefined || body.appKey === "" ? existing?.appKey : body.appKey,
    });
    await auditLog(guard.session, existing ? "governance.connection.update" : "governance.connection.create", { id: connection.id, towerOrigin: connection.towerOrigin, casinoOrigin: connection.casinoOrigin });
    return Response.json({ success: true, data: { connection: publicGovernanceConnection(connection) } }, { status: existing ? 200 : 201 });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not save connection" }, { status: 400 });
  }
}

export async function DELETE() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  await deleteGovernanceConnection();
  await auditLog(guard.session, "governance.connection.delete", {});
  return Response.json({ success: true, data: { deleted: true } });
}
