"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Play, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/casino/lib/motion";

interface GameCardProps {
  slug: string;
  name: string;
  provider: string;
  category: string;
  image: string;
  rtp?: number;
  featured?: boolean;
  popularity?: number;
  onClick?: () => void;
  className?: string;
}

const MAX_TILT = 8; // degrees, brief cap

const badgeStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const badgeItem = {
  hidden: { opacity: 0, y: -6, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export function GameCard({ slug, name, provider, category, image, rtp, featured, popularity, onClick, className }: GameCardProps) {
  const isOriginal = category === "originals";
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  // 3D tilt toward cursor — springs so the card has weight, never snaps.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 300, damping: 30 });
  const rotateY = useSpring(ry, { stiffness: 300, damping: 30 });

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * MAX_TILT * 2);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * MAX_TILT * 2);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    setHovered(false);
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onLeave}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={springs.snappy}
      style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 700 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card/40 text-left transition-colors hover:border-lime/40 hover:shadow-[0_0_24px] hover:shadow-lime/15",
        className
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* skeleton shimmer until the thumbnail lands */}
        {!loaded && <div className="skeleton-shimmer absolute inset-0" />}
        <img
          src={image}
          alt={name}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
        />
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* shimmer sweep on hover */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={false}
            animate={hovered && !reduced ? { left: "100%" } : { left: "-60%" }}
            transition={hovered && !reduced ? { duration: 0.7, ease: "easeInOut" } : { duration: 0 }}
          />
        </div>

        {/* badges — staggered entrance */}
        <motion.div
          className="absolute left-1.5 top-1.5 flex gap-1"
          variants={badgeStagger}
          initial={reduced ? false : "hidden"}
          animate="show"
        >
          {isOriginal && (
            <motion.span variants={badgeItem} transition={springs.snappy} className="rounded bg-lime px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-bg">
              Original
            </motion.span>
          )}
          {featured && !isOriginal && (
            <motion.span variants={badgeItem} transition={springs.snappy} className="flex items-center gap-0.5 rounded bg-vip/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="h-2.5 w-2.5" /> Hot
            </motion.span>
          )}
          {popularity && popularity > 9000 && (
            <motion.span variants={badgeItem} transition={springs.snappy} className="flex items-center gap-0.5 rounded bg-loss/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              <Flame className="h-2.5 w-2.5" /> Top
            </motion.span>
          )}
        </motion.div>

        {/* hover play overlay — spring pop */}
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          initial={false}
          animate={hovered && !reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            initial={false}
            animate={hovered && !reduced ? { scale: 1 } : { scale: 0.7 }}
            transition={springs.bounce}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-bg shadow-lg"
          >
            <Play className="h-5 w-5 fill-current" />
          </motion.div>
        </motion.div>

        {/* rtp */}
        {rtp && (
          <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-lime">
            {rtp}% RTP
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-xs font-semibold leading-tight">{name}</span>
        <span className="truncate text-[10px] text-muted-foreground">{provider}</span>
      </div>

      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-popover/95 px-2.5 py-1.5 text-[10px] shadow-xl backdrop-blur-xl group-hover:block">
        <div className="font-semibold text-foreground">{name}</div>
        <div className="text-muted-foreground">By {provider}</div>
        {rtp && <div className="mt-0.5 font-mono text-lime">{rtp}% RTP</div>}
      </div>
    </motion.button>
  );
}
