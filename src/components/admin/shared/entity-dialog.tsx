'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTolsCreate, useTolsUpdate } from '@/lib/tols-hooks';
import { Loader2, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'array';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  readOnly?: boolean;
  description?: string;
  disabled?: boolean;
  defaultValue?: unknown;
  step?: string;
  group?: string;
}

interface EntityDialogProps {
  entity: string;
  title: string;
  description?: string;
  fields: FieldConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  defaultValues?: Record<string, unknown>;
}

export function EntityDialog({
  entity,
  title,
  description,
  fields,
  open,
  onOpenChange,
  editId,
  defaultValues,
}: EntityDialogProps) {
  const createMutation = useTolsCreate<Record<string, unknown>>(entity);
  const updateMutation = useTolsUpdate<Record<string, unknown>>(entity, editId || '');

  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [touched, setTouched] = React.useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const firstEditableRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (open) {
      setValues(defaultValues || {});
      setTouched(new Set());
      setShowSuccess(false);
      setSubmitProgress(0);
      // Reset focus tracking
      setTimeout(() => {
        firstEditableRef.current?.focus();
      }, 100);
    }
  }, [open, defaultValues]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = {};

    fields.forEach((field) => {
      const val = values[field.key];
      if (field.type === 'number' && val !== '' && val !== undefined) {
        cleaned[field.key] = Number(val);
      } else if (field.type === 'boolean') {
        cleaned[field.key] = Boolean(val);
      } else if (field.type === 'array' && typeof val === 'string') {
        try {
          cleaned[field.key] = JSON.parse(val);
        } catch {
          cleaned[field.key] = val.split(',').map((s) => s.trim());
        }
      } else {
        cleaned[field.key] = val ?? field.defaultValue ?? null;
      }
    });

    // Start progress animation
    setSubmitProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setSubmitProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      if (editId) {
        await updateMutation.mutateAsync(cleaned);
      } else {
        await createMutation.mutateAsync(cleaned);
      }
      // Stop progress and show completion
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setSubmitProgress(100);
      setTimeout(() => setSubmitProgress(0), 600);
      // Flash success
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
        setValues({});
      }, 800);
    } catch {
      // Stop progress on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setSubmitProgress(0);
      // error handled in hook
    }
  };

  // Group fields
  const groups = React.useMemo(() => {
    const map = new Map<string, FieldConfig[]>();
    fields.forEach((field) => {
      const g = field.group || '_default';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(field);
    });
    return map;
  }, [fields]);

  const isFieldValid = (field: FieldConfig) => {
    if (!field.required) return true;
    const val = values[field.key];
    if (val === '' || val === undefined || val === null) return false;
    return true;
  };

  const isFieldTouched = (key: string) => touched.has(key);

  const handleBlur = (key: string) => {
    setTouched((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  // Track first editable field ref
  const isFirstEditable = useCallback((field: FieldConfig) => {
    return !field.readOnly && !field.disabled && field.type !== 'boolean';
  }, []);

  const renderField = (field: FieldConfig, isFirst: boolean) => {
    const val = values[field.key] ?? field.defaultValue ?? '';
    const fieldTouched = isFieldTouched(field.key);
    const fieldValid = isFieldValid(field);
    const showValidation = field.required && fieldTouched;

    const inputClasses = cn(
      showValidation && !fieldValid && 'border-destructive/60 focus-visible:ring-destructive/30',
      showValidation && fieldValid && 'border-emerald-500/50 focus-visible:ring-emerald-500/20',
      'transition-all duration-200'
    );

    const getRef = (el: HTMLInputElement | null) => {
      if (isFirst && isFirstEditable(field)) {
        firstEditableRef.current = el;
      }
    };

    switch (field.type) {
      case 'text':
        return (
          <div
            className={cn(
              'space-y-1.5 rounded-lg p-3 transition-all duration-200',
              field.required && 'border-l-2 border-l-primary bg-primary/[0.02]'
            )}
            key={field.key}
          >
            <div className="flex items-center gap-1.5">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {showValidation && fieldValid && <Check className="h-3.5 w-3.5 text-emerald-500" />}
              {showValidation && !fieldValid && <X className="h-3.5 w-3.5 text-destructive" />}
            </div>
            <Input
              id={field.key}
              ref={getRef}
              value={String(val)}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              onBlur={() => handleBlur(field.key)}
              placeholder={field.placeholder}
              disabled={field.readOnly || field.disabled || isSubmitting}
              className={inputClasses}
              autoFocus={isFirst && isFirstEditable(field)}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
            )}
          </div>
        );
      case 'number':
        return (
          <div
            className={cn(
              'space-y-1.5 rounded-lg p-3 transition-all duration-200',
              field.required && 'border-l-2 border-l-primary bg-primary/[0.02]'
            )}
            key={field.key}
          >
            <div className="flex items-center gap-1.5">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {showValidation && fieldValid && <Check className="h-3.5 w-3.5 text-emerald-500" />}
              {showValidation && !fieldValid && <X className="h-3.5 w-3.5 text-destructive" />}
            </div>
            <Input
              id={field.key}
              ref={getRef}
              type="number"
              step={field.step || 'any'}
              value={String(val)}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              onBlur={() => handleBlur(field.key)}
              placeholder={field.placeholder}
              disabled={field.readOnly || field.disabled || isSubmitting}
              className={inputClasses}
              autoFocus={isFirst && isFirstEditable(field)}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
            )}
          </div>
        );
      case 'select':
        return (
          <div
            className={cn(
              'space-y-1.5 rounded-lg p-3 transition-all duration-200',
              field.required && 'border-l-2 border-l-primary bg-primary/[0.02]'
            )}
            key={field.key}
          >
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={String(val)}
              onValueChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
              disabled={field.disabled || isSubmitting}
            >
              <SelectTrigger className={inputClasses}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
            )}
          </div>
        );
      case 'textarea':
        return (
          <div
            className={cn(
              'space-y-1.5 rounded-lg p-3 transition-all duration-200',
              field.required && 'border-l-2 border-l-primary bg-primary/[0.02]'
            )}
            key={field.key}
          >
            <div className="flex items-center gap-1.5">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {showValidation && fieldValid && <Check className="h-3.5 w-3.5 text-emerald-500" />}
              {showValidation && !fieldValid && <X className="h-3.5 w-3.5 text-destructive" />}
            </div>
            <Textarea
              id={field.key}
              value={String(val)}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              onBlur={() => handleBlur(field.key)}
              placeholder={field.placeholder}
              rows={3}
              disabled={field.disabled || isSubmitting}
              className={inputClasses}
              autoFocus={isFirst && isFirstEditable(field)}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
            )}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center justify-between rounded-lg border p-3" key={field.key}>
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{field.label}</Label>
              {field.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
              )}
            </div>
            <Switch
              checked={Boolean(val)}
              onCheckedChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
              disabled={field.disabled || isSubmitting}
            />
          </div>
        );
      case 'array':
        return (
          <div
            className={cn(
              'space-y-1.5 rounded-lg p-3 transition-all duration-200'
            )}
            key={field.key}
          >
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </Label>
            <Input
              id={field.key}
              value={Array.isArray(val) ? val.join(', ') : String(val)}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder || 'Comma-separated values'}
              disabled={field.disabled || isSubmitting}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const groupEntries = Array.from(groups.entries());
  // Track if we've seen the first editable field
  let firstEditableSeen = false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[85vh] overflow-hidden p-0 relative">
        {/* Success glow border animation */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 rounded-lg z-[60] pointer-events-none border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            />
          )}
        </AnimatePresence>

        {/* Progress bar at top during submission */}
        <AnimatePresence>
          {(isSubmitting || submitProgress > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-0 left-0 right-0 z-50"
            >
              <Progress value={submitProgress} className="rounded-none h-1" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gradient header with icon */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/20">
                {editId ? (
                  <svg className="h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                ) : (
                  <svg className="h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                )}
              </span>
              {editId ? `Edit ${title}` : `Create ${title}`}
            </DialogTitle>
            {description && <DialogDescription className="pl-[42px]">{description}</DialogDescription>}
          </DialogHeader>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/20 via-border to-transparent" />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-6 overflow-y-auto max-h-[55vh]">
            <div className="space-y-4">
              {groupEntries.map(([groupName, groupFields]) => {
                const isDefaultGroup = groupName === '_default';

                if (isDefaultGroup) {
                  return (
                    <React.Fragment key={groupName}>
                      {groupFields.map((field) => {
                        const isFirst = !firstEditableSeen && isFirstEditable(field);
                        if (isFirst) firstEditableSeen = true;
                        return renderField(field, isFirst);
                      })}
                    </React.Fragment>
                  );
                }

                return (
                  <Collapsible key={groupName} defaultOpen className="group">
                    <CollapsibleTrigger className="flex items-center w-full gap-2 py-1 text-left rounded-md hover:bg-muted/50 transition-colors">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex-1">
                        {groupName}
                      </h4>
                      <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full">
                        {groupFields.length}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pl-3 border-l-2 border-border/50 mt-2">
                      {groupFields.map((field) => {
                        const isFirst = !firstEditableSeen && isFirstEditable(field);
                        if (isFirst) firstEditableSeen = true;
                        return renderField(field, isFirst);
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>

          <DialogFooter className="px-6 pb-5 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm shadow-primary/20 transition-all duration-200"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!isSubmitting && showSuccess && <Check className="h-4 w-4 mr-2" />}
              {showSuccess ? 'Done!' : editId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
