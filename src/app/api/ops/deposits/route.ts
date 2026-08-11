import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// ==================== HELPERS ====================

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Evaluate a simple JSON condition against a numeric value.
 * Condition format: { field, operator, value }
 * Supported operators: >=, <=, >, <, ==, !=
 */
function evaluateCondition(
  conditionStr: string | null | undefined,
  fieldValues: Record<string, number>,
): boolean {
  if (!conditionStr) return false;

  try {
    const condition = JSON.parse(conditionStr);
    const fieldValue = fieldValues[condition.field];
    if (fieldValue === undefined) return false;

    const target = Number(condition.value);
    switch (condition.operator) {
      case '>=':  return fieldValue >= target;
      case '<=':  return fieldValue <= target;
      case '>':   return fieldValue > target;
      case '<':   return fieldValue < target;
      case '==':  return fieldValue === target;
      case '!=':  return fieldValue !== target;
      default:    return false;
    }
  } catch {
    return false;
  }
}

// ==================== GET ====================

// GET /api/ops/deposits — list deposit events
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const isFirstParam = searchParams.get('isFirst');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const where: Record<string, unknown> = {};
    if (playerId) where.playerId = playerId;
    if (status) where.status = status;
    if (method) where.method = method;
    if (isFirstParam !== null) {
      where.isFirstDeposit = isFirstParam === 'true';
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const [deposits, total] = await Promise.all([
      db.depositEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.depositEvent.count({ where }),
    ]);

    return NextResponse.json({ deposits, total, limit, offset });
  } catch (error) {
    console.error('DepositEvents GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposit events' },
      { status: 500 },
    );
  }
}

// ==================== POST ====================

// POST /api/ops/deposits — record a deposit event
// POST /api/ops/deposits?action=analytics — get deposit analytics
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // ---------- ANALYTICS ACTION ----------
    if (action === 'analytics') {
      return await getDepositAnalytics();
    }

    // ---------- CREATE ACTION ----------
    const body = await req.json();
    const {
      playerId,
      amount,
      currency,
      method,
      txHash,
      status,
      isFirstDeposit,
      triggeredBy,
      notes,
    } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId is required' },
        { status: 400 },
      );
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'amount is required' },
        { status: 400 },
      );
    }

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'amount must be a non-negative number' },
        { status: 400 },
      );
    }

    // Look up player profile
    const player = await db.playerProfile.findUnique({
      where: { externalId: playerId },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 },
      );
    }

    // Count existing deposits for this player
    const existingCount = await db.depositEvent.count({
      where: { playerId },
    });

    const depositNumber = existingCount + 1;
    const isRecurring = depositNumber > 1;
    const daysSinceReg = daysBetween(player.registeredAt, new Date());

    const deposit = await db.depositEvent.create({
      data: {
        playerId,
        amount,
        currency: currency || 'USD',
        method: method || null,
        txHash: txHash || null,
        status: status || 'completed',
        isFirstDeposit: isFirstDeposit ?? depositNumber === 1,
        isRecurring,
        depositNumber,
        daysSinceReg,
        triggeredBy: triggeredBy || null,
        notes: notes || null,
      },
    });

    // Update PlayerProfile.totalDeposits
    await db.playerProfile.update({
      where: { externalId: playerId },
      data: { totalDeposits: { increment: amount } },
    });

    // Check against TelegramAlertRules and trigger notifications
    await checkAndTriggerDepositAlerts(deposit, player);

    // Log via CrmActivity
    await db.crmActivity.create({
      data: {
        action: 'created',
        entityType: 'deposit',
        entityId: deposit.id,
        details: `Deposit of ${amount} ${deposit.currency} recorded for player ${player.username} (#${depositNumber})`,
      },
    });

    return NextResponse.json(deposit, { status: 201 });
  } catch (error) {
    console.error('DepositEvents POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create deposit event' },
      { status: 500 },
    );
  }
}

// ==================== DELETE ====================

