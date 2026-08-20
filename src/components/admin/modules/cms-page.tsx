'use client';

/*
 * Card CMS — governance section for game & promo cards.
 *
 * Operators can replace the artwork, title, tagline, reward, badge, CTA,
 * target and accent of every game card and promo card from here. Changes are
 * stored as overrides (CmsCard) and applied platform-wide instantly — the
 * lobby, the Originals shelves, the promo carousel and the promo detail
 * pages all read the same source. "Reset" deletes the override and the card
 * reverts to its built-in default.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Save, RotateCcw, Image as ImageIcon, Gamepad2, Gift, Loader2, CheckCircle2, Palette } from 'lucide-react';
import { ALL_PROMOTIONS, type TolsPromotion } from '@/components/lobby/promotions';
import { ORIGINAL_GAMES, type OriginalGameDef } from '@/components/lobby/lobby-types';
import { applyCmsToPromo, type CmsCardOverride } from '@/lib/cms-cards';
import { useCmsOverrides, refreshCmsCards } from '@/lib/use-cms-cards';

/* Every existing artwork — offered as quick picks in the image field. */
const ART_PRESETS = [
  ...ALL_PROMOTIONS.map((p) => p.image),
  ...ORIGINAL_GAMES.map((g) => `/games/originals/${g.id}.jpg`),
];

interface Draft {
  entity: 'promo' | 'game';
  key: string;
  title: string;
  tagline: string;
  reward: string;
  badge: string;
  cta: string;
  target: string;
  accent: string;
  imageUrl: string;
  enabled: boolean;
  sortOrder: number;
}

function useCmsApi() {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries();
    refreshCmsCards();
  }, [queryClient]);

  const save = useCallback(async (draft: Draft): Promise<string | null> => {
    try {
      const res = await fetch('/api/cms/cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) return j.error || 'Save failed';
      refresh();
      return null;
    } catch {
      return 'Network error';
    }
  }, [refresh]);

  const reset = useCallback(async (entity: 'promo' | 'game', key: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/cms/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, key }),
      });
      if (!res.ok) return 'Reset failed';
      refresh();
      return null;
    } catch {
      return 'Network error';
    }
  }, [refresh]);

  return { save, reset };
}

/* ── Card preview — the real TOLS card chrome at small size ── */
function CardPreview({ image, title, tagline, reward, badge, kind }: {
  image: string; title: string; tagline: string; reward: string; badge?: string; kind: string;
}) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f1015]">
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2 pt-8">
        <p className="truncate text-[11px] font-bold text-white">{title || 'Card title'}</p>
        <p className="truncate text-[9px] text-white/60">{kind} · {tagline || 'tagline'}</p>
      </div>
      {badge && (
        <span className="absolute right-2 top-2 rounded-full border border-lime/40 bg-black/60 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-lime">
          {badge}
        </span>
      )}
      <span className="absolute right-2 bottom-2 rounded bg-lime px-1.5 py-0.5 font-mono text-[9px] font-bold text-bg">
        {reward || 'reward'}
      </span>
    </div>
  );
}

