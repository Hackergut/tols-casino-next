import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/crm/emails — list emails (optionally filter by folder/status)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'inbox';
    const starred = searchParams.get('starred');
    const important = searchParams.get('important');

    const where: Record<string, unknown> = { folder };
    if (starred === 'true') where.starred = true;
    if (important === 'true') where.important = true;

    const emails = await db.crmEmail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(emails);
  } catch (error) {
    console.error('CRM Emails GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

// POST /api/crm/emails — create/send an email
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { fromAddress, toAddresses, ccAddresses, bccAddresses, subject, body: emailBody, plainBody, status, folder, taskId, memberId, attachments } = body;

    if (!toAddresses || !subject) {
      return NextResponse.json({ error: 'To addresses and subject are required' }, { status: 400 });
    }

    const email = await db.crmEmail.create({
      data: {
        fromAddress: fromAddress || 'admin@tolsplatform.com',
        toAddresses: JSON.stringify(Array.isArray(toAddresses) ? toAddresses : [toAddresses]),
        ccAddresses: ccAddresses ? JSON.stringify(Array.isArray(ccAddresses) ? ccAddresses : [ccAddresses]) : null,
        bccAddresses: bccAddresses ? JSON.stringify(Array.isArray(bccAddresses) ? bccAddresses : [bccAddresses]) : null,
        subject,
        body: emailBody || null,
        plainBody: plainBody || null,
        status: status || (folder || 'inbox'),
        folder: folder || 'inbox',
        taskId: taskId || null,
        memberId: memberId || null,
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
    });

    // Log activity
    await db.crmActivity.create({
      data: {
        memberId,
        action: 'created',
        entityType: 'email',
        entityId: email.id,
        details: `Email "${subject}" created`,
      },
    });

    return NextResponse.json(email, { status: 201 });
  } catch (error) {
    console.error('CRM Emails POST error:', error);
    return NextResponse.json({ error: 'Failed to create email' }, { status: 500 });
  }
}

// PUT /api/crm/emails — update an email (star, archive, move, etc.)
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    const email = await db.crmEmail.update({
      where: { id },
      data: {
        ...(updates.starred !== undefined && { starred: updates.starred }),
        ...(updates.important !== undefined && { important: updates.important }),
        ...(updates.folder !== undefined && { folder: updates.folder, status: updates.folder }),
        ...(updates.subject !== undefined && { subject: updates.subject }),
        ...(updates.body !== undefined && { body: updates.body }),
        ...(updates.plainBody !== undefined && { plainBody: updates.plainBody }),
        ...(updates.taskId !== undefined && { taskId: updates.taskId }),
        ...(updates.read !== undefined && updates.read === true && { status: 'read' }),
      },
    });

    return NextResponse.json(email);
  } catch (error) {
    console.error('CRM Emails PUT error:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}

// DELETE /api/crm/emails?id=xxx — delete an email
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    await db.crmEmail.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM Emails DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 });
  }
}
