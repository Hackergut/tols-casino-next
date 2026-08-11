"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Package, TrendingUp, Gift } from "lucide-react";
import { RARITY_META, formatCurrency, COLLECTIONS } from "@/lib/types";
import { useUIStore } from "@/lib/store";

interface UserCard {
  id: string;
  collection: string;
  cardName: string;
  rarity: string;
  insuredValue: number;
  currency: string;
  gradingCompany: string;
  gradingId: string;
  image: string;
  packName: string;
  isNew: boolean;
}

export function MyCollection({ onOpenPacks }: { onOpenPacks?: () => void }) {
  const { setActiveSection } = useUIStore();
  const [filter, setFilter] = useFilterState();

  const { data: cards } = useQuery<UserCard[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const r = await fetch("/api/cards");
      const j = await r.json();
      return j.data;
    },
  });

  const filtered = (cards || []).filter((c) => filter === "All" || c.collection === filter);
  const totalValue = (cards || []).reduce((s, c) => s + c.insuredValue, 0);
  const byRarity = (cards || []).reduce<Record<string, number>>((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Package className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div className="flex-1">
          <h1 className=" text-xl font-bold uppercase tracking-wide">My Collection</h1>
          <p className="text-xs text-muted-foreground">Your graded collectible cards. Trade them or hold for value.</p>
        </div>
        <button
          onClick={() => setActiveSection("packs")}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
        >
          <Gift className="h-3.5 w-3.5" /> Open Packs
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Total Cards</span>
          </div>
          <div className=" text-xl font-bold">{cards?.length || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Insured Value</span>
          </div>
          <div className=" text-xl font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(totalValue)}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Mythics</span>
          </div>
          <div className=" text-xl font-bold text-lime" style={{ color: "var(--color-lime)" }}>{byRarity.mythic || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Legendaries</span>
          </div>
          <div className=" text-xl font-bold text-orange-400">{byRarity.legendary || 0}</div>
        </div>
      </div>

      {/* Collection filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {["All", ...COLLECTIONS].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === c ? "border-lime/40 bg-lime/10 text-lime" : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
            style={filter === c ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/30 py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="mb-1 text-sm font-semibold">No cards in your collection yet</p>
          <p className="mb-4 text-xs text-muted-foreground">Open a pack to start collecting rare cards!</p>
          <button
            onClick={() => setActiveSection("packs")}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide"
            style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
          >
            <Gift className="h-4 w-4" /> Browse Card Packs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((card) => {
            const rarity = RARITY_META[card.rarity] || RARITY_META.common;
            return (
              <div
                key={card.id}
                className="group relative overflow-hidden rounded-lg border bg-card/40 card-hover hover:border-lime/40"
                style={{ borderColor: rarity.color + "40" }}
              >
                {card.isNew && (
                  <div className="absolute left-1.5 top-1.5 z-10 rounded bg-red-500 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                    New
                  </div>
                )}
                <div className="relative aspect-[3/4] overflow-hidden" style={{ boxShadow: `inset 0 0 30px ${rarity.glow}` }}>
                  <img src={card.image} alt={card.cardName} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute right-1.5 top-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: rarity.color, color: "var(--color-bg)" }}>
                      {rarity.label}
                    </span>
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <div className="rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-mono text-muted-foreground">
                      {card.gradingCompany} · {card.gradingId}
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold">{card.cardName}</p>
                  <p className="text-[10px] text-muted-foreground">{card.collection}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] uppercase text-muted-foreground">Insured</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(card.insuredValue)}</span>
                  </div>
                </div>
                {/* hover actions */}
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="flex-1 rounded bg-lime py-1 text-[10px] font-bold uppercase text-black" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
                    List
                  </button>
                  <button className="flex-1 rounded border border-border/60 bg-background/80 py-1 text-[10px] font-bold uppercase text-foreground backdrop-blur">
                    Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// small hook to use useState in a component without importing it separately
import { useState } from "react";
function useFilterState() {
  return useState("All");
}
