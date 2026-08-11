import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/crm/chat — list channels with latest messages
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // If channelId provided, return messages for that channel
    if (channelId) {
      const messages = await db.chatMessage.findMany({
        where: { channelId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      // Mark messages as read (in a real app with auth, we'd know the current user)
      // For now just return messages
      return NextResponse.json(messages);
    }

    // Otherwise return all channels
    const channels = await db.chatChannel.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // For each channel, get the latest message
    const channelsWithLatest = await Promise.all(
      channels.map(async (ch) => {
        const latest = await db.chatMessage.findFirst({
          where: { channelId: ch.id },
          orderBy: { createdAt: 'desc' },
        });
        const unread = await db.chatMessage.count({
          where: { channelId: ch.id, pinned: false },
        });
        return { ...ch, latestMessage: latest, unreadCount: unread };
      })
    );

    return NextResponse.json(channelsWithLatest);
  } catch (error) {
    console.error('CRM Chat GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch chat data' }, { status: 500 });
  }
}

// POST /api/crm/chat — send a message or create a channel
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { type, ...data } = body;

    if (type === 'channel') {
      // Create a new channel
      const { name, channelType, members, description, avatar, createdBy } = data;
      if (!name) {
        return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
      }

      const channel = await db.chatChannel.create({
        data: {
          name,
          type: channelType || 'channel',
          members: JSON.stringify(members || []),
          description: description || null,
          avatar: avatar || null,
          createdBy: createdBy || null,
        },
      });

      return NextResponse.json(channel, { status: 201 });
    }

    if (type === 'message') {
      // Send a message
      const { channelId, senderId, senderName, content, mentions } = data;
      if (!channelId || !content) {
        return NextResponse.json({ error: 'Channel ID and content are required' }, { status: 400 });
      }

      const message = await db.chatMessage.create({
        data: {
          channelId,
          senderId: senderId || null,
          senderName: senderName || 'System',
          content,
          mentions: mentions ? JSON.stringify(mentions) : null,
        },
      });

      // Update channel's updatedAt
      await db.chatChannel.update({
        where: { id: channelId },
        data: { updatedAt: new Date() },
      });

      // Log activity
      await db.crmActivity.create({
        data: {
          memberId: senderId,
          action: 'commented',
          entityType: 'chat',
          entityId: channelId,
          details: `Sent a message in channel`,
        },
      });

      return NextResponse.json(message, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid type. Use "channel" or "message"' }, { status: 400 });
  } catch (error) {
    console.error('CRM Chat POST error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}

// PUT /api/crm/chat — update channel or message
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const { type, ...data } = body;

    if (type === 'message') {
      const { id, content, pinned } = data;
      if (!id) {
        return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
      }

      const message = await db.chatMessage.update({
        where: { id },
        data: {
          ...(content !== undefined && { content, edited: true }),
          ...(pinned !== undefined && { pinned }),
        },
      });

      return NextResponse.json(message);
    }

    if (type === 'channel') {
      const { id, name, description, avatar, members } = data;
      if (!id) {
        return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
      }

      const channel = await db.chatChannel.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(avatar !== undefined && { avatar }),
          ...(members !== undefined && { members: JSON.stringify(members) }),
        },
      });

      return NextResponse.json(channel);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('CRM Chat PUT error:', error);
    return NextResponse.json({ error: 'Failed to update chat data' }, { status: 500 });
  }
}

// DELETE /api/crm/chat?id=xxx&type=message|channel
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (type === 'message') {
      await db.chatMessage.delete({ where: { id } });
    } else if (type === 'channel') {
      await db.chatMessage.deleteMany({ where: { channelId: id } });
      await db.chatChannel.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'Specify type=message or type=channel' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM Chat DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete chat data' }, { status: 500 });
  }
}
