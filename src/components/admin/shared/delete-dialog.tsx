'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTolsDelete } from '@/lib/tols-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, ShieldAlert, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DeleteDialogProps {
  entity: string;
  entityName: string;
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel?: string;
}

export function DeleteDialog({ entity, entityName, itemId, open, onOpenChange, entityLabel }: DeleteDialogProps) {
  const deleteMutation = useTolsDelete(entity);
  const [confirmText, setConfirmText] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmText('');
      setIsConfirmed(false);
      setIsDeleting(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Check if user typed DELETE
  useEffect(() => {
    setIsConfirmed(confirmText.trim() === 'DELETE');
  }, [confirmText]);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!itemId || !isConfirmed) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(itemId);
      onOpenChange(false);

      // Show undo toast
      toast.success(`${entityName} deleted successfully`, {
        description: `The ${entityName.toLowerCase()} has been permanently removed.`,
        action: {
          label: 'Undo',
          onClick: () => {
            toast.info('Undo is not available. The item has been permanently deleted.');
          },
        },
        duration: 6000,
      });
    } catch {
      setIsDeleting(false);
      // error handled in hook
    }
  };

  const displayLabel = entityLabel || entityName;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden">
        {/* Red/amber gradient accent header area */}
        <div className="relative mb-2">
          <div className="absolute inset-0 rounded-t-lg bg-gradient-to-br from-red-500/8 via-red-500/4 to-amber-500/5 pointer-events-none" />
          <AlertDialogHeader className="relative">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/15 to-amber-500/10 border border-red-500/20 shrink-0 mt-0.5">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <AlertDialogTitle className="text-base font-semibold">
                  Delete {entityName}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  This action cannot be undone. The {entityName.toLowerCase()} and all associated data will be permanently removed.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
        </div>

        {/* Warning card with entity info */}
        <div className="mx-1 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">Warning — Destructive Action</span>
          </div>

          {/* Entity info card */}
          <div className="rounded-md border border-border/60 bg-background/60 backdrop-blur-sm px-3.5 py-2.5 flex items-center gap-2.5">
            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                {entityName}
              </span>
              <span className="font-mono text-xs text-foreground/80 truncate block mt-0.5">
                {itemId || 'Unknown'}
              </span>
            </div>
            {displayLabel && (
              <span className="text-xs font-medium text-foreground/70 bg-muted px-2 py-1 rounded-md truncate max-w-[120px]">
                {displayLabel}
              </span>
            )}
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">DELETE</span> to confirm this action
            </p>
            <Input
              ref={inputRef}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className={cn(
                'font-mono text-sm transition-all duration-200',
                isConfirmed
                  ? 'border-emerald-500/50 focus-visible:ring-emerald-500/20 bg-emerald-500/5'
                  : 'border-border focus-visible:ring-destructive/20'
              )}
              disabled={isDeleting}
            />
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
          <AlertDialogCancel className="mt-0 sm:mt-0" disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={cn(
              'relative overflow-hidden bg-gradient-to-r from-red-600 to-red-500 text-white',
              'hover:from-red-700 hover:to-red-600 shadow-sm shadow-red-500/20 border-0',
              'transition-all duration-200',
              !isConfirmed && 'opacity-40 cursor-not-allowed',
              isDeleting && 'cursor-wait'
            )}
          >
            {/* Red pulsing border animation during deletion */}
            {isDeleting && (
              <motion.div
                className="absolute inset-0 rounded-md border-2 border-red-400"
                animate={{
                  boxShadow: [
                    '0 0 0 0 color-mix(in oklab, var(--color-loss) 40%, transparent)',
                    '0 0 0 6px color-mix(in oklab, var(--color-loss) 0%, transparent)',
                    '0 0 0 0 color-mix(in oklab, var(--color-loss) 40%, transparent)',
                  ],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{ pointerEvents: 'none' }}
              />
            )}

            <AnimatePresence mode="wait">
              {isDeleting ? (
                <motion.span
                  key="deleting"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 relative z-10"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </motion.span>
              ) : (
                <motion.span
                  key="delete"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 relative z-10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Delete {entityName}
                </motion.span>
              )}
            </AnimatePresence>
          </AlertDialogAction>
        </AlertDialogFooter>

        {/* Pulse animation keyframes */}
        <style>{`
          @keyframes pulse-border-red {
            0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-loss) 30%, transparent); }
            50% { box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-loss) 0%, transparent); }
          }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
  );
}