// DELETE /api/ops/deposits?id=xxx — remove a deposit event
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

    // Verify the deposit exists
    const existing = await db.depositEvent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Deposit event not found' },
        { status: 404 },
      );
    }

    await db.depositEvent.delete({ where: { id } });

    // Log via CrmActivity
    await db.crmActivity.create({
      data: {
        action: 'deleted',
        entityType: 'deposit',
        entityId: id,
        details: `Deleted deposit event #${existing.depositNumber} for player ${existing.playerId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DepositEvents DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete deposit event' },
      { status: 500 },
    );
  }
}

// ==================== INTERNAL: ANALYTICS ====================

async function getDepositAnalytics() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalDeposits,
    totalDepositResult,
    depositCountsByDayRaw,
    depositAmountsByMethodRaw,
    depositCountsByStatusRaw,
    totalPlayers,
    playersWithDeposits,
    playersWithMultipleDeposits,
    topDepositorsRaw,
  ] = await Promise.all([
    // Total count
    db.depositEvent.count({
      where: { status: 'completed' },
    }),

    // Total amount
    db.depositEvent.aggregate({
      _sum: { amount: true },
      where: { status: 'completed' },
    }),

    // Deposits by day (last 7 days)
    db.depositEvent.groupBy({
      by: ['createdAt'],
      where: {
        status: 'completed',
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
      _sum: { amount: true },
    }),

    // Deposits by method
    db.depositEvent.groupBy({
      by: ['method'],
      where: { status: 'completed' },
      _count: true,
      _sum: { amount: true },
    }),

    // Deposits by status
    db.depositEvent.groupBy({
      by: ['status'],
      _count: true,
    }),

    // Total players
    db.playerProfile.count(),

    // Players who have at least one deposit
    db.playerProfile.count({
      where: {
        totalDeposits: { gt: 0 },
      },
    }),

    // Players with more than one deposit
    db.playerProfile.count({
      where: {
        totalDeposits: { gt: 0 },
      },
    }),

    // Top depositors (top 10 by totalDeposits field)
    db.playerProfile.findMany({
      where: { totalDeposits: { gt: 0 } },
      orderBy: { totalDeposits: 'desc' },
      take: 10,
      select: {
        externalId: true,
        username: true,
        totalDeposits: true,
        segment: true,
        riskLevel: true,
      },
    }),
  ]);

  const totalDepositAmount = totalDepositResult._sum.amount ?? 0;
  const averageDeposit = totalDeposits > 0 ? totalDepositAmount / totalDeposits : 0;

  // Build depositsByDay — group raw day entries by date string
  const depositsByDay: Record<string, { count: number; amount: number }> = {};
  for (const entry of depositCountsByDayRaw) {
    const dayKey = entry.createdAt.toISOString().split('T')[0];
    if (!depositsByDay[dayKey]) {
      depositsByDay[dayKey] = { count: 0, amount: 0 };
    }
    depositsByDay[dayKey].count += entry._count;
    depositsByDay[dayKey].amount += entry._sum.amount ?? 0;
  }

  // Build depositsByMethod
  const depositsByMethod: Record<string, { count: number; amount: number }> = {};
  for (const entry of depositAmountsByMethodRaw) {
    const key = entry.method || 'unknown';
    depositsByMethod[key] = {
      count: entry._count,
      amount: entry._sum.amount ?? 0,
    };
  }

  // Build depositsByStatus
  const depositsByStatus: Record<string, number> = {};
  for (const entry of depositCountsByStatusRaw) {
    depositsByStatus[entry.status] = entry._count;
  }

  const firstDepositConversionRate =
    totalPlayers > 0 ? playersWithDeposits / totalPlayers : 0;

  const recurringDepositRate =
    playersWithDeposits > 0 ? playersWithMultipleDeposits / playersWithDeposits : 0;

  return NextResponse.json({
    totalDeposits,
    totalDepositAmount,
    averageDeposit: Math.round(averageDeposit * 100) / 100,
    depositsByDay,
    depositsByMethod,
    depositsByStatus,
    firstDepositConversionRate: Math.round(firstDepositConversionRate * 10000) / 10000,
    recurringDepositRate: Math.round(recurringDepositRate * 10000) / 10000,
    totalPlayers,
    playersWithDeposits,
    topDepositors: topDepositorsRaw.map((p) => ({
      playerId: p.externalId,
      username: p.username,
      totalDeposits: p.totalDeposits,
      segment: p.segment,
      riskLevel: p.riskLevel,
    })),
  });
}

// ==================== INTERNAL: TELEGRAM ALERTS ====================

async function checkAndTriggerDepositAlerts(
  deposit: {
    id: string;
    playerId: string;
    amount: number;
    currency: string;
    method: string | null;
    status: string;
    isFirstDeposit: boolean;
    depositNumber: number;
  },
  player: {
    username: string;
    segment: string;
  },
) {
  // Only check alerts for completed deposits
  if (deposit.status !== 'completed') return;

  // Fetch all enabled deposit alert rules
  const alertRules = await db.telegramAlertRule.findMany({
    where: {
      enabled: true,
      eventType: 'deposit',
    },
  });

  const now = new Date();
  const fieldValues: Record<string, number> = {
    amount: deposit.amount,
    depositNumber: deposit.depositNumber,
    isFirstDeposit: deposit.isFirstDeposit ? 1 : 0,
  };

  for (const rule of alertRules) {
    // Check cooldown
    if (rule.lastTriggeredAt) {
      const msSinceLast = now.getTime() - rule.lastTriggeredAt.getTime();
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (msSinceLast < cooldownMs) continue;
    }

    // Evaluate the condition
    if (!evaluateCondition(rule.condition, fieldValues)) continue;

    // Build notification message
    const message = rule.messageTemplate
      ? rule.messageTemplate
          .replace('{playerId}', deposit.playerId)
          .replace('{username}', player.username)
          .replace('{amount}', String(deposit.amount))
          .replace('{currency}', deposit.currency)
          .replace('{method}', deposit.method || 'N/A')
          .replace('{depositNumber}', String(deposit.depositNumber))
      : `💰 Deposit Alert: ${player.username} deposited ${deposit.amount} ${deposit.currency} (#${deposit.depositNumber})`;

    // Insert notification into the queue
    await db.telegramNotification.create({
      data: {
        ruleId: rule.id,
        eventType: 'deposit',
        title: `Deposit: ${player.username} — ${deposit.amount} ${deposit.currency}`,
        message,
        chatId: rule.telegramChatId,
        threadId: rule.telegramThreadId || null,
        status: 'pending',
      },
    });

    // Update lastTriggeredAt to enforce cooldown
    await db.telegramAlertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: now },
    });
  }
}
