'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check, X, Fingerprint, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAdminStore } from '@/stores/admin';
import { ENTITY_ID_FIELD_MAP, ENTITY_LINK_LABELS } from '@/components/admin/shared/entity-cross-links';

interface DetailDialogProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, unknown> | null;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const s = status?.toLowerCase() || '';
  if (['active', 'confirmed', 'completed', 'win', 'paid', 'rewarded', 'sold', 'approved'].includes(s))
    return 'default';
  if (['pending', 'processing'].includes(s)) return 'secondary';
  if (['suspended', 'locked', 'maintenance', 'ended', 'expired'].includes(s)) return 'outline';
  if (['banned', 'failed', 'rejected', 'cancelled', 'loss', 'eliminated'].includes(s))
    return 'destructive';
  return 'secondary';
}

function getStatusHeaderGradient(status: string): string {
  const s = status?.toLowerCase() || '';
  if (['active', 'confirmed', 'completed', 'win', 'paid', 'rewarded', 'sold', 'approved'].includes(s))
    return 'from-emerald-500/10 via-emerald-500/5 to-transparent';
  if (['pending', 'processing'].includes(s))
    return 'from-amber-500/10 via-amber-500/5 to-transparent';
  if (['suspended', 'locked', 'maintenance', 'ended', 'expired'].includes(s))
    return 'from-orange-500/10 via-orange-500/5 to-transparent';
  if (['banned', 'failed', 'rejected', 'cancelled', 'loss', 'eliminated'].includes(s))
    return 'from-red-500/10 via-red-500/5 to-transparent';
  return 'from-primary/10 via-primary/5 to-transparent';
}

function getStatusBorderColor(status: string): string {
  const s = status?.toLowerCase() || '';
  if (['active', 'confirmed', 'completed', 'win', 'paid', 'rewarded', 'sold', 'approved'].includes(s))
    return 'border-l-emerald-500';
  if (['pending', 'processing'].includes(s))
    return 'border-l-amber-500';
  if (['suspended', 'locked', 'maintenance', 'ended', 'expired'].includes(s))
    return 'border-l-orange-500';
  if (['banned', 'failed', 'rejected', 'cancelled', 'loss', 'eliminated'].includes(s))
    return 'border-l-red-500';
  return 'border-l-primary';
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const r = role?.toLowerCase() || '';
  if (['admin', 'superadmin', 'root', 'owner'].includes(r)) return 'destructive';
  if (['moderator', 'manager', 'editor'].includes(r)) return 'default';
  if (['user', 'member', 'viewer'].includes(r)) return 'secondary';
  return 'outline';
}

function findStatusField(data: Record<string, unknown>): string | null {
  for (const key of Object.keys(data)) {
    if (key.toLowerCase().includes('status') && typeof data[key] === 'string') {
      return String(data[key]);
    }
  }
  return null;
}

function findRoleField(data: Record<string, unknown>): string | null {
  for (const key of Object.keys(data)) {
    if (key.toLowerCase().includes('role') && typeof data[key] === 'string') {
      return String(data[key]);
    }
  }
  return null;
}

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const sizeClasses = size === 'xs' ? 'h-5 w-5' : 'h-6 w-6';
  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        `${sizeClasses} transition-all duration-300 shrink-0`,
        copied && 'bg-emerald-500/10 text-emerald-500'
      )}
      onClick={handleCopy}
    >
      <Check className={cn(
        `${iconSize} absolute transition-all duration-300`,
        copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      )} />
      <Copy className={cn(
        `${iconSize} transition-all duration-300`,
        copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
      )} />
    </Button>
  );
}

