"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Store, Gift, Sparkles, Loader2, Check, Tag, ArrowRightLeft, X, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RARITY_META, COLLECTIONS, formatCurrency } from "@/lib/types";
import { useSessionStore } from "@/lib/store";
import { toast } from "sonner";

interface MarketListing {
  id: string; cardName: string; collection: string; rarity: string; insuredValue: number;
  image: string; listingType: string; price: number; swapFor: string; sellerAlias: string; status: string;
}

interface CardPack {
  id: string; name: string; collection: string; price: number; currency: string;
  cardsPerPack: number; image: string; description: string; dropRates: string;
}

export function Marketplace({ initialTab = "market" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [collection, setCollection] = useState("All");
  const [openingResult, setOpeningResult] = useState<{ pulled: { cardName: string; rarity: string; insuredValue: number; image: string }[]; packName: string } | null>(null);
  const { balance } = useSessionStore();
  const qc = useQueryClient();

  const { data: listings } = useQuery<MarketListing[]>({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const r = await fetch("/api/marketplace");
      const j = await r.json();
      return j.data;
    },
  });

  const { data: packs } = useQuery<CardPack[]>({
    queryKey: ["packs"],
    queryFn: async () => {
      const r = await fetch("/api/packs");
      const j = await r.json();
      return j.data;
    },
  });

  const openPackMutation = useMutation({
    mutationFn: async (packId: string) => {
      const r = await fetch(`/api/packs/${packId}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (data) => {
      useSessionStore.getState().setBalance(data.newBalance);
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      setOpeningResult({ pulled: data.pulled, packName: data.packName });
      toast.success(`Opened ${data.packName}!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredListings = (listings || []).filter((l) => collection === "All" || l.collection === collection);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Store className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Collectibles Market</h1>
          <p className="text-xs text-muted-foreground">Open packs, collect graded cards, trade with the community.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-background/60">
          <TabsTrigger value="market" className="gap-1.5"><Store className="h-3.5 w-3.5" /> Marketplace</TabsTrigger>
          <TabsTrigger value="packs" className="gap-1.5"><Gift className="h-3.5 w-3.5" /> Card Packs</TabsTrigger>
        </TabsList>

        {/* Marketplace listings */}
        <TabsContent value="market" className="space-y-4 pt-3">
          {/* Collection filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {["All", ...COLLECTIONS].map((c) => (
              <button
                key={c}
                onClick={() => setCollection(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  collection === c ? "border-lime/40 bg-lime/10 text-lime" : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
                style={collection === c ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredListings.map((l) => {
              const rarity = RARITY_META[l.rarity] || RARITY_META.common;
              return (
                <div
                  key={l.id}
                  className="group overflow-hidden rounded-lg border border-border/50 bg-card/40 card-hover hover:border-lime/40"
                  style={undefined}
                >
                  <div className="relative aspect-[3/4] overflow-hidden" style={{ boxShadow: `inset 0 0 30px ${rarity.glow}` }}>
                    <img src={l.image} alt={l.cardName} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute left-1.5 top-1.5">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: rarity.color, color: "var(--color-bg)" }}>
                        {rarity.label}
                      </span>
                    </div>
                    {l.listingType === "swap" && (
                      <div className="absolute right-1.5 top-1.5">
                        <span className="flex items-center gap-0.5 rounded bg-purple-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                          <ArrowRightLeft className="h-2.5 w-2.5" /> Swap
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold">{l.cardName}</p>
                    <p className="text-[10px] text-muted-foreground">{l.collection} · {l.sellerAlias}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {l.listingType === "sale" ? (
                        <>
                          <div>
                            <div className="text-[9px] uppercase text-muted-foreground">Price</div>
                            <div className="font-mono text-sm font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(l.price)}</div>
                          </div>
                          <Button size="sm" className="h-7 px-2 text-[10px] uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
                            Buy
                          </Button>
                        </>
                      ) : (
                        <div className="w-full">
                          <div className="text-[9px] uppercase text-muted-foreground">Swap for</div>
                          <div className="truncate text-xs font-medium">{l.swapFor || "Any"}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredListings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/30 py-16 text-center">
              <Store className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No listings in this collection.</p>
            </div>
          )}
        </TabsContent>

        {/* Card packs */}
        <TabsContent value="packs" className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {packs?.map((p) => {
              let rates: Record<string, number> = {};
              try { rates = JSON.parse(p.dropRates); } catch {}
              return (
                <div key={p.id} className="overflow-hidden rounded-lg border border-border/50 bg-card/40 card-hover hover:border-lime/40">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex flex-wrap gap-1">
                        {["mythic", "legendary", "epic"].map((r) => rates[r] ? (
                          <span key={r} className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: RARITY_META[r].color, color: "var(--color-bg)" }}>
                            {r} {rates[r]}%
                          </span>
                        ) : null)}
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.cardsPerPack} cards · {p.collection}</p>
                    <Button
                      onClick={() => openPackMutation.mutate(p.id)}
                      disabled={openPackMutation.isPending || balance < p.price}
                      className="mt-2 h-8 w-full text-[10px] font-semibold uppercase tracking-wide disabled:opacity-40"
                      style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
                    >
                      {openPackMutation.isPending && openPackMutation.variables === p.id ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Opening…</>
                      ) : (
                        <>Open · {formatCurrency(p.price)}</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Pack opening result modal */}
      <Dialog open={!!openingResult} onOpenChange={(o) => !o && setOpeningResult(null)}>
        <DialogContent className="max-w-lg border-border/60 bg-popover/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-bold uppercase tracking-wide text-center">
              <PartyPopper className="h-6 w-6" style={{ color: "var(--color-lime)" }} />
              Pack Opened!
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">You pulled {openingResult?.pulled.length} cards from {openingResult?.packName}</p>
          <div className="grid grid-cols-3 gap-3 py-2">
            {openingResult?.pulled.map((card, i) => {
              const rarity = RARITY_META[card.rarity] || RARITY_META.common;
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg border bg-card/60 animate-fade-slide-up"
                  style={{ borderColor: rarity.color, boxShadow: `0 0 20px ${rarity.glow}`, animationDelay: `${i * 150}ms` }}
                >
                  <div className="relative aspect-[3/4]">
                    <img src={card.image} alt={card.cardName} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute left-1 top-1">
                      <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: rarity.color, color: "var(--color-bg)" }}>
                        {rarity.label}
                      </span>
                    </div>
                  </div>
                  <div className="p-1.5 text-center">
                    <p className="truncate text-[10px] font-semibold">{card.cardName}</p>
                    <p className="font-mono text-[10px] font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(card.insuredValue)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={() => setOpeningResult(null)} className="w-full uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
            <Check className="mr-1.5 h-4 w-4" /> Add to Collection
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
