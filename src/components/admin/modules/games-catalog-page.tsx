'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageDecoration } from '@/components/admin/shared/page-decoration';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Grid3x3,
  List,
  Star,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Gamepad2,
  Zap,
  Crown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Pencil,
  Sparkles,
  LayoutGrid,
  Dices,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Game {
  id: string;
  name: string;
  slug: string;
  provider: string;
  category: string;
  image_url: string;
  enabled: boolean;
  featured: boolean;
  is_new: boolean;
  popularity?: number;
  rtp?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface GameStats {
  total: number;
  active: number;
  providers: number;
  categories: number;
}

interface GamesResponse {
  data: Game[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type SortOption = 'name' | 'provider' | 'popularity';
type ViewMode = 'grid' | 'list';

// ─── Provider Colors ────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pragmatic: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  greentube: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', dot: 'bg-green-500' },
  novomatic: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  'ka-gaming': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-500' },
  aristocrat: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  betsoft: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  playngo: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-500' },
  pgsoft: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  skywind: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', dot: 'bg-indigo-500' },
  'c-technology': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-500' },
  original: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-500' },
};

const DEFAULT_PROVIDER_COLOR = { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', dot: 'bg-gray-500' };

function getProviderColor(provider: string) {
  const key = provider.toLowerCase().trim();
  for (const [k, v] of Object.entries(PROVIDER_COLORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_PROVIDER_COLOR;
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <LayoutGrid className="h-3.5 w-3.5" />,
  slots: <Gamepad2 className="h-3.5 w-3.5" />,
  original: <Zap className="h-3.5 w-3.5" />,
  crash: <Zap className="h-3.5 w-3.5" />,
  dice: <Dices className="h-3.5 w-3.5" />,
  mines: <Sparkles className="h-3.5 w-3.5" />,
  keno: <Zap className="h-3.5 w-3.5" />,
  wheel: <RotateCcw className="h-3.5 w-3.5" />,
  shoot: <Star className="h-3.5 w-3.5" />,
  jackpot: <Crown className="h-3.5 w-3.5" />,
  table: <Grid3x3 className="h-3.5 w-3.5" />,
  bingo: <Grid3x3 className="h-3.5 w-3.5" />,
  'instant-win': <Zap className="h-3.5 w-3.5" />,
};

const ALL_CATEGORIES = [
  'All', 'Slots', 'Original', 'Crash', 'Dice', 'Mines', 'Keno', 'Wheel', 'Shoot', 'Jackpot', 'Table', 'Bingo', 'Instant Win',
];

// ─── Image Fallback ──────────────────────────────────────────────────────────

function GameImageFallback({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent hue from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className={cn('flex items-center justify-center bg-gradient-to-br from-muted to-muted/60', className)}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 30%, 18%) 0%, hsl(${(hue + 40) % 360}, 25%, 12%) 100%)`,
      }}
    >
      <span className="text-lg font-bold text-white/70 select-none">{initials || '?'}</span>
    </div>
  );
}

// ─── Image with fallback ─────────────────────────────────────────────────────

function GameImage({ src, alt, className, fill }: { src: string; alt: string; className?: string; fill?: boolean }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error || !src) {
    return <GameImageFallback name={alt} className={className} />;
  }

  if (fill) {
    return (
      <>
        {!loaded && <Skeleton className={cn('absolute inset-0', className)} />}
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className={cn('object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </>
    );
  }

  return (
    <>
      {!loaded && <Skeleton className={className} />}
      <Image
        src={src}
        alt={alt}
        unoptimized
        className={cn('object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0 absolute inset-0', className)}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}

// ─── Skeleton Loaders ───────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GameCardSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <Card className="bg-card/40 backdrop-blur-sm border-border/50">
        <CardContent className="p-3 flex items-center gap-4">
          <Skeleton className="h-12 w-16 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-8 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </Card>
  );
}

function GamesGridSkeleton({ viewMode, count = 12 }: { viewMode: ViewMode; count?: number }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <GameCardSkeleton key={i} viewMode="list" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} viewMode="grid" />
      ))}
    </div>
  );
}

// ─── Game Card (Grid) ────────────────────────────────────────────────────────

function GameCardGrid({
  game,
  onToggle,
  onToggleFeatured,
  onToggleNew,
}: {
  game: Game;
  onToggle: (game: Game) => void;
  onToggleFeatured: (game: Game) => void;
  onToggleNew: (game: Game) => void;
}) {
  const providerColor = getProviderColor(game.provider);
  const [isToggling, setIsToggling] = useState(false);
  const [isFeaturedToggling, setIsFeaturedToggling] = useState(false);
  const [isNewToggling, setIsNewToggling] = useState(false);

  const handleToggle = useCallback(() => {
    setIsToggling(true);
    onToggle(game);
    setTimeout(() => setIsToggling(false), 600);
  }, [game, onToggle]);

  const handleFeatured = useCallback(() => {
    setIsFeaturedToggling(true);
    onToggleFeatured(game);
    setTimeout(() => setIsFeaturedToggling(false), 600);
  }, [game, onToggleFeatured]);

  const handleNew = useCallback(() => {
    setIsNewToggling(true);
    onToggleNew(game);
    setTimeout(() => setIsNewToggling(false), 600);
  }, [game, onToggleNew]);

  return (
    <Card className="group bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:scale-[1.02]">
      {/* Image Container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted/30">
        <GameImage src={game.image_url} alt={game.name} className="absolute inset-0" fill />

        {/* Status indicator */}
        <div className="absolute top-2 left-2 z-10">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm transition-all duration-200',
              game.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            )}
          >
            <div className={cn('h-1.5 w-1.5 rounded-full', game.enabled ? 'bg-emerald-400' : 'bg-red-400')} />
            {game.enabled ? 'Active' : 'Disabled'}
          </div>
        </div>

        {/* Featured badge */}
        {game.featured && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
              <Crown className="h-3 w-3" />
              Featured
            </div>
          </div>
        )}

        {/* New badge */}
        {game.is_new && (
          <div className={cn('absolute top-2 z-10', game.featured ? 'right-[76px]' : 'right-2')}>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              New
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button
            size="sm"
            className="bg-white/90 text-black hover:bg-white text-xs font-medium shadow-lg active:scale-[0.97] transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Launching ${game.name}...`);
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Launch
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 text-xs font-medium active:scale-[0.97] transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Edit: ${game.name}`);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Game Name */}
        <h3 className="text-sm font-semibold truncate" title={game.name}>
          {game.name}
        </h3>

        {/* Provider Badge + Actions Row */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-2 py-0 border font-normal truncate max-w-[70%]', providerColor.bg, providerColor.text, providerColor.border)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5 flex-shrink-0', providerColor.dot)} />
            {game.provider}
          </Badge>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Toggle enabled */}
            <button
              onClick={handleToggle}
              className={cn(
                'p-1 rounded transition-all duration-200 active:scale-[0.9]',
                game.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted'
              )}
              title={game.enabled ? 'Disable game' : 'Enable game'}
              disabled={isToggling}
            >
              {game.enabled ? (
                <ToggleRight className={cn('h-4 w-4', isToggling && 'animate-pulse')} />
              ) : (
                <ToggleLeft className={cn('h-4 w-4', isToggling && 'animate-pulse')} />
              )}
            </button>
            {/* Toggle featured */}
            <button
              onClick={handleFeatured}
              className={cn(
                'p-1 rounded transition-all duration-200 active:scale-[0.9]',
                game.featured ? 'text-amber-400 hover:bg-amber-500/10' : 'text-muted-foreground/50 hover:bg-muted'
              )}
              title={game.featured ? 'Unfeature game' : 'Feature game'}
              disabled={isFeaturedToggling}
            >
              <Star className={cn('h-3.5 w-3.5', game.featured && 'fill-current', isFeaturedToggling && 'animate-pulse')} />
            </button>
            {/* Toggle new */}
            <button
              onClick={handleNew}
              className={cn(
                'p-1 rounded transition-all duration-200 active:scale-[0.9]',
                game.is_new ? 'text-sky-400 hover:bg-sky-500/10' : 'text-muted-foreground/50 hover:bg-muted'
              )}
              title={game.is_new ? 'Remove new tag' : 'Mark as new'}
              disabled={isNewToggling}
            >
              <Sparkles className={cn('h-3.5 w-3.5', game.is_new && 'fill-current', isNewToggling && 'animate-pulse')} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Game Card (List) ────────────────────────────────────────────────────────

function GameCardList({
  game,
  onToggle,
  onToggleFeatured,
  onToggleNew,
}: {
  game: Game;
  onToggle: (game: Game) => void;
  onToggleFeatured: (game: Game) => void;
  onToggleNew: (game: Game) => void;
}) {
  const providerColor = getProviderColor(game.provider);

  return (
    <Card className="group bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200">
      <CardContent className="p-3 flex items-center gap-4">
        {/* Thumbnail */}
        <div className="relative h-12 w-16 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0">
          <GameImage src={game.image_url} alt={game.name} className="absolute inset-0" fill />
          {!game.enabled && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <EyeOff className="h-4 w-4 text-white/60" />
            </div>
          )}
        </div>

        {/* Name + Provider */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{game.name}</h3>
            {game.featured && (
              <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
            {game.is_new && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-sky-400 border-sky-500/30 bg-sky-500/10 flex-shrink-0">
                New
              </Badge>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-2 py-0 border font-normal mt-1', providerColor.bg, providerColor.text, providerColor.border)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', providerColor.dot)} />
            {game.provider}
          </Badge>
        </div>

        {/* Category */}
        <Badge variant="secondary" className="text-[10px] px-2 py-0 hidden sm:inline-flex capitalize">
          {game.category}
        </Badge>

        {/* Status */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', game.enabled ? 'bg-emerald-400' : 'bg-red-400')} />
          <span className="text-xs text-muted-foreground">{game.enabled ? 'Active' : 'Off'}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggle(game)}
            className={cn(
              'p-1.5 rounded transition-all duration-200 active:scale-[0.9]',
              game.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {game.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onToggleFeatured(game)}
            className={cn(
              'p-1.5 rounded transition-all duration-200 active:scale-[0.9]',
              game.featured ? 'text-amber-400 hover:bg-amber-500/10' : 'text-muted-foreground/50 hover:bg-muted'
            )}
          >
            <Star className={cn('h-3.5 w-3.5', game.featured && 'fill-current')} />
          </button>
          <button
            onClick={() => onToggleNew(game)}
            className={cn(
              'p-1.5 rounded transition-all duration-200 active:scale-[0.9]',
              game.is_new ? 'text-sky-400 hover:bg-sky-500/10' : 'text-muted-foreground/50 hover:bg-muted'
            )}
          >
            <Sparkles className={cn('h-3.5 w-3.5', game.is_new && 'fill-current')} />
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={() => toast.info(`Launching ${game.name}...`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function GamesPagination({
  currentPage,
  totalPages,
  onPageChange,
  total,
  limit,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
  limit: number;
}) {
  const from = (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, total);

  // Calculate visible pages
  const getPageNumbers = () => {
    const pages: (number | 'dots')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('dots');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('dots');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span> to{' '}
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span> games
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((page, i) =>
          page === 'dots' ? (
            <span key={`dots-${i}`} className="px-2 text-muted-foreground text-sm">
              ...
            </span>
          ) : (
            <Button
              key={page}
              size="icon"
              variant={page === currentPage ? 'default' : 'outline'}
              className="h-8 w-8"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}

        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function GamesCatalogPage() {
  // State: Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // State: Pagination
  const [page, setPage] = useState(1);
  const limit = 60;

  // State: Data
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // State: Loading
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isTogglingGame, setIsTogglingGame] = useState<string | null>(null);

  // ── Debounced search ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch games ───────────────────────────────────────────────────────
  const fetchGames = useCallback(async () => {
    setIsLoadingGames(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (selectedCategory !== 'All') {
        params.set('category', selectedCategory.toLowerCase());
      }
      if (selectedProvider !== 'All') {
        params.set('provider', selectedProvider);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const res = await fetch(`/api/games?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      const data: GamesResponse = await res.json();
      setGames(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error('Failed to load games');
      setGames([]);
    } finally {
      setIsLoadingGames(false);
    }
  }, [page, selectedCategory, selectedProvider, debouncedSearch, limit]);

  // ── Fetch stats ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const res = await fetch('/api/games?action=stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setIsLoadingStats(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch providers ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchProviders = async () => {
      setIsLoadingProviders(true);
      try {
        const res = await fetch('/api/games?action=providers');
        if (!res.ok) throw new Error('Failed to fetch providers');
        const data = await res.json();
        if (!cancelled) setProviders(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setIsLoadingProviders(false);
      }
    };
    fetchProviders();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch categories ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/games?action=categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      } catch {
        // use defaults
      }
    };
    fetchCategories();
    return () => { cancelled = true; };
  }, []);

  // ── Refetch games when filters change ──────────────────────────────────
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // ── Reset page when filters change ────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [selectedProvider, selectedCategory, debouncedSearch]);

  // ── Sort games client-side ────────────────────────────────────────────
  const sortedGames = useMemo(() => {
    if (!games.length) return games;
    const sorted = [...games];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'provider':
        sorted.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
        break;
      case 'popularity':
        sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
    }
    return sorted;
  }, [games, sortBy]);

  // ── Toggle handlers ───────────────────────────────────────────────────
  const handleToggleEnabled = useCallback(async (game: Game) => {
    setIsTogglingGame(game.id);
    try {
      const res = await fetch(`/api/games`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: game.id, enabled: !game.enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle game');
      setGames((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, enabled: !g.enabled } : g))
      );
      toast.success(`${game.name} ${!game.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error(`Failed to update ${game.name}`);
    } finally {
      setIsTogglingGame(null);
    }
  }, []);

  const handleToggleFeatured = useCallback(async (game: Game) => {
    setIsTogglingGame(game.id);
    try {
      const res = await fetch(`/api/games`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: game.id, featured: !game.featured }),
      });
      if (!res.ok) throw new Error('Failed to toggle featured');
      setGames((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, featured: !g.featured } : g))
      );
      toast.success(`${game.name} ${!game.featured ? 'marked as featured' : 'unfeatured'}`);
    } catch {
      toast.error(`Failed to update ${game.name}`);
    } finally {
      setIsTogglingGame(null);
    }
  }, []);

  const handleToggleNew = useCallback(async (game: Game) => {
    setIsTogglingGame(game.id);
    try {
      const res = await fetch(`/api/games`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: game.id, is_new: !game.is_new }),
      });
      if (!res.ok) throw new Error('Failed to toggle new');
      setGames((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, is_new: !g.is_new } : g))
      );
      toast.success(`${game.name} ${!game.is_new ? 'marked as new' : 'unmarked as new'}`);
    } catch {
      toast.error(`Failed to update ${game.name}`);
    } finally {
      setIsTogglingGame(null);
    }
  }, []);

  // ── Handler: Filter change resets page ────────────────────────────────
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  // ── Display categories (use fetched or default) ───────────────────────
  const displayCategories = categories.length > 0
    ? ['All', ...categories.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1))]
    : ALL_CATEGORIES;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <PageDecoration variant="purple" />
      <div className="relative z-10 space-y-6">
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Gamepad2 className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Games Catalog</h1>
              <p className="text-sm text-muted-foreground">
                Manage all {stats ? stats.total.toLocaleString() : '—'} games from {stats ? stats.providers : '—'} providers across {stats ? stats.categories : '—'} categories
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
        </div>

        {/* ── Stats Cards ──────────────────────────────────────────────── */}
        {isLoadingStats ? (
          <StatsSkeleton />
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-purple-500/20 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Games</p>
                    <p className="text-2xl font-bold mt-1">{stats.total.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Gamepad2 className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-emerald-500/20 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Games</p>
                    <p className="text-2xl font-bold mt-1">{stats.active.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-amber-500/20 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Providers</p>
                    <p className="text-2xl font-bold mt-1">{stats.providers}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-rose-500/20 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Categories</p>
                    <p className="text-2xl font-bold mt-1">{stats.categories}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Filter className="h-5 w-5 text-rose-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* ── Action Bar: Search, Sort, View Toggle ────────────────────── */}
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search games by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-background/50"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 bg-background/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="popularity">Popularity</SelectItem>
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label="Grid view"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Provider Filter Bar ───────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Providers</p>
            {selectedProvider !== 'All' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedProvider('All')}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="relative">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="flex items-center gap-2 overflow-x-auto pb-2 px-6 scrollbar-none">
              {isLoadingProviders ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
                ))
              ) : (
                <>
                  <button
                    onClick={() => handleProviderChange('All')}
                    className={cn(
                      'flex-shrink-0 px-3.5 h-8 rounded-full text-xs font-medium border transition-all duration-200 active:scale-[0.97]',
                      selectedProvider === 'All'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background/50 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                    )}
                  >
                    All Providers
                  </button>
                  {providers.map((provider) => {
                    const color = getProviderColor(provider);
                    const isActive = selectedProvider === provider;
                    return (
                      <button
                        key={provider}
                        onClick={() => handleProviderChange(provider)}
                        className={cn(
                          'flex-shrink-0 px-3.5 h-8 rounded-full text-xs font-medium border transition-all duration-200 active:scale-[0.97] flex items-center gap-1.5',
                          isActive
                            ? cn(color.bg, color.text, color.border, 'shadow-sm border')
                            : 'bg-background/50 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', isActive ? color.dot : 'bg-muted-foreground/40')} />
                        {provider}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Category Tabs ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{total.toLocaleString()}</span> games found
            </p>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {displayCategories.map((category) => {
              const catKey = category.toLowerCase();
              const isActive = selectedCategory === category;
              const icon = CATEGORY_ICONS[catKey];
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-medium border transition-all duration-200 active:scale-[0.97]',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background/50 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  {icon}
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Games Grid/List ──────────────────────────────────────────── */}
        {isLoadingGames ? (
          <GamesGridSkeleton viewMode={viewMode} />
        ) : sortedGames.length === 0 ? (
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Gamepad2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No games found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {debouncedSearch
                  ? `No games matching "${debouncedSearch}" with the current filters.`
                  : 'No games available for the selected filters. Try adjusting your criteria.'}
              </p>
              {(debouncedSearch || selectedProvider !== 'All' || selectedCategory !== 'All') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearch('');
                    setSelectedProvider('All');
                    setSelectedCategory('All');
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedGames.map((game) => (
              <GameCardGrid
                key={game.id}
                game={game}
                onToggle={handleToggleEnabled}
                onToggleFeatured={handleToggleFeatured}
                onToggleNew={handleToggleNew}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedGames.map((game) => (
              <GameCardList
                key={game.id}
                game={game}
                onToggle={handleToggleEnabled}
                onToggleFeatured={handleToggleFeatured}
                onToggleNew={handleToggleNew}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {!isLoadingGames && total > limit && (
          <GamesPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Custom scrollbar styles ──────────────────────────────────────── */}
      <style jsx global>{`
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