export function DetailDialog({ title, open, onOpenChange, data }: DetailDialogProps) {
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const setSelectedEntityId = useAdminStore((s) => s.setSelectedEntityId);

  if (!data) return null;

  const statusValue = findStatusField(data);
  const roleValue = findRoleField(data);
  const headerGradient = getStatusHeaderGradient(statusValue || '');
  const borderColor = statusValue ? getStatusBorderColor(statusValue) : 'border-l-primary';

  const formatValue = (key: string, val: unknown): { node: React.ReactNode; isString: boolean } => {
    const keyLower = key.toLowerCase();

    if (keyLower.includes('status')) {
      return { node: <Badge variant={getStatusVariant(String(val))}>{String(val)}</Badge>, isString: false };
    }
    if (keyLower.includes('role')) {
      return { node: <Badge variant={getRoleBadgeVariant(String(val))}>{String(val)}</Badge>, isString: false };
    }
    if (val === null || val === undefined)
      return { node: <span className="text-muted-foreground italic">—</span>, isString: false };
    if (typeof val === 'boolean')
      return { node: <Badge variant={val ? 'default' : 'outline'}>{val ? 'Yes' : 'No'}</Badge>, isString: false };
    if (typeof val === 'object')
      return {
        node: (
          <pre className="text-xs bg-muted/60 p-2.5 rounded-lg overflow-x-auto max-w-full font-mono leading-relaxed">
            {JSON.stringify(val, null, 2)}
          </pre>
        ),
        isString: false,
      };
    return {
      node: <span className="text-sm leading-relaxed break-all">{String(val)}</span>,
      isString: typeof val === 'string',
    };
  };

  /** Check if a field key maps to a navigable entity page */
  const isEntityIdField = (key: string, val: unknown): boolean => {
    return !!(
      ENTITY_ID_FIELD_MAP[key] &&
      typeof val === 'string' &&
      val.trim().length > 0
    );
  };

  /** Navigate to a related entity page */
  const handleNavigateToEntity = (fieldKey: string, entityId: string) => {
    const targetPage = ENTITY_ID_FIELD_MAP[fieldKey];
    if (!targetPage) return;
    setSelectedEntityId(entityId);
    setCurrentPage(targetPage);
    onOpenChange(false);
  };

  const entries = Object.entries(data).filter(([k]) => k !== 'id');
  const id = String(data.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'sm:max-w-[640px] max-h-[85vh] p-0 overflow-hidden border-l-4',
        borderColor
      )}>
        {/* Status-colored header with gradient bar */}
        <div className={`bg-gradient-to-r ${headerGradient} px-6 pt-6 pb-4 relative`}>
          {/* Subtle gradient bar at top of dialog */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              {title} Details
              {statusValue && (
                <Badge variant={getStatusVariant(statusValue)} className="ml-1">
                  {statusValue}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* ID with copy button */}
          <div className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5 bg-background/70 backdrop-blur-sm rounded-lg border border-border/60 shadow-sm">
            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ID</span>
            <span className="font-mono text-xs flex-1 truncate text-foreground/80">{id}</span>
            <CopyButton text={id} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/20 via-border to-transparent" />
        </div>

        <ScrollArea className="max-h-[55vh] px-6 pb-4">
          <div className="pt-4">
            {/* 2-column responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entries.map(([key, val], idx) => {
                const { node, isString } = formatValue(key, val);
                const isEntityLink = isEntityIdField(key, val);
                const targetPage = isEntityLink ? ENTITY_ID_FIELD_MAP[key] : null;
                const entityLabel = targetPage ? ENTITY_LINK_LABELS[targetPage] : '';
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.5) }}
                    className={cn(
                      'group/field rounded-lg border border-border/50 bg-background/50 p-3.5',
                      'hover:bg-muted/30 hover:border-border transition-all duration-200',
                      'hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-1">
                        {isString && <CopyButton text={String(val)} size="xs" />}
                        {isEntityLink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 gap-1 px-1.5 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleNavigateToEntity(key, String(val))}
                          >
                            <span className="text-[10px] font-medium">{entityLabel}</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1">{node}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Close button at bottom */}
        <div className="px-6 pb-4 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
