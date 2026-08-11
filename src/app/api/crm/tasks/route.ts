import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/crm/tasks — list tasks (optionally filter by status)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;

    const tasks = await db.crmTask.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('CRM Tasks GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/crm/tasks — create a task
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { title, description, status, priority, assigneeId, reporterId, dueDate, tags, mentions } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get max order for the status column
    const maxOrder = await db.crmTask.findFirst({
      where: { status: status || 'todo' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const task = await db.crmTask.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        assigneeId: assigneeId || null,
        reporterId: reporterId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags ? JSON.stringify(tags) : null,
        mentions: mentions ? JSON.stringify(mentions) : null,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    // Log activity
    await db.crmActivity.create({
      data: {
        memberId: reporterId,
        action: 'created',
        entityType: 'task',
        entityId: task.id,
        details: `Created task "${title}"`,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('CRM Tasks POST error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PUT /api/crm/tasks — update a task (supports status change for drag-and-drop)
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const task = await db.crmTask.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.assigneeId !== undefined && { assigneeId: updates.assigneeId }),
        ...(updates.reporterId !== undefined && { reporterId: updates.reporterId }),
        ...(updates.dueDate !== undefined && { dueDate: updates.dueDate ? new Date(updates.dueDate) : null }),
        ...(updates.tags !== undefined && { tags: typeof updates.tags === 'string' ? updates.tags : JSON.stringify(updates.tags) }),
        ...(updates.mentions !== undefined && { mentions: typeof updates.mentions === 'string' ? updates.mentions : JSON.stringify(updates.mentions) }),
        ...(updates.order !== undefined && { order: updates.order }),
      },
    });

    // Log activity for status changes
    if (updates.status) {
      await db.crmActivity.create({
        data: {
          memberId: updates.assigneeId,
          action: 'updated',
          entityType: 'task',
          entityId: id,
          details: `Moved task to ${updates.status}`,
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('CRM Tasks PUT error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/crm/tasks?id=xxx — delete a task
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await db.crmTask.delete({ where: { id } });

    await db.crmActivity.create({
      data: {
        action: 'deleted',
        entityType: 'task',
        entityId: id,
        details: 'Task deleted',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM Tasks DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
