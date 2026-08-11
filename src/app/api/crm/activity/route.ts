import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/crm/activity — list recent activity log
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const activities = await db.crmActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json(activities);
  } catch (error) {
    console.error('CRM Activity GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
