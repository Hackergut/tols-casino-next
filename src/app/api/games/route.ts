import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

function prismaErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Database error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SeedGame {
  externalId: string;
  name: string;
  alias: string;
  provider: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rtp?: number;
  minBet?: number;
  maxBet?: number;
  volatility?: string;
  isLive?: boolean;
  enabled?: boolean;
  featured?: boolean;
  isNew?: boolean;
  priority?: number;
  popularity?: number;
  tags?: string[];
  description?: string;
  gameType?: string;
}

const ALLOWED_SORT_FIELDS = [
  'name',
  'provider',
  'category',
  'popularity',
  'priority',
  'createdAt',
  'updatedAt',
  'enabled',
  'featured',
  'isNew',
] as const;

type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

const TOGGLEABLE_BOOLEAN_FIELDS = ['enabled', 'featured', 'isNew'] as const;
type ToggleableField = (typeof TOGGLEABLE_BOOLEAN_FIELDS)[number];

const VALID_ACTIONS = ['seed', 'toggle', 'bulk-toggle', 'bulk-delete'] as const;
type PostAction = (typeof VALID_ACTIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isToggleableField(field: string): field is ToggleableField {
  return (TOGGLEABLE_BOOLEAN_FIELDS as readonly string[]).includes(field);
}

function isPostAction(action: string): action is PostAction {
  return (VALID_ACTIONS as readonly string[]).includes(action as PostAction);
}

function isSortField(field: string): field is SortField {
  return (ALLOWED_SORT_FIELDS as readonly string[]).includes(field as SortField);
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parsePagination(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — List / Stats / Providers / Categories
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    // ── Aggregate stats ──────────────────────────────────────────────────
    if (action === 'stats') {
      const [
        total,
        enabledCount,
        featuredCount,
        newCount,
        liveCount,
        byProvider,
        byCategory,
        byGameType,
      ] = await Promise.all([
        db.casinoGame.count(),
        db.casinoGame.count({ where: { enabled: true } }),
        db.casinoGame.count({ where: { featured: true } }),
        db.casinoGame.count({ where: { isNew: true } }),
        db.casinoGame.count({ where: { isLive: true } }),
        db.casinoGame.groupBy({ by: ['provider'], _count: { provider: true } }),
        db.casinoGame.groupBy({ by: ['category'], _count: { category: true } }),
        db.casinoGame.groupBy({ by: ['gameType'], _count: { gameType: true } }),
      ]);

      return NextResponse.json({
        total,
        enabled: enabledCount,
        featured: featuredCount,
        isNew: newCount,
        live: liveCount,
        disabled: total - enabledCount,
        byProvider: byProvider
          .map((g) => ({ provider: g.provider, count: g._count.provider }))
          .sort((a, b) => b.count - a.count),
        byCategory: byCategory
          .map((g) => ({ category: g.category, count: g._count.category }))
          .sort((a, b) => b.count - a.count),
        byGameType: byGameType
          .map((g) => ({ gameType: g.gameType, count: g._count.gameType }))
          .sort((a, b) => b.count - a.count),
      });
    }

    // ── Unique providers with counts ─────────────────────────────────────
    if (action === 'providers') {
      const providers = await db.casinoGame.groupBy({
        by: ['provider'],
        _count: { provider: true, id: true },
        _min: { enabled: true },
      });

      const enriched = await Promise.all(
        providers.map(async (p) => {
          const enabledCount = await db.casinoGame.count({
            where: { provider: p.provider, enabled: true },
          });
          return {
            provider: p.provider,
            total: p._count.id,
            enabled: enabledCount,
          };
        })
      );

      return NextResponse.json(
        enriched.sort((a, b) => b.total - a.total)
      );
    }

    // ── Unique categories with counts ────────────────────────────────────
    if (action === 'categories') {
      const categories = await db.casinoGame.groupBy({
        by: ['category'],
        _count: { category: true, id: true },
      });

      const enriched = await Promise.all(
        categories.map(async (c) => {
          const enabledCount = await db.casinoGame.count({
            where: { category: c.category, enabled: true },
          });
          return {
            category: c.category,
            total: c._count.id,
            enabled: enabledCount,
          };
        })
      );

      return NextResponse.json(
        enriched.sort((a, b) => b.total - a.total)
      );
    }

    // ── Paginated game list with filters ─────────────────────────────────
    const search = searchParams.get('search') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const category = searchParams.get('category') || undefined;
    const gameType = searchParams.get('gameType') || undefined;
    const enabled = parseBooleanParam(searchParams.get('enabled'));
    const featured = parseBooleanParam(searchParams.get('featured'));
    const isNew = parseBooleanParam(searchParams.get('isNew'));
    const isLive = parseBooleanParam(searchParams.get('isLive'));
    const page = parsePagination(searchParams.get('page'), 1);
    const limit = parsePagination(searchParams.get('limit'), 50);
    const sortField = searchParams.get('sort') || 'priority';
    const order = (searchParams.get('order') || 'desc').toLowerCase();

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { alias: { contains: search } },
        { provider: { contains: search } },
        { externalId: { contains: search } },
      ];
    }
    if (provider) where.provider = provider;
    if (category) where.category = category;
    if (gameType) where.gameType = gameType;
    if (enabled !== undefined) where.enabled = enabled;
    if (featured !== undefined) where.featured = featured;
    if (isNew !== undefined) where.isNew = isNew;
    if (isLive !== undefined) where.isLive = isLive;

    // Build orderBy
    let orderBy: Record<string, 'asc' | 'desc'>;
    if (isSortField(sortField)) {
      orderBy = { [sortField]: order === 'asc' ? 'asc' : 'desc' };
    } else {
      orderBy = { priority: 'desc' };
    }

    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      db.casinoGame.findMany({
        where: where as never,
        orderBy: orderBy as never,
        skip,
        take: limit,
      }),
      db.casinoGame.count({ where: where as never }),
    ]);

    return NextResponse.json({
      data: games,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/games] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Create / Seed / Toggle / Bulk operations
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // ── Seed all games from JSON file ────────────────────────────────────
    if (action === 'seed') {
      const seedPath = path.join(process.cwd(), 'all_games_seed.json');

      if (!fs.existsSync(seedPath)) {
        return errorResponse('Seed file not found: all_games_seed.json', 404);
      }

      const raw = fs.readFileSync(seedPath, 'utf-8');
      const seedGames: SeedGame[] = JSON.parse(raw);

      if (!Array.isArray(seedGames) || seedGames.length === 0) {
        return errorResponse('Seed file is empty or invalid');
      }

      const mapped = seedGames.map((g) => ({
        externalId: String(g.externalId),
        name: g.name,
        alias: g.alias || g.name,
        provider: g.provider || 'Unknown',
        category: g.category || 'slots',
        gameType: g.gameType || 'external_slot',
        imageUrl: g.imageUrl || '',
        thumbnailUrl: g.thumbnailUrl || '',
        rtp: g.rtp ?? null,
        minBet: g.minBet ?? 0.01,
        maxBet: g.maxBet ?? 100,
        volatility: g.volatility ?? null,
        isLive: g.isLive ?? false,
        enabled: g.enabled ?? true,
        featured: g.featured ?? false,
        isNew: g.isNew ?? false,
        popularity: g.popularity ?? 0,
        priority: g.priority ?? 0,
        tags: g.tags ? JSON.stringify(g.tags) : null,
        description: g.description ?? null,
      }));

      // SQLite doesn't support skipDuplicates, seed one by one with upsert
      let created = 0;
      let skipped = 0;
      for (const game of mapped) {
        try {
          await db.casinoGame.upsert({
            where: { externalId: game.externalId },
            update: {},
            create: game,
          });
          created++;
        } catch {
          skipped++;
        }
      }

      return NextResponse.json({
        message: `Seeded ${created} games successfully (${skipped} skipped)`,
        total: seedGames.length,
        created,
        skipped,
      });
    }

    // ── Toggle a single boolean field ────────────────────────────────────
    if (action === 'toggle') {
      const { id, field } = body as {
        id: string;
        field: string;
      };

      if (!id) return errorResponse('Missing required field: id');
      if (!field || !isToggleableField(field)) {
        return errorResponse(
          `Invalid field. Must be one of: ${TOGGLEABLE_BOOLEAN_FIELDS.join(', ')}`
        );
      }

      const existing = await db.casinoGame.findUnique({ where: { id } });
      if (!existing) return errorResponse('Game not found', 404);

      const updated = await db.casinoGame.update({
        where: { id },
        data: { [field]: !existing[field] },
      });

      return NextResponse.json({
        message: `${field} toggled to ${!existing[field]}`,
        game: updated,
      });
    }

    // ── Bulk toggle ──────────────────────────────────────────────────────
    if (action === 'bulk-toggle') {
      const { ids, field, value } = body as {
        ids: string[];
        field: string;
        value: boolean;
      };

      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse('ids must be a non-empty array');
      }
      if (!field || !isToggleableField(field)) {
        return errorResponse(
          `Invalid field. Must be one of: ${TOGGLEABLE_BOOLEAN_FIELDS.join(', ')}`
        );
      }
      if (typeof value !== 'boolean') {
        return errorResponse('value must be a boolean');
      }

      const result = await db.casinoGame.updateMany({
        where: { id: { in: ids } },
        data: { [field]: value },
      });

      return NextResponse.json({
        message: `Updated ${result.count} games`,
        field,
        value,
        matched: result.count,
        requested: ids.length,
      });
    }

    // ── Bulk delete ──────────────────────────────────────────────────────
    if (action === 'bulk-delete') {
      const { ids } = body as { ids: string[] };

      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse('ids must be a non-empty array');
      }

      const result = await db.casinoGame.deleteMany({
        where: { id: { in: ids } },
      });

      return NextResponse.json({
        message: `Deleted ${result.count} games`,
        deleted: result.count,
        requested: ids.length,
      });
    }

    // ── Create single game (no action) ──────────────────────────────────
    const {
      externalId,
      name,
      alias,
      provider,
      category,
      gameType,
      imageUrl,
      thumbnailUrl,
      rtp,
      minBet,
      maxBet,
      volatility,
      isLive,
      enabled,
      featured,
      isNew,
      popularity,
      priority,
      tags,
      description,
    } = body as Partial<SeedGame & { id?: string }>;

    if (!externalId || !name) {
      return errorResponse('externalId and name are required');
    }

    const game = await db.casinoGame.create({
      data: {
        externalId: String(externalId),
        name,
        alias: alias || name,
        provider: provider || 'Unknown',
        category: category || 'slots',
        gameType: gameType || 'external_slot',
        imageUrl: imageUrl || '',
        thumbnailUrl: thumbnailUrl || '',
        rtp: rtp ?? null,
        minBet: minBet ?? 0.01,
        maxBet: maxBet ?? 100,
        volatility: volatility ?? null,
        isLive: isLive ?? false,
        enabled: enabled ?? true,
        featured: featured ?? false,
        isNew: isNew ?? false,
        popularity: popularity ?? 0,
        priority: priority ?? 0,
        tags: tags ? JSON.stringify(tags) : null,
        description: description ?? null,
      },
    });

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/games] Error:', error);

    const code = prismaErrorCode(error);
    if (code === 'P2002') {
      return errorResponse('A game with this externalId already exists', 409);
    }
    if (code) return errorResponse(`Database error: ${prismaErrorMessage(error)}`, 500);

    if (error instanceof SyntaxError) {
      return errorResponse('Invalid JSON body', 400);
    }

    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT — Update a game
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return errorResponse('Missing required field: id');

    // Verify the game exists
    const existing = await db.casinoGame.findUnique({ where: { id } });
    if (!existing) return errorResponse('Game not found', 404);

    // Sanitize update payload — only allow known fields
    const allowedFields: Record<string, unknown> = {};
    const updatable = [
      'name',
      'alias',
      'provider',
      'category',
      'gameType',
      'imageUrl',
      'thumbnailUrl',
      'rtp',
      'minBet',
      'maxBet',
      'volatility',
      'isLive',
      'enabled',
      'featured',
      'isNew',
      'popularity',
      'priority',
      'tags',
      'description',
      'externalId',
    ] as const;

    for (const key of updatable) {
      if (key in fields) {
        // Serialize array tags to JSON string for storage
        if (key === 'tags' && Array.isArray(fields[key])) {
          allowedFields[key] = JSON.stringify(fields[key]);
        } else {
          allowedFields[key] = fields[key];
        }
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return errorResponse('No valid fields to update');
    }

    const game = await db.casinoGame.update({
      where: { id },
      data: allowedFields,
    });

    return NextResponse.json({
      message: 'Game updated successfully',
      game,
    });
  } catch (error) {
    console.error('[PUT /api/games] Error:', error);

    const code = prismaErrorCode(error);
    if (code === 'P2002') return errorResponse('A game with this externalId already exists', 409);
    if (code === 'P2025') return errorResponse('Game not found', 404);
    if (code) return errorResponse(`Database error: ${prismaErrorMessage(error)}`, 500);

    if (error instanceof SyntaxError) {
      return errorResponse('Invalid JSON body', 400);
    }

    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — Remove a game
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) return errorResponse('Missing required query param: id');

    const existing = await db.casinoGame.findUnique({ where: { id } });
    if (!existing) return errorResponse('Game not found', 404);

    await db.casinoGame.delete({ where: { id } });

    return NextResponse.json({
      message: 'Game deleted successfully',
      deleted: existing,
    });
  } catch (error) {
    console.error('[DELETE /api/games] Error:', error);

    const code = prismaErrorCode(error);
    if (code === 'P2025') return errorResponse('Game not found', 404);
    if (code) return errorResponse(`Database error: ${prismaErrorMessage(error)}`, 500);

    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
