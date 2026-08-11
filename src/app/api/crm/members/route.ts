import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/crm/members — list all team members
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const members = await db.teamMember.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(members);
  } catch (error) {
    console.error('CRM Members GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/crm/members — create a new team member
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { name, email, role, department, avatar, phone, bio, status } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check for duplicate email
    const existing = await db.teamMember.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 });
    }

    const member = await db.teamMember.create({
      data: {
        name,
        email,
        role: role || 'agent',
        department: department || 'general',
        avatar: avatar || null,
        phone: phone || null,
        bio: bio || null,
        status: status || 'active',
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('CRM Members POST error:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}

// PUT /api/crm/members — update a member
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const member = await db.teamMember.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.email && { email: updates.email }),
        ...(updates.role !== undefined && { role: updates.role }),
        ...(updates.department !== undefined && { department: updates.department }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
        ...(updates.status !== undefined && { status: updates.status }),
        lastSeen: new Date(),
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('CRM Members PUT error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/crm/members?id=xxx — remove a member
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    await db.teamMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM Members DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
