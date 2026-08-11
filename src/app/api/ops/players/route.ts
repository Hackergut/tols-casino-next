import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// ─── GET /api/ops/players ───────────────────────────────────────────────
// List all players with optional filters, or aggregate stats when ?stats=true
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const stats = searchParams.get('stats');

    // ── Aggregate statistics branch ──
    if (stats === 'true') {
      const [total, segmentGroups, riskGroups, agg] = await Promise.all([
        db.playerProfile.count(),
        db.playerProfile.groupBy({ by: ['segment'], _count: { segment: true } }),
        db.playerProfile.groupBy({ by: ['riskLevel'], _count: { riskLevel: true } }),
        db.playerProfile.aggregate({
          _avg: { currentStreak: true },
          _sum: { totalDeposits: true, totalWithdrawals: true, totalBets: true, totalWins: true, totalLosses: true, netProfit: true },
        }),
      ]);

      const bySegment: Record<string, number> = {};
      for (const g of segmentGroups) bySegment[g.segment] = g._count.segment;

      const byRiskLevel: Record<string, number> = {};
      for (const g of riskGroups) byRiskLevel[g.riskLevel] = g._count.riskLevel;

      return NextResponse.json({
        total,
        bySegment,
        byRiskLevel,
        avgStreak: agg._avg.currentStreak ?? 0,
        totalDeposits: agg._sum.totalDeposits ?? 0,
        totalRevenue: (agg._sum.totalDeposits ?? 0) - (agg._sum.totalWithdrawals ?? 0),
        totalBets: agg._sum.totalBets ?? 0,
        totalWins: agg._sum.totalWins ?? 0,
        totalLosses: agg._sum.totalLosses ?? 0,
        netProfit: agg._sum.netProfit ?? 0,
      });
    }

    // ── List players branch ──
    const segment = searchParams.get('segment');
    const riskLevel = searchParams.get('riskLevel');
    const search = searchParams.get('search');
    const streakType = searchParams.get('streakType'); // "winning" | "losing"
    const streakMin = searchParams.get('streakMin');

    const where: Record<string, unknown> = {};

    if (segment) where.segment = segment;
    if (riskLevel) where.riskLevel = riskLevel;

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Streak filters: winning → currentStreak >= N; losing → currentStreak <= -N
    if (streakType && streakMin) {
      const minVal = parseInt(streakMin, 10);
      if (!isNaN(minVal) && minVal > 0) {
        if (streakType === 'winning') {
          where.currentStreak = { gte: minVal };
        } else if (streakType === 'losing') {
          where.currentStreak = { lte: -minVal };
        }
      }
    }

    const players = await db.playerProfile.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(players);
  } catch (error) {
    console.error('Players GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

// ─── POST /api/ops/players ──────────────────────────────────────────────
// Create or sync (upsert by externalId) a player profile
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const {
      externalId,
      username,
      email,
      avatar,
      registeredAt,
      totalDeposits,
      totalWithdrawals,
      totalBets,
      totalWins,
      totalLosses,
      netProfit,
      currentStreak,
      maxWinStreak,
      maxLoseStreak,
      riskLevel,
      segment,
      notes,
    } = body;

    if (!externalId || !username) {
      return NextResponse.json(
        { error: 'externalId and username are required' },
        { status: 400 },
      );
    }

    const player = await db.playerProfile.upsert({
      where: { externalId },
      update: {
        ...(username !== undefined && { username }),
        ...(email !== undefined && { email }),
        ...(avatar !== undefined && { avatar }),
        ...(registeredAt !== undefined && { registeredAt: new Date(registeredAt) }),
        ...(totalDeposits !== undefined && { totalDeposits }),
        ...(totalWithdrawals !== undefined && { totalWithdrawals }),
        ...(totalBets !== undefined && { totalBets }),
        ...(totalWins !== undefined && { totalWins }),
        ...(totalLosses !== undefined && { totalLosses }),
        ...(netProfit !== undefined && { netProfit }),
        ...(currentStreak !== undefined && { currentStreak }),
        ...(maxWinStreak !== undefined && { maxWinStreak }),
        ...(maxLoseStreak !== undefined && { maxLoseStreak }),
        ...(riskLevel !== undefined && { riskLevel }),
        ...(segment !== undefined && { segment }),
        ...(notes !== undefined && { notes }),
      },
      create: {
        externalId,
        username,
        email: email || null,
        avatar: avatar || null,
        registeredAt: registeredAt ? new Date(registeredAt) : undefined,
        totalDeposits: totalDeposits ?? 0,
        totalWithdrawals: totalWithdrawals ?? 0,
        totalBets: totalBets ?? 0,
        totalWins: totalWins ?? 0,
        totalLosses: totalLosses ?? 0,
        netProfit: netProfit ?? 0,
        currentStreak: currentStreak ?? 0,
        maxWinStreak: maxWinStreak ?? 0,
        maxLoseStreak: maxLoseStreak ?? 0,
        riskLevel: riskLevel || 'normal',
        segment: segment || 'standard',
        notes: notes || null,
      },
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Players POST error:', error);
    return NextResponse.json({ error: 'Failed to create/sync player' }, { status: 500 });
  }
}

// ─── PUT /api/ops/players ───────────────────────────────────────────────
// Update an existing player profile by id
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Player id is required' },
        { status: 400 },
      );
    }

    // Build the update payload, only including fields that were explicitly provided
    const data: Record<string, unknown> = {};

    const allowedFields = [
      'username', 'email', 'avatar', 'riskLevel', 'segment', 'notes',
      'totalDeposits', 'totalWithdrawals', 'totalBets', 'totalWins',
      'totalLosses', 'netProfit', 'currentStreak', 'maxWinStreak', 'maxLoseStreak',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (data as Record<string, unknown>)[field] = updates[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 },
      );
    }

    const player = await db.playerProfile.update({
      where: { id },
      data,
    });

    return NextResponse.json(player);
  } catch (error: unknown) {
    console.error('Players PUT error:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

// ─── DELETE /api/ops/players?id=xxx ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Player id query parameter is required' },
        { status: 400 },
      );
    }

    await db.playerProfile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Players DELETE error:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
