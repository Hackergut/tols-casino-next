import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// ==================== TYPE HELPERS ====================

const VALID_SCOPES = ['all', 'segment', 'individual', 'risk_level'] as const;
const VALID_MODES = [
  'normal',
  'boost_win',
  'boost_loss',
  'force_win',
  'force_loss',
  'limit_rtp',
  'set_rtp',
] as const;

// ==================== GET ====================

// GET /api/ops/controls — list all control rules (?enabled=true/false)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const enabledParam = searchParams.get('enabled');

    const where: Record<string, unknown> = {};
    if (enabledParam !== null) {
      where.enabled = enabledParam === 'true';
    }

    const controls = await db.operationControl.findMany({
      where,
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error('OperationControls GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operation controls' },
      { status: 500 },
    );
  }
}

// ==================== POST ====================

// POST /api/ops/controls — create a new control rule
// POST /api/ops/controls?action=evaluate&playerId=xxx — evaluate which controls apply to a player
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // ---------- EVALUATE ACTION ----------
    if (action === 'evaluate') {
      const playerId = searchParams.get('playerId');
      if (!playerId) {
        return NextResponse.json(
          { error: 'playerId query parameter is required for evaluate action' },
          { status: 400 },
        );
      }

      // Look up the player profile
      const player = await db.playerProfile.findUnique({
        where: { externalId: playerId },
      });

      if (!player) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 },
        );
      }

      // Fetch all enabled controls ordered by priority desc (higher priority first)
      const enabledControls = await db.operationControl.findMany({
        where: { enabled: true },
        orderBy: { priority: 'desc' },
      });

      const now = new Date();

      // Determine which controls apply to this player
      const matchingControls = enabledControls.filter((control) => {
        // Skip expired controls
        if (control.expiresAt && control.expiresAt <= now) {
          return false;
        }

        switch (control.targetScope) {
          case 'all':
            return true;
          case 'segment':
            return control.targetValue === player.segment;
          case 'individual':
            return control.targetValue === player.externalId;
          case 'risk_level':
            return control.targetValue === player.riskLevel;
          default:
            return false;
        }
      });

      return NextResponse.json({
        playerId: player.externalId,
        username: player.username,
        segment: player.segment,
        riskLevel: player.riskLevel,
        matchingControls,
        totalMatched: matchingControls.length,
        evaluatedAt: now.toISOString(),
      });
    }

    // ---------- CREATE ACTION ----------
    const body = await req.json();
    const {
      name,
      description,
      targetScope,
      targetValue,
      controlMode,
      rtpTarget,
      maxWinAmount,
      maxLossAmount,
      streakThreshold,
      enabled,
      priority,
      expiresAt,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (targetScope && !VALID_SCOPES.includes(targetScope)) {
      return NextResponse.json(
        { error: `targetScope must be one of: ${VALID_SCOPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (controlMode && !VALID_MODES.includes(controlMode)) {
      return NextResponse.json(
        { error: `controlMode must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 },
      );
    }

    // targetValue is required for non-"all" scopes
    if (targetScope && targetScope !== 'all' && !targetValue) {
      return NextResponse.json(
        { error: 'targetValue is required when targetScope is not "all"' },
        { status: 400 },
      );
    }

    const control = await db.operationControl.create({
      data: {
        name,
        description: description || null,
        targetScope: targetScope || 'all',
        targetValue: targetValue ?? null,
        controlMode: controlMode || 'normal',
        rtpTarget: rtpTarget ?? null,
        maxWinAmount: maxWinAmount ?? null,
        maxLossAmount: maxLossAmount ?? null,
        streakThreshold: streakThreshold ?? null,
        enabled: enabled ?? false,
        priority: priority ?? 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Log via CrmActivity
    await db.crmActivity.create({
      data: {
        action: 'created',
        entityType: 'operation_control',
        entityId: control.id,
        details: `Created operation control "${name}" (mode: ${control.controlMode}, scope: ${control.targetScope})`,
      },
    });

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error('OperationControls POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create operation control' },
      { status: 500 },
    );
  }
}

// ==================== PUT ====================

// PUT /api/ops/controls — update a control rule
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required for update' },
        { status: 400 },
      );
    }

    // Verify the control exists
    const existing = await db.operationControl.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Operation control not found' },
        { status: 404 },
      );
    }

    // Validate enums if provided
    if (updates.targetScope && !VALID_SCOPES.includes(updates.targetScope)) {
      return NextResponse.json(
        { error: `targetScope must be one of: ${VALID_SCOPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (updates.controlMode && !VALID_MODES.includes(updates.controlMode)) {
      return NextResponse.json(
        { error: `controlMode must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 },
      );
    }

    // If switching away from "all" scope, require targetValue
    if (
      updates.targetScope &&
      updates.targetScope !== 'all' &&
      !updates.targetValue &&
      !existing.targetValue
    ) {
      return NextResponse.json(
        { error: 'targetValue is required when targetScope is not "all"' },
        { status: 400 },
      );
    }

    const control = await db.operationControl.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.targetScope !== undefined && { targetScope: updates.targetScope }),
        ...(updates.targetValue !== undefined && { targetValue: updates.targetValue }),
        ...(updates.controlMode !== undefined && { controlMode: updates.controlMode }),
        ...(updates.rtpTarget !== undefined && { rtpTarget: updates.rtpTarget }),
        ...(updates.maxWinAmount !== undefined && { maxWinAmount: updates.maxWinAmount }),
        ...(updates.maxLossAmount !== undefined && { maxLossAmount: updates.maxLossAmount }),
        ...(updates.streakThreshold !== undefined && { streakThreshold: updates.streakThreshold }),
        ...(updates.enabled !== undefined && { enabled: updates.enabled }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.expiresAt !== undefined && {
          expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : null,
        }),
      },
    });

    // Log via CrmActivity
    await db.crmActivity.create({
      data: {
        action: 'updated',
        entityType: 'operation_control',
        entityId: id,
        details: `Updated operation control "${control.name}"`,
      },
    });

    return NextResponse.json(control);
  } catch (error) {
    console.error('OperationControls PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update operation control' },
      { status: 500 },
    );
  }
}

// ==================== DELETE ====================

// DELETE /api/ops/controls?id=xxx — remove a control rule
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 },
      );
    }

    // Verify the control exists before deleting
    const existing = await db.operationControl.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Operation control not found' },
        { status: 404 },
      );
    }

    await db.operationControl.delete({ where: { id } });

    // Log via CrmActivity
    await db.crmActivity.create({
      data: {
        action: 'deleted',
        entityType: 'operation_control',
        entityId: id,
        details: `Deleted operation control "${existing.name}"`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OperationControls DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete operation control' },
      { status: 500 },
    );
  }
}