/* ── One editable card row ── */
function CardEditor({ kind, keyId, defaultTitle, defaultTagline, defaultReward, defaultBadge, defaultCta, defaultTarget, defaultAccent, defaultImage, override, onChanged }: {
  kind: 'promo' | 'game';
  keyId: string;
  defaultTitle: string;
  defaultTagline: string;
  defaultReward: string;
  defaultBadge?: string;
  defaultCta?: string;
  defaultTarget?: string;
  defaultAccent?: string;
  defaultImage: string;
  override: CmsCardOverride | undefined;
  onChanged: () => void;
}) {
  const { save, reset } = useCmsApi();
  const [draft, setDraft] = useState<Draft>({
    entity: kind,
    key: keyId,
    title: override?.title ?? defaultTitle,
    tagline: override?.tagline ?? defaultTagline,
    reward: override?.reward ?? defaultReward,
    badge: override?.badge ?? defaultBadge ?? '',
    cta: override?.cta ?? defaultCta ?? '',
    target: override?.target ?? defaultTarget ?? '',
    accent: override?.accent ?? defaultAccent ?? '',
    imageUrl: override?.imageUrl ?? defaultImage,
    enabled: override?.enabled ?? true,
    sortOrder: override?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const doSave = async () => {
    setSaving(true);
    setMsg(null);
    const err = await save(draft);
    setSaving(false);
    if (err) setMsg({ ok: false, text: err });
    else {
      setMsg({ ok: true, text: 'Saved — live on the platform' });
      onChanged();
    }
  };

  const doReset = async () => {
    setSaving(true);
    setMsg(null);
    const err = await reset(kind, keyId);
    setSaving(false);
    if (err) setMsg({ ok: false, text: err });
    else {
      setMsg({ ok: true, text: 'Reset to built-in default' });
      onChanged();
    }
  };

  const changed = override !== undefined;

  return (
    <Card className="overflow-hidden border-white/8">
      <CardContent className="p-4">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Preview */}
          <div className="space-y-2">
            <CardPreview
              image={draft.imageUrl}
              title={draft.title}
              tagline={draft.tagline}
              reward={draft.reward}
              badge={draft.badge}
              kind={kind === 'promo' ? 'Promo' : 'Original'}
            />
            <div className="flex items-center justify-between">
              <Badge variant={changed ? 'default' : 'outline'} className={changed ? 'bg-lime text-bg' : ''}>
                {changed ? 'Overridden' : 'Default'}
              </Badge>
              <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                <Switch checked={draft.enabled} onCheckedChange={(v) => set('enabled', v)} /> Visible
              </label>
            </div>
            {msg && (
              <p className={`flex items-center gap-1 text-[11px] ${msg.ok ? 'text-lime' : 'text-red-400'}`}>
                <CheckCircle2 className="h-3 w-3" /> {msg.text}
              </p>
            )}
          </div>

          {/* Fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Title</span>
              <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Reward</span>
              <Input value={draft.reward} onChange={(e) => set('reward', e.target.value)} placeholder="100% up to $1,000" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Tagline</span>
              <Textarea rows={2} value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Badge</span>
              <Input value={draft.badge} onChange={(e) => set('badge', e.target.value)} placeholder="New players / Live" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">CTA label</span>
              <Input value={draft.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Claim" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Target</span>
              <Input value={draft.target} onChange={(e) => set('target', e.target.value)} placeholder="register / vip / originals" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Accent (CSS color)</span>
              <div className="flex items-center gap-2">
                <Input value={draft.accent} onChange={(e) => set('accent', e.target.value)} placeholder="var(--color-lime)" />
                {draft.accent && (
                  <span className="h-8 w-8 shrink-0 rounded-md border border-white/15" style={{ background: draft.accent }} />
                )}
              </div>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                <ImageIcon className="h-3 w-3" /> Image URL
              </span>
              <Input
                list="cms-art-presets"
                value={draft.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                placeholder="/promos/welcome.jpg or https://…"
              />
              <datalist id="cms-art-presets">
                {ART_PRESETS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </label>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Button size="sm" onClick={doSave} disabled={saving} className="gap-1.5 bg-lime text-bg hover:bg-lime/90">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={doReset} disabled={saving || !changed} className="gap-1.5 text-white/60">
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CmsPage() {
  const overrides = useCmsOverrides();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const promoRows = useMemo(
    () => ALL_PROMOTIONS.map((promo: TolsPromotion) => ({
      promo,
      override: overrides.get(`promo:${promo.id}`),
    })),
    [overrides, tick],
  );

  const gameRows = useMemo(
    () => ORIGINAL_GAMES.map((game: OriginalGameDef) => ({
      game,
      override: overrides.get(`game:${game.id}`),
    })),
    [overrides, tick],
  );

  const overriddenCount = promoRows.filter((r) => r.override).length + gameRows.filter((r) => r.override).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white">
            <Palette className="h-5 w-5 text-lime" /> Card CMS
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Replace any game or promo card from here — changes go live instantly across the platform.
            <Badge className="ml-2 bg-lime text-bg">{overriddenCount} overridden</Badge>
          </p>
        </div>
      </div>

      <Tabs defaultValue="promos">
        <TabsList>
          <TabsTrigger value="promos" className="gap-1.5"><Gift className="h-3.5 w-3.5" /> Promo cards ({promoRows.length})</TabsTrigger>
          <TabsTrigger value="games" className="gap-1.5"><Gamepad2 className="h-3.5 w-3.5" /> Game cards ({gameRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="promos" className="space-y-4 pt-4">
          {promoRows.map(({ promo, override }) => (
            <CardEditor
              key={`promo:${promo.id}:${tick}:${overrides.get(`promo:${promo.id}`)?.updatedAt ?? 'd'}`}
              kind="promo"
              keyId={promo.id}
              defaultTitle={promo.title}
              defaultTagline={promo.tagline}
              defaultReward={promo.reward}
              defaultBadge={promo.badge}
              defaultCta={promo.cta}
              defaultTarget={promo.target}
              defaultAccent={promo.accent}
              defaultImage={promo.image}
              override={override}
              onChanged={refresh}
            />
          ))}
        </TabsContent>

        <TabsContent value="games" className="space-y-4 pt-4">
          {gameRows.map(({ game, override }) => (
            <CardEditor
              key={`game:${game.id}:${tick}:${overrides.get(`game:${game.id}`)?.updatedAt ?? 'd'}`}
              kind="game"
              keyId={game.id}
              defaultTitle={game.name}
              defaultTagline={game.desc}
              defaultReward={`RTP ${(game.rtp ?? 99).toFixed(1)}%`}
              defaultImage={`/games/originals/${game.id}.jpg`}
              override={override}
              onChanged={refresh}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
