import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// ─── Helper: recompute streaks for a player from their full session history ───
async function recalcPlayerStats(playerExternalId: string) {
  const sessions = await db.playerSession.findMany({
    where: { playerId: playerExternalId },
    orderBy: { createdAt: 'asc' },
  });

  let totalBets = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let netProfit = 0;
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let tempWin = 0;
  let tempLose = 0;

  for (const s of sessions) {
    totalBets++;
    netProfit += s.winAmount - s.betAmount;

    if (s.outcome === 'win') {
      totalWins++;
      // winning streak
      tempWin++;
      tempLose = 0;
      if (tempWin > maxWinStreak) maxWinStreak = tempWin;
      currentStreak = tempWin;
    } else if (s.outcome === 'loss') {
      totalLosses++;
      // losing streak
      tempLose++;
      tempWin = 0;
      if (tempLose > maxLoseStreak) maxLoseStreak = tempLose;
      currentStreak = -tempLose;
    } else {
      // push / bonus / jackpot — neutral: reset both temp streaks
      tempWin = 0;
      tempLose = 0;
      currentStreak = 0;
    }
  }

  await db.playerProfile.update({
    where: { externalId: playerExternalId },
    data: {
      totalBets,
      totalWins,
      totalLosses,
      netProfit,
      currentStreak,
      maxWinStreak,
      maxLoseStreak,
    },
  });
}

// ─── Helper: incrementally update streaks after inserting a single session ───
async function updatePlayerStreakIncremental(
  playerExternalId: string,
  outcome: string,
  betAmount: number,
  winAmount: number,
) {
  const player = await db.playerProfile.findUnique({
    where: { externalId: playerExternalId },
  });

  if (!player) {
    console.error(`updatePlayerStreakIncremental: player ${playerExternalId} not found`);
    return;
  }

  const isWin = outcome === 'win';
  const isLoss = outcome === 'loss';

  // Derive the previous session's outcome by checking the streak sign/direction
  const prevStreak = player.currentStreak;
  const wasWin = prevStreak > 0;
  const wasLoss = prevStreak < 0;

  let newStreak: number;
  let newMaxWin = player.maxWinStreak;
  let newMaxLose = player.maxLoseStreak;

  if (isWin) {
    newStreak = wasWin ? prevStreak + 1 : 1;
    if (newStreak > newMaxWin) newMaxWin = newStreak;
  } else if (isLoss) {
    newStreak = wasLoss ? prevStreak - 1 : -1;
    if (Math.abs(newStreak) > newMaxLose) newMaxLose = Math.abs(newStreak);
  } else {
    // push / bonus / jackpot — neutral outcome
    newStreak = 0;
  }

  await db.playerProfile.update({
    where: { externalId: playerExternalId },
    data: {
      totalBets: { increment: 1 },
      totalWins: isWin ? { increment: 1 } : undefined,
      totalLosses: isLoss ? { increment: 1 } : undefined,
      netProfit: player.netProfit + (winAmount - betAmount),
      currentStreak: newStreak,
      maxWinStreak: newMaxWin,
      maxLoseStreak: newMaxLose,
    },
  });
}

// ─── GET /api/ops/sessions ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const gameType = searchParams.get('gameType');
    const outcome = searchParams.get('outcome');
    const controlledParam = searchParams.get('controlled');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};

    if (playerId) where.playerId = playerId;
    if (gameType) where.gameType = gameType;
    if (outcome) where.outcome = outcome;
    if (controlledParam !== null) {
      where.controlled = controlledParam === 'true';
    }

    const [sessions, total] = await Promise.all([
      db.playerSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
        skip: offset,
      }),
      db.playerSession.count({ where }),
    ]);

    return NextResponse.json({ sessions, total });
  } catch (error) {
    console.error('Sessions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// ─── POST /api/ops/sessions ────────────────────────────────────────────
// Record a new session (and auto-update player streak)
// POST /api/ops/sessions?action=recalc&id=playerExternalId — recalculate all streaks
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // ── Recalc action ──
    if (action === 'recalc') {
      const playerExternalId = searchParams.get('id');
      if (!playerExternalId) {
        return NextResponse.json(
          { error: 'Player external id is required for recalc action' },
          { status: 400 },
        );
      }

      const player = await db.playerProfile.findUnique({
        where: { externalId: playerExternalId },
      });
      if (!player) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 },
        );
      }

      await recalcPlayerStats(playerExternalId);

      const updated = await db.playerProfile.findUnique({
        where: { externalId: playerExternalId },
      });

      return NextResponse.json({
        success: true,
        player: updated,
      });
    }

    // ── Create session action ──
    const body = await req.json();
    const {
      playerId,
      sessionId,
      gameType,
      gameId,
      gameName,
      betAmount,
      winAmount,
      outcome,
      resultRtp,
      duration,
      spins,
      ipAddress,
      userAgent,
      controlled,
      controlType,
    } = body;

    if (!playerId || !gameType || betAmount === undefined || winAmount === undefined || !outcome) {
      return NextResponse.json(
        { error: 'playerId, gameType, betAmount, winAmount, and outcome are required' },
        { status: 400 },
      );
    }

    // Verify the player exists
    const player = await db.playerProfile.findUnique({
      where: { externalId: playerId },
    });
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 },
      );
    }

    const session = await db.playerSession.create({
      data: {
        playerId,
        sessionId: sessionId || null,
        gameType,
        gameId: gameId || null,
        gameName: gameName || null,
        betAmount,
        winAmount,
        outcome,
        resultRtp: resultRtp ?? null,
        duration: duration ?? null,
        spins: spins ?? 0,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        controlled: controlled ?? false,
        controlType: controlType || null,
      },
    });

    // Auto-update player streaks and stats
    await updatePlayerStreakIncremental(playerId, outcome, betAmount, winAmount);

    // The controlType is already persisted on the session row for auditing;
    // no server-console echo (it would leak rigged-outcome details into prod logs).

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Sessions POST error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

// ─── DELETE /api/ops/sessions?id=xxx ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Session id query parameter is required' },
        { status: 400 },
      );
    }

    // Look up the session first to know the player for streak recalc
    const session = await db.playerSession.findUnique({
      where: { id },
      select: { playerId: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await db.playerSession.delete({ where: { id } });

    // Recalculate the player's stats since a session was removed
    const player = await db.playerProfile.findUnique({
      where: { externalId: session.playerId },
    });
    if (player) {
      await recalcPlayerStats(session.playerId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Sessions DELETE error:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
