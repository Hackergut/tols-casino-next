'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Database, Globe, Radio, Shield, WifiOff, Zap } from 'lucide-react';

interface BridgeHealth {
  ok: boolean;
  timestamp: string;
  latencyMs?: number;
  casino?: { origin: string };
  tower?: {
    origin: string;
    apiBase: string;
    reachable: boolean | null;
    status?: number;
    latencyMs?: number;
    error?: string;
    url?: string;
  };
  link?: {
    live: boolean;
    status: 'live' | 'degraded' | 'offline';
    source: string;
    secretReady: boolean;
    jwtReady: boolean;
  };
  db?: { ok: boolean; latencyMs?: number; error?: string };
  bridge?: { configured: boolean; source: string };
}

function hostOf(origin?: string) {
  if (!origin) return '—';
  try { return new URL(origin).host; } catch { return origin.replace(/^https?:\/\//, ''); }
}

export function GovernanceLiveLink() {
  const [beats, setBeats] = useState(0);
  const healthQ = useQuery<BridgeHealth>({
    queryKey: ['bridge-health', 'live'],
    queryFn: async () => {
      const r = await fetch('/api/bridge/health?probe=true&heartbeat=1', { cache: 'no-store' });
      return r.json();
    },
    refetchInterval: 5000,
  });

  const health = healthQ.data;
  const live = Boolean(health?.link?.live);
  const reachable = health?.tower?.reachable === true;
  const status = health?.link?.status || (healthQ.isLoading ? 'checking' : 'offline');
  const latency = health?.tower?.latencyMs ?? health?.latencyMs ?? null;

  useEffect(() => {
    if (health?.timestamp) setBeats((n) => n + 1);
  }, [health?.timestamp]);

  const tone =
    status === 'live' ? 'emerald' :
    status === 'degraded' ? 'amber' :
    status === 'checking' ? 'slate' : 'rose';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07080c]">
      <style>{`
        @keyframes tolsLinkDash { to { stroke-dashoffset: -48; } }
        @keyframes tolsOrbPulse { 0%, 100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.55); opacity: 0; } }
        @keyframes tolsScan { 0% { transform: translateX(-30%); opacity: 0; } 20% { opacity: .5; } 100% { transform: translateX(130%); opacity: 0; } }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            status === 'live'
              ? 'radial-gradient(ellipse at 18% 50%, rgba(16,185,129,.22), transparent 55%), radial-gradient(ellipse at 82% 50%, rgba(204,255,0,.16), transparent 55%)'
              : status === 'degraded'
                ? 'radial-gradient(ellipse at 50% 50%, rgba(245,158,11,.16), transparent 60%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(244,63,94,.12), transparent 60%)',
        }}
      />
      {live && (
        <div
          className="pointer-events-none absolute inset-y-8 left-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent"
          style={{ animation: 'tolsScan 3.4s ease-in-out infinite' }}
        />
      )}

      <div className="relative z-10 space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Live backend link</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <Radio className={`h-4 w-4 ${live ? 'text-emerald-400' : 'text-rose-400'}`} />
              Casino ↔ Governance
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Service-to-service HTTPS to <span className="font-mono text-white/70">{hostOf(health?.tower?.origin)}</span>
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider
            ${status === 'live' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' :
              status === 'degraded' ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' :
              status === 'checking' ? 'border-white/15 bg-white/5 text-white/60' :
              'border-rose-400/40 bg-rose-400/10 text-rose-300'}`}>
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${
                status === 'live' ? 'bg-emerald-400' : status === 'degraded' ? 'bg-amber-400' : status === 'checking' ? 'bg-white/40' : 'bg-rose-400'
              }`} />
            </span>
            {status === 'live' ? 'Live' : status === 'degraded' ? 'Degraded' : status === 'checking' ? 'Linking…' : 'Offline'}
            {latency != null && reachable ? ` · ${latency}ms` : ''}
          </div>
        </div>

        <div className="relative mx-auto h-[220px] w-full max-w-3xl">
          <svg viewBox="0 0 640 168" className="h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="tolsLinkStroke" x1="0" x2="1">
                <stop offset="0%" stopColor={live ? '#34d399' : tone === 'amber' ? '#fbbf24' : '#fb7185'} />
                <stop offset="50%" stopColor={live ? '#ccff00' : tone === 'amber' ? '#f59e0b' : '#e11d48'} />
                <stop offset="100%" stopColor={live ? '#34d399' : tone === 'amber' ? '#fbbf24' : '#fb7185'} />
              </linearGradient>
              <filter id="tolsGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path
              d="M 110 84 C 220 18, 420 150, 530 84"
              fill="none"
              stroke="url(#tolsLinkStroke)"
              strokeWidth={live ? 3 : 2}
              strokeDasharray={live ? '10 8' : '4 10'}
              strokeLinecap="round"
              filter="url(#tolsGlow)"
              style={live ? { animation: 'tolsLinkDash 1.1s linear infinite' } : undefined}
              opacity={0.9}
            />
            {live && (
              <>
                <circle r="5" fill="#ccff00" filter="url(#tolsGlow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M 110 84 C 220 18, 420 150, 530 84" />
                </circle>
                <circle r="3.5" fill="#34d399">
                  <animateMotion dur="1.8s" begin="0.6s" repeatCount="indefinite" path="M 110 84 C 220 18, 420 150, 530 84" />
                </circle>
                <circle r="4.5" fill="#a3e635" filter="url(#tolsGlow)">
                  <animateMotion dur="2.1s" begin="0.3s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="M 110 84 C 220 18, 420 150, 530 84" />
                </circle>
              </>
            )}
          </svg>

          <Node
            side="left"
            title="TOLS Casino"
            host={hostOf(health?.casino?.origin)}
            icon={<Database className="h-5 w-5" />}
            ok={health?.db?.ok === true}
            live={live}
          />
          <Node
            side="right"
            title="Governance"
            host={hostOf(health?.tower?.origin)}
            icon={<Globe className="h-5 w-5" />}
            ok={reachable}
            live={live}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Database" value={health?.db?.ok ? `${health.db.latencyMs ?? 0}ms` : (health?.db?.error?.slice(0, 28) || 'down')} ok={health?.db?.ok} icon={<Database className="h-3.5 w-3.5" />} />
          <Metric label="Tower HTTP" value={reachable ? `${health?.tower?.status ?? '—'} · ${latency ?? '—'}ms` : (health?.tower?.error || 'no link')} ok={reachable} icon={<Globe className="h-3.5 w-3.5" />} />
          <Metric label="HMAC secret" value={health?.link?.secretReady || health?.bridge?.configured ? 'ready' : 'missing'} ok={Boolean(health?.link?.secretReady || health?.bridge?.configured)} icon={<Shield className="h-3.5 w-3.5" />} />
          <Metric label="Heartbeats" value={String(beats)} ok={live} icon={live ? <Activity className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} />
        </div>

        {!live && (
          <p className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {health?.db?.ok === false
              ? 'Casino database is unreachable — the live link cannot start.'
              : !reachable
                ? `Governance at ${hostOf(health?.tower?.origin)} did not answer. Check GOVERNANCE_TOWER_URL and that gov.tols.fun is up.`
                : 'Bridge secret is missing. Set GOVERNANCE_BRIDGE_SECRET on both projects (same value).'}
          </p>
        )}
      </div>
    </div>
  );
}

function Node({
  side, title, host, icon, ok, live,
}: {
  side: 'left' | 'right';
  title: string;
  host: string;
  icon: ReactNode;
  ok: boolean;
  live: boolean;
}) {
  return (
    <div className={`absolute top-1/2 ${side === 'left' ? 'left-0' : 'right-0'} w-[132px] -translate-y-1/2`}>
      <div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center">
        {live && (
          <>
            <span className="absolute inset-3 rounded-full border border-emerald-400/30" style={{ animation: 'tolsOrbPulse 2.2s ease-out infinite' }} />
            <span className="absolute inset-3 rounded-full border border-lime-400/20" style={{ animation: 'tolsOrbPulse 2.2s ease-out infinite 0.7s' }} />
          </>
        )}
        <div className={`relative flex h-20 w-20 flex-col items-center justify-center rounded-2xl border bg-black/60 shadow-xl backdrop-blur
          ${ok ? 'border-emerald-400/40 text-emerald-300' : 'border-rose-400/30 text-rose-300'}`}>
          {icon}
          <span className="mt-1 text-[9px] font-black uppercase tracking-widest">{title.split(' ')[0]}</span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-[11px] font-semibold text-white">{title}</p>
        <p className="truncate font-mono text-[10px] text-white/45">{host}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, ok, icon }: { label: string; value: string; ok?: boolean; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
        {icon}{label}
      </div>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${ok ? 'text-emerald-300' : 'text-white/70'}`}>{value}</p>
    </div>
  );
}
