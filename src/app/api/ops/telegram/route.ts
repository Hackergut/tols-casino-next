import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from "@/lib/admin-auth";

// ==================== GET ====================
// - No params: list all alert rules
// - notifications=true&limit=N: get notification history
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(request.url)
    const isNotifications = searchParams.get('notifications') === 'true'
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (isNotifications) {
      const notifications = await db.telegramNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 500),
      })
      return NextResponse.json({ success: true, data: notifications })
    }

    const rules = await db.telegramAlertRule.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    console.error('[GET /api/ops/telegram] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 },
    )
  }
}

// ==================== POST ====================
// - action=send-test: send a test notification
// - action=process-queue: proxy to telegram-service
// - action=config: set bot token on telegram-service
// - No action: create a new alert rule
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'send-test') {
      return handleSendTest(request)
    }

    if (action === 'process-queue') {
      return handleProcessQueue()
    }

    if (action === 'config') {
      return handleSetConfig(request)
    }

    // Default: create alert rule
    return handleCreateRule(request)
  } catch (error) {
    console.error('[POST /api/ops/telegram] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ==================== PUT ====================
// Update an existing alert rule
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule id is required' },
        { status: 400 },
      )
    }

    // Verify the rule exists
    const existing = await db.telegramAlertRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alert rule not found' },
        { status: 404 },
      )
    }

    // Build the update payload, only including fields that are provided
    const payload: Record<string, unknown> = {}

    if (updateData.name !== undefined) payload.name = updateData.name
    if (updateData.eventType !== undefined) {
      const validEventTypes = [
        'deposit',
        'withdrawal',
        'streak',
        'big_win',
        'big_loss',
        'new_player',
        'control_applied',
        'custom',
      ]
      if (!validEventTypes.includes(updateData.eventType)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}`,
          },
          { status: 400 },
        )
      }
      payload.eventType = updateData.eventType
    }
    if (updateData.condition !== undefined) payload.condition = updateData.condition
    if (updateData.telegramChatId !== undefined)
      payload.telegramChatId = updateData.telegramChatId
    if (updateData.telegramThreadId !== undefined)
      payload.telegramThreadId = updateData.telegramThreadId
    if (updateData.messageTemplate !== undefined)
      payload.messageTemplate = updateData.messageTemplate
    if (updateData.enabled !== undefined) payload.enabled = updateData.enabled
    if (updateData.cooldownMinutes !== undefined)
      payload.cooldownMinutes = updateData.cooldownMinutes

    const updated = await db.telegramAlertRule.update({
      where: { id },
      data: payload,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/ops/telegram] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update alert rule' },
      { status: 500 },
    )
  }
}

// ==================== DELETE ====================
// Delete an alert rule by id query param
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule id is required as a query parameter' },
        { status: 400 },
      )
    }

    const existing = await db.telegramAlertRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alert rule not found' },
        { status: 404 },
      )
    }

    await db.telegramAlertRule.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Alert rule deleted successfully',
    })
  } catch (error) {
    console.error('[DELETE /api/ops/telegram] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete alert rule' },
      { status: 500 },
    )
  }
}

// ==================== Handlers ====================

async function handleCreateRule(request: NextRequest) {
  const body = await request.json()
  const { name, eventType, condition, telegramChatId, telegramThreadId, messageTemplate, enabled, cooldownMinutes } = body

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'name is required and must be a non-empty string' },
      { status: 400 },
    )
  }

  if (!eventType || typeof eventType !== 'string') {
    return NextResponse.json(
      { success: false, error: 'eventType is required' },
      { status: 400 },
    )
  }

  const validEventTypes = [
    'deposit',
    'withdrawal',
    'streak',
    'big_win',
    'big_loss',
    'new_player',
    'control_applied',
    'custom',
  ]
  if (!validEventTypes.includes(eventType)) {
    return NextResponse.json(
      { success: false, error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
      { status: 400 },
    )
  }

  if (!telegramChatId || typeof telegramChatId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'telegramChatId is required and must be a string' },
      { status: 400 },
    )
  }

  // Validate condition is a valid JSON string if provided
  if (condition !== undefined && condition !== null) {
    try {
      const parsed = typeof condition === 'string' ? JSON.parse(condition) : condition
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          { success: false, error: 'condition must be a valid JSON object string' },
          { status: 400 },
        )
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'condition must be a valid JSON string' },
        { status: 400 },
      )
    }
  }

  // Validate cooldownMinutes
  let cooldown = 5
  if (cooldownMinutes !== undefined) {
    cooldown = Number(cooldownMinutes)
    if (isNaN(cooldown) || cooldown < 0) {
      return NextResponse.json(
        { success: false, error: 'cooldownMinutes must be a non-negative number' },
        { status: 400 },
      )
    }
  }

  const rule = await db.telegramAlertRule.create({
    data: {
      name: name.trim(),
      eventType,
      condition: condition ?? null,
      telegramChatId,
      telegramThreadId: telegramThreadId ?? null,
      messageTemplate: messageTemplate ?? null,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      cooldownMinutes: cooldown,
    },
  })

  return NextResponse.json({ success: true, data: rule }, { status: 201 })
}

async function handleSendTest(request: NextRequest) {
  const body = await request.json()
  const { ruleId, chatId } = body

  if (!ruleId || typeof ruleId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'ruleId is required' },
      { status: 400 },
    )
  }

  // Look up the rule
  const rule = await db.telegramAlertRule.findUnique({ where: { id: ruleId } })
  if (!rule) {
    return NextResponse.json(
      { success: false, error: 'Alert rule not found' },
      { status: 404 },
    )
  }

  const targetChatId = chatId || rule.telegramChatId
  if (!targetChatId) {
    return NextResponse.json(
      { success: false, error: 'No chatId provided and rule has no telegramChatId' },
      { status: 400 },
    )
  }

  const timestamp = new Date().toISOString()
  const message = `🧪 Test Alert — ${rule.name}\n\nThis is a test notification from TOLS Admin Platform.\nTime: ${timestamp}`

  // Create the notification record with status pending
  const notification = await db.telegramNotification.create({
    data: {
      ruleId: rule.id,
      eventType: rule.eventType,
      title: `Test: ${rule.name}`,
      message,
      chatId: targetChatId,
      threadId: chatId ? null : rule.telegramThreadId ?? null,
      status: 'pending',
    },
  })

  // Optionally try to forward to the telegram-service mini-service
  try {
    const response = await fetch('/?XTransformPort=3005/process-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // We don't block on the result — the notification is already recorded.
    void response;
  } catch (proxyError) {
    // Non-blocking: log but don't fail the request
    console.warn('[send-test] Could not reach telegram-service:', proxyError)
  }

  return NextResponse.json({
    success: true,
    data: {
      notification,
      message: 'Test notification created and queued for delivery',
    },
  })
}

async function handleProcessQueue() {
  try {
    const response = await fetch('/?XTransformPort=3005/process-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[process-queue] Proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reach telegram-service' },
      { status: 502 },
    )
  }
}

async function handleSetConfig(request: NextRequest) {
  try {
    const body = await request.json()
    const { botToken } = body

    if (!botToken || typeof botToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'botToken is required and must be a string' },
        { status: 400 },
      )
    }

    const response = await fetch('/?XTransformPort=3005/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken }),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[config] Proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reach telegram-service' },
      { status: 502 },
    )
  }
}
