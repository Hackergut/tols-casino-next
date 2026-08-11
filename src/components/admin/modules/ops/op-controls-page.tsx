'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sliders,
  Zap,
  Shield,
  Target,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  Play,
  AlertTriangle,
  Loader2,
  ShieldOff,
  BarChart3,
  ArrowUpDown,
  Clock,
  User,
  Users,
  Activity,
  Ban,
  ToggleRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ==================== TYPES ====================

interface ControlRule {
  id: string;
  name: string;
  description: string | null;
  targetScope: string;
  targetValue: string | null;
  controlMode: string;
  rtpTarget: number | null;
  maxWinAmount: number | null;
  maxLossAmount: number | null;
  streakThreshold: number | null;
  enabled: boolean;
  priority: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EvaluateResult {
  playerId: string;
  username: string;
  segment: string;
  riskLevel: string;
  matchingControls: ControlRule[];
  totalMatched: number;
  evaluatedAt: string;
}

type ControlMode =
  | 'normal'
  | 'boost_win'
  | 'boost_loss'
  | 'force_win'
  | 'force_loss'
  | 'limit_rtp'
  | 'set_rtp';

type TargetScope = 'all' | 'segment' | 'individual' | 'risk_level';

interface RuleFormData {
  name: string;
  description: string;
  targetScope: TargetScope;
  targetValue: string;
  controlMode: ControlMode;
  rtpTarget: string;
  maxWinAmount: string;
  maxLossAmount: string;
  streakThreshold: string;
  priority: string;
  expiresAt: string;
  enabled: boolean;
}

const INITIAL_FORM: RuleFormData = {
  name: '',
  description: '',
  targetScope: 'all',
  targetValue: '',
  controlMode: 'normal',
  rtpTarget: '',
  maxWinAmount: '',
  maxLossAmount: '',
  streakThreshold: '',
  priority: '0',
  expiresAt: '',
  enabled: false,
};

// ==================== CONSTANTS ====================

const CONTROL_MODE_CONFIG: Record<
  ControlMode,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    icon: React.ReactNode;
  }
> = {
  normal: {
    label: 'Normal',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    description: 'Standard gameplay, no modifications applied.',
    icon: <Sliders className="size-3" />,
  },
  boost_win: {
    label: 'Boost Win',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    borderColor: 'border-green-300 dark:border-green-700',
    description: 'Slightly increases win probability for the target.',
    icon: <TrendingUp className="size-3" />,
  },
  boost_loss: {
    label: 'Boost Loss',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    borderColor: 'border-orange-300 dark:border-orange-700',
    description: 'Slightly increases loss probability for the target.',
    icon: <TrendingUp className="size-3 rotate-180" />,
  },
  force_win: {
    label: 'Force Win',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    description: 'Forces a win outcome on next qualifying spin.',
    icon: <Zap className="size-3" />,
  },
  force_loss: {
    label: 'Force Loss',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    borderColor: 'border-red-300 dark:border-red-700',
    description: 'Forces a loss outcome on next qualifying spin. HIGH RISK.',
    icon: <Ban className="size-3" />,
  },
  limit_rtp: {
    label: 'Limit RTP',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    borderColor: 'border-amber-300 dark:border-amber-700',
    description: 'Caps the RTP at a maximum threshold for the target.',
    icon: <ShieldOff className="size-3" />,
  },
  set_rtp: {
    label: 'Set RTP',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    borderColor: 'border-purple-300 dark:border-purple-700',
    description: 'Forces a specific RTP value. Most powerful control.',
    icon: <Target className="size-3" />,
  },
};

const TARGET_SCOPE_CONFIG: Record<
  TargetScope,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
  }
> = {
  all: {
    label: 'All Players',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    icon: <Users className="size-3" />,
  },
  segment: {
    label: 'Segment',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/40',
    borderColor: 'border-cyan-300 dark:border-cyan-700',
    icon: <Users className="size-3" />,
  },
  individual: {
    label: 'Individual',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    borderColor: 'border-purple-300 dark:border-purple-700',
    icon: <User className="size-3" />,
  },
  risk_level: {
    label: 'Risk Level',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    borderColor: 'border-amber-300 dark:border-amber-700',
    icon: <Activity className="size-3" />,
  },
};

const CONTROL_MODES: ControlMode[] = [
  'normal',
  'boost_win',
  'boost_loss',
  'force_win',
  'force_loss',
  'limit_rtp',
  'set_rtp',
];

const TARGET_SCOPES: TargetScope[] = ['all', 'segment', 'individual', 'risk_level'];

// ==================== FORMAT HELPERS ====================

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) <= new Date();
}

// ==================== COMPONENTS ====================

function ControlModeBadge({ mode }: { mode: ControlMode }) {
  const config = CONTROL_MODE_CONFIG[mode] || CONTROL_MODE_CONFIG.normal;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium cursor-default ${config.bgColor} ${config.color} ${config.borderColor}`}
        >
          {config.icon}
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TargetScopeBadge({ scope, value }: { scope: TargetScope; value: string | null }) {
  const config = TARGET_SCOPE_CONFIG[scope] || TARGET_SCOPE_CONFIG.all;
  if (scope === 'all') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor}`}
      >
        {config.icon}
        {config.label}
      </span>
      {value && (
        <span className="text-xs text-muted-foreground font-mono max-w-24 truncate" title={value}>
          {value}
        </span>
      )}
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  description,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={`rounded-lg p-2 ${
              color === 'text-teal-600'
                ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                : color === 'text-emerald-600'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : color === 'text-amber-600'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModeBreakdown({ rules }: { rules: ControlRule[] }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rule of rules) {
      counts[rule.controlMode] = (counts[rule.controlMode] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [rules]);

  if (breakdown.length === 0) return null;

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Rules by Mode</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-3">
          {breakdown.map(([mode, count]) => {
            const config = CONTROL_MODE_CONFIG[mode as ControlMode] || CONTROL_MODE_CONFIG.normal;
            return (
              <div
                key={mode}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className={`rounded-md p-1 ${config.bgColor} ${config.color}`}>
                  {config.icon}
                </span>
                <span className="font-medium">{config.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.bgColor} ${config.color}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== MAIN PAGE ====================

export function OpControlsPage() {
  const queryClient = useQueryClient();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<RuleFormData>(INITIAL_FORM);
  const [editingRule, setEditingRule] = useState<ControlRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ControlRule | null>(null);
  const [evaluatePlayerId, setEvaluatePlayerId] = useState('');
  const [evaluateResult, setEvaluateResult] = useState<EvaluateResult | null>(null);

  // Filter state
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');

  // ==================== QUERIES ====================

  const {
    data: rules = [],
    isLoading,
    error,
  } = useQuery<ControlRule[]>({
    queryKey: ['op-controls'],
    queryFn: async () => {
      const res = await fetch('/api/ops/controls');
      if (!res.ok) throw new Error('Failed to fetch control rules');
      return res.json();
    },
  });

  // ==================== MUTATIONS ====================

  const createMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const res = await fetch('/api/ops/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          targetScope: data.targetScope,
          targetValue: data.targetScope !== 'all' ? data.targetValue : null,
          controlMode: data.controlMode,
          rtpTarget: data.rtpTarget ? parseFloat(data.rtpTarget) : null,
          maxWinAmount: data.maxWinAmount ? parseFloat(data.maxWinAmount) : null,
          maxLossAmount: data.maxLossAmount ? parseFloat(data.maxLossAmount) : null,
          streakThreshold: data.streakThreshold ? parseInt(data.streakThreshold) : null,
          priority: data.priority ? parseInt(data.priority) : 0,
          expiresAt: data.expiresAt || null,
          enabled: data.enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to create rule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['op-controls'] });
      toast.success('Control rule created successfully');
      setCreateDialogOpen(false);
      setFormData(INITIAL_FORM);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RuleFormData & { id: string }) => {
      const res = await fetch('/api/ops/controls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.id,
          name: data.name,
          description: data.description || null,
          targetScope: data.targetScope,
          targetValue: data.targetScope !== 'all' ? data.targetValue : null,
          controlMode: data.controlMode,
          rtpTarget: data.rtpTarget ? parseFloat(data.rtpTarget) : null,
          maxWinAmount: data.maxWinAmount ? parseFloat(data.maxWinAmount) : null,
          maxLossAmount: data.maxLossAmount ? parseFloat(data.maxLossAmount) : null,
          streakThreshold: data.streakThreshold ? parseInt(data.streakThreshold) : null,
          priority: data.priority ? parseInt(data.priority) : 0,
          expiresAt: data.expiresAt || null,
          enabled: data.enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to update rule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['op-controls'] });
      toast.success('Control rule updated successfully');
      setEditDialogOpen(false);
      setEditingRule(null);
      setFormData(INITIAL_FORM);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ops/controls?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to delete rule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['op-controls'] });
      toast.success('Control rule deleted');
      setDeleteDialogOpen(false);
      setDeletingRule(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete rule');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch('/api/ops/controls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to toggle rule');
      }
      return res.json();
    },
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['op-controls'] });
      const previous = queryClient.getQueryData<ControlRule[]>(['op-controls']);
      queryClient.setQueryData<ControlRule[]>(['op-controls'], (old) =>
        old?.map((r) => (r.id === id ? { ...r, enabled } : r))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['op-controls'], context.previous);
      }
      toast.error('Failed to toggle rule');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['op-controls'] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await fetch(
        `/api/ops/controls?action=evaluate&playerId=${encodeURIComponent(playerId)}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to evaluate player');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setEvaluateResult(data);
      toast.success(`Found ${data.totalMatched} matching rule(s) for ${data.username || data.playerId}`);
    },
    onError: (err) => {
      setEvaluateResult(null);
      toast.error(err.message || 'Failed to evaluate player');
    },
  });

  // ==================== COMPUTED ====================

  const filteredRules = useMemo(() => {
    let result = [...rules];
    if (filterMode !== 'all') {
      result = result.filter((r) => r.controlMode === filterMode);
    }
    if (filterEnabled === 'enabled') {
      result = result.filter((r) => r.enabled);
    } else if (filterEnabled === 'disabled') {
      result = result.filter((r) => !r.enabled);
    }
    return result;
  }, [rules, filterMode, filterEnabled]);

  const sortedRules = useMemo(() => {
    return [...filteredRules].sort((a, b) => b.priority - a.priority);
  }, [filteredRules]);

  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.enabled && !isExpired(r.expiresAt)).length;
    const expired = rules.filter((r) => isExpired(r.expiresAt)).length;
    return { total, active, expired };
  }, [rules]);

  // ==================== HANDLERS ====================

  const handleOpenCreate = useCallback(() => {
    setFormData(INITIAL_FORM);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((rule: ControlRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      targetScope: rule.targetScope as TargetScope,
      targetValue: rule.targetValue || '',
      controlMode: rule.controlMode as ControlMode,
      rtpTarget: rule.rtpTarget?.toString() || '',
      maxWinAmount: rule.maxWinAmount?.toString() || '',
      maxLossAmount: rule.maxLossAmount?.toString() || '',
      streakThreshold: rule.streakThreshold?.toString() || '',
      priority: rule.priority.toString(),
      expiresAt: rule.expiresAt ? new Date(rule.expiresAt).toISOString().split('T')[0] : '',
      enabled: rule.enabled,
    });
    setEditDialogOpen(true);
  }, []);

  const handleOpenDelete = useCallback((rule: ControlRule) => {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  }, []);

  const handleToggle = useCallback(
    (rule: ControlRule) => {
      toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled });
    },
    [toggleMutation]
  );

  const handleCreateSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (formData.targetScope !== 'all' && !formData.targetValue.trim()) {
      toast.error('Target value is required when scope is not "All Players"');
      return;
    }
    createMutation.mutate(formData);
  }, [formData, createMutation]);

  const handleEditSubmit = useCallback(() => {
    if (!editingRule) return;
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (formData.targetScope !== 'all' && !formData.targetValue.trim()) {
      toast.error('Target value is required when scope is not "All Players"');
      return;
    }
    updateMutation.mutate({ ...formData, id: editingRule.id });
  }, [formData, editingRule, updateMutation]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingRule) return;
    deleteMutation.mutate(deletingRule.id);
  }, [deletingRule, deleteMutation]);

  const handleEvaluate = useCallback(() => {
    if (!evaluatePlayerId.trim()) {
      toast.error('Player ID is required');
      return;
    }
    setEvaluateResult(null);
    evaluateMutation.mutate(evaluatePlayerId.trim());
  }, [evaluatePlayerId, evaluateMutation]);

  const handleFormChange = useCallback(
    (field: keyof RuleFormData, value: string | boolean) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'targetScope' && value === 'all') {
          next.targetValue = '';
        }
        if (field === 'controlMode') {
          if (value !== 'limit_rtp' && value !== 'set_rtp') {
            next.rtpTarget = '';
          }
        }
        return next;
      });
    },
    []
  );

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-12">
          <AlertTriangle className="size-12 text-red-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              Failed to load control rules
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['op-controls'] })}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-100 p-2.5 dark:bg-teal-900/30">
            <Sliders className="size-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations Control</h1>
            <p className="text-sm text-muted-foreground">
              Manage player control rules, RTP settings, and outcome overrides
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEvaluatePlayerId('');
              setEvaluateResult(null);
              setEvaluateDialogOpen(true);
            }}
          >
            <Play className="size-4" />
            <span className="ml-1.5">Evaluate Player</span>
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="size-4" />
            <span className="ml-1.5">New Rule</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Rules"
          value={stats.total}
          icon={<Shield className="size-5" />}
          description="All control rules"
          color="text-teal-600"
        />
        <StatsCard
          title="Active Rules"
          value={stats.active}
          icon={<Zap className="size-5" />}
          description="Enabled & not expired"
          color="text-emerald-600"
        />
        <StatsCard
          title="Disabled"
          value={stats.total - stats.active}
          icon={<ToggleRight className="size-5" />}
          description="Disabled or expired"
          color="text-gray-600"
        />
        <StatsCard
          title="Expired"
          value={stats.expired}
          icon={<Clock className="size-5" />}
          description="Past expiration date"
          color="text-amber-600"
        />
      </div>

      {/* Mode Breakdown */}
      <ModeBreakdown rules={rules} />

      {/* Rules Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Control Rules</CardTitle>
              <CardDescription className="text-xs">
                {sortedRules.length} rule{sortedRules.length !== 1 ? 's' : ''} shown — sorted by
                priority (highest first)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterMode} onValueChange={setFilterMode}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  {CONTROL_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {CONTROL_MODE_CONFIG[mode].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEnabled} onValueChange={setFilterEnabled}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-52">Name</TableHead>
                    <TableHead className="w-44">Target Scope</TableHead>
                    <TableHead className="w-36">Control Mode</TableHead>
                    <TableHead className="w-24 text-right">RTP Target</TableHead>
                    <TableHead className="w-28 text-right">Max Win</TableHead>
                    <TableHead className="w-28 text-right">Max Loss</TableHead>
                    <TableHead className="w-28 text-right">Streak</TableHead>
                    <TableHead className="w-20 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ArrowUpDown className="size-3" />
                        Priority
                      </div>
                    </TableHead>
                    <TableHead className="w-16 text-center">Enabled</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Shield className="size-8 opacity-50" />
                          <p className="text-sm font-medium">No control rules found</p>
                          <p className="text-xs">
                            {rules.length === 0
                              ? 'Create your first rule to get started'
                              : 'Try adjusting your filters'}
                          </p>
                          {rules.length === 0 && (
                            <Button size="sm" variant="outline" className="mt-1" onClick={handleOpenCreate}>
                              <Plus className="size-3" />
                              <span className="ml-1">Create Rule</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRules.map((rule) => {
                      const expired = isExpired(rule.expiresAt);
                      return (
                        <TableRow
                          key={rule.id}
                          className={
                            expired && rule.enabled
                              ? 'opacity-60'
                              : rule.enabled
                                ? ''
                                : 'opacity-50'
                          }
                        >
                          {/* Name */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{rule.name}</span>
                                {expired && rule.enabled && (
                                  <Badge
                                    variant="outline"
                                    className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700 text-[10px] px-1.5 py-0"
                                  >
                                    EXPIRED
                                  </Badge>
                                )}
                              </div>
                              {rule.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-44" title={rule.description}>
                                  {rule.description}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Target Scope */}
                          <TableCell>
                            <TargetScopeBadge
                              scope={rule.targetScope as TargetScope}
                              value={rule.targetValue}
                            />
                          </TableCell>

                          {/* Control Mode */}
                          <TableCell>
                            <ControlModeBadge mode={rule.controlMode as ControlMode} />
                          </TableCell>

                          {/* RTP Target */}
                          <TableCell className="text-right text-sm font-mono">
                            {rule.rtpTarget != null ? (
                              <span className="text-teal-600 dark:text-teal-400">
                                {rule.rtpTarget}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Max Win */}
                          <TableCell className="text-right text-sm font-mono">
                            {rule.maxWinAmount != null ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(rule.maxWinAmount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Max Loss */}
                          <TableCell className="text-right text-sm font-mono">
                            {rule.maxLossAmount != null ? (
                              <span className="text-red-600 dark:text-red-400">
                                {formatCurrency(rule.maxLossAmount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Streak */}
                          <TableCell className="text-right text-sm">
                            {rule.streakThreshold != null ? (
                              <span className="font-mono text-amber-600 dark:text-amber-400">
                                {rule.streakThreshold}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Priority */}
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-bold ${
                                rule.priority > 0
                                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {rule.priority}
                            </span>
                          </TableCell>

                          {/* Enabled Toggle */}
                          <TableCell className="text-center">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => handleToggle(rule)}
                              disabled={toggleMutation.isPending}
                              aria-label={`Toggle ${rule.name}`}
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleOpenEdit(rule)}
                                aria-label={`Edit ${rule.name}`}
                              >
                                <Edit className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleOpenDelete(rule)}
                                aria-label={`Delete ${rule.name}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ==================== CREATE DIALOG ==================== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-md bg-teal-100 p-1.5 dark:bg-teal-900/30">
                <Plus className="size-4 text-teal-600 dark:text-teal-400" />
              </div>
              Create Control Rule
            </DialogTitle>
            <DialogDescription>
              Define a new control rule for player outcome management.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="e.g., VIP Whale Protection"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Optional description of what this rule does..."
                rows={2}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Scope</Label>
                <Select
                  value={formData.targetScope}
                  onValueChange={(v) => handleFormChange('targetScope', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {TARGET_SCOPE_CONFIG[scope].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.targetScope !== 'all' && (
                <div className="space-y-2">
                  <Label htmlFor="create-target-value">
                    Target Value <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-target-value"
                    placeholder={
                      formData.targetScope === 'segment'
                        ? 'e.g., premium'
                        : formData.targetScope === 'individual'
                          ? 'Player ID'
                          : 'e.g., high'
                    }
                    value={formData.targetValue}
                    onChange={(e) => handleFormChange('targetValue', e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {formData.targetScope === 'segment'
                      ? 'Enter segment name (standard, premium, vip, whale)'
                      : formData.targetScope === 'individual'
                        ? 'Enter the player external ID'
                        : 'Enter risk level (low, normal, high, vip, whale)'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Control Mode</Label>
                <Select
                  value={formData.controlMode}
                  onValueChange={(v) => handleFormChange('controlMode', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTROL_MODES.map((mode) => {
                      const config = CONTROL_MODE_CONFIG[mode];
                      return (
                        <SelectItem key={mode} value={mode}>
                          <span className="flex items-center gap-2">
                            <span className={config.color}>{config.icon}</span>
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {CONTROL_MODE_CONFIG[formData.controlMode].description}
                </p>
              </div>

              {(formData.controlMode === 'limit_rtp' ||
                formData.controlMode === 'set_rtp') && (
                <div className="space-y-2">
                  <Label htmlFor="create-rtp">RTP Target (%)</Label>
                  <div className="relative">
                    <Input
                      id="create-rtp"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="e.g., 85.5"
                      className="pr-8"
                      value={formData.rtpTarget}
                      onChange={(e) => handleFormChange('rtpTarget', e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="create-max-win">Max Win Amount</Label>
                <Input
                  id="create-max-win"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={formData.maxWinAmount}
                  onChange={(e) => handleFormChange('maxWinAmount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-max-loss">Max Loss Amount</Label>
                <Input
                  id="create-max-loss"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={formData.maxLossAmount}
                  onChange={(e) => handleFormChange('maxLossAmount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-streak">Streak Threshold</Label>
                <Input
                  id="create-streak"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Optional"
                  value={formData.streakThreshold}
                  onChange={(e) => handleFormChange('streakThreshold', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="create-priority">Priority</Label>
                <Input
                  id="create-priority"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Higher = checked first</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-expires">Expires At</Label>
                <Input
                  id="create-expires"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => handleFormChange('expiresAt', e.target.value)}
                />
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="create-enabled"
                    checked={formData.enabled}
                    onCheckedChange={(v) => handleFormChange('enabled', v)}
                  />
                  <Label htmlFor="create-enabled" className="cursor-pointer">
                    Enabled
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || !formData.name.trim()}
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== EDIT DIALOG ==================== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <Edit className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              Edit Control Rule
            </DialogTitle>
            <DialogDescription>
              Modify rule: <span className="font-medium text-foreground">{editingRule?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={2}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Scope</Label>
                <Select
                  value={formData.targetScope}
                  onValueChange={(v) => handleFormChange('targetScope', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {TARGET_SCOPE_CONFIG[scope].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.targetScope !== 'all' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-target-value">
                    Target Value <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-target-value"
                    placeholder={
                      formData.targetScope === 'segment'
                        ? 'e.g., premium'
                        : formData.targetScope === 'individual'
                          ? 'Player ID'
                          : 'e.g., high'
                    }
                    value={formData.targetValue}
                    onChange={(e) => handleFormChange('targetValue', e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Control Mode</Label>
                <Select
                  value={formData.controlMode}
                  onValueChange={(v) => handleFormChange('controlMode', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTROL_MODES.map((mode) => {
                      const config = CONTROL_MODE_CONFIG[mode];
                      return (
                        <SelectItem key={mode} value={mode}>
                          <span className="flex items-center gap-2">
                            <span className={config.color}>{config.icon}</span>
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {CONTROL_MODE_CONFIG[formData.controlMode].description}
                </p>
              </div>

              {(formData.controlMode === 'limit_rtp' ||
                formData.controlMode === 'set_rtp') && (
                <div className="space-y-2">
                  <Label htmlFor="edit-rtp">RTP Target (%)</Label>
                  <div className="relative">
                    <Input
                      id="edit-rtp"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="pr-8"
                      value={formData.rtpTarget}
                      onChange={(e) => handleFormChange('rtpTarget', e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-max-win">Max Win Amount</Label>
                <Input
                  id="edit-max-win"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maxWinAmount}
                  onChange={(e) => handleFormChange('maxWinAmount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-loss">Max Loss Amount</Label>
                <Input
                  id="edit-max-loss"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maxLossAmount}
                  onChange={(e) => handleFormChange('maxLossAmount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-streak">Streak Threshold</Label>
                <Input
                  id="edit-streak"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.streakThreshold}
                  onChange={(e) => handleFormChange('streakThreshold', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Input
                  id="edit-priority"
                  type="number"
                  step="1"
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expires">Expires At</Label>
                <Input
                  id="edit-expires"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => handleFormChange('expiresAt', e.target.value)}
                />
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="edit-enabled"
                    checked={formData.enabled}
                    onCheckedChange={(v) => handleFormChange('enabled', v)}
                  />
                  <Label htmlFor="edit-enabled" className="cursor-pointer">
                    Enabled
                  </Label>
                </div>
              </div>
            </div>

            {editingRule && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    Created: {formatDate(editingRule.createdAt)}
                  </div>
                  <div>
                    Updated: {formatDate(editingRule.updatedAt)}
                  </div>
                  <div>
                    ID: <span className="font-mono">{editingRule.id.slice(0, 12)}…</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={updateMutation.isPending || !formData.name.trim()}
            >
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <div className="rounded-md bg-red-100 p-1.5 dark:bg-red-900/30">
                <Trash2 className="size-4" />
              </div>
              Delete Control Rule
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingRule && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="space-y-1">
                <p className="text-sm font-medium">{deletingRule.name}</p>
                {deletingRule.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {deletingRule.description}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <ControlModeBadge mode={deletingRule.controlMode as ControlMode} />
                  <TargetScopeBadge
                    scope={deletingRule.targetScope as TargetScope}
                    value={deletingRule.targetValue}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== EVALUATE PLAYER DIALOG ==================== */}
      <Dialog open={evaluateDialogOpen} onOpenChange={setEvaluateDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-md bg-emerald-100 p-1.5 dark:bg-emerald-900/30">
                <Play className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Evaluate Player Rules
            </DialogTitle>
            <DialogDescription>
              Check which control rules apply to a specific player.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="evaluate-player-id">Player ID</Label>
                <Input
                  id="evaluate-player-id"
                  placeholder="Enter player external ID..."
                  value={evaluatePlayerId}
                  onChange={(e) => setEvaluatePlayerId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEvaluate();
                  }}
                />
              </div>
              <Button
                onClick={handleEvaluate}
                disabled={evaluateMutation.isPending || !evaluatePlayerId.trim()}
              >
                {evaluateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Evaluate
              </Button>
            </div>

            {/* Evaluation Result */}
            {evaluateResult && (
              <div className="space-y-4">
                <Separator />

                {/* Player Info */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="text-sm font-medium mb-3">Player Profile</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Player ID:</span>{' '}
                      <span className="font-mono">{evaluateResult.playerId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Username:</span>{' '}
                      <span className="font-medium">{evaluateResult.username || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Segment:</span>{' '}
                      <Badge variant="secondary" className="text-xs">
                        {evaluateResult.segment || '—'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Risk Level:</span>{' '}
                      <Badge
                        variant="outline"
                        className={
                          evaluateResult.riskLevel === 'high' || evaluateResult.riskLevel === 'whale'
                            ? 'text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                            : evaluateResult.riskLevel === 'vip'
                              ? 'text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-400'
                              : ''
                        }
                      >
                        {evaluateResult.riskLevel || '—'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Matching Controls */}
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Matching Rules ({evaluateResult.totalMatched})
                  </h4>
                  {evaluateResult.totalMatched === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Shield className="size-8 mx-auto text-muted-foreground opacity-40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No active rules apply to this player
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-3">
                        {evaluateResult.matchingControls.map((rule, index) => (
                          <div
                            key={rule.id}
                            className="rounded-lg border p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center size-5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-[10px] font-bold">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-medium">{rule.name}</span>
                              </div>
                              <ControlModeBadge mode={rule.controlMode as ControlMode} />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pl-7">
                              <span className="flex items-center gap-1">
                                <Target className="size-3" />
                                Priority: <span className="font-mono font-medium">{rule.priority}</span>
                              </span>
                              {rule.rtpTarget != null && (
                                <span>
                                  RTP: <span className="font-mono font-medium text-teal-600 dark:text-teal-400">{rule.rtpTarget}%</span>
                                </span>
                              )}
                              {rule.maxWinAmount != null && (
                                <span>
                                  Max Win: <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(rule.maxWinAmount)}</span>
                                </span>
                              )}
                              {rule.maxLossAmount != null && (
                                <span>
                                  Max Loss: <span className="font-mono font-medium text-red-600 dark:text-red-400">{formatCurrency(rule.maxLossAmount)}</span>
                                </span>
                              )}
                              {rule.streakThreshold != null && (
                                <span>
                                  Streak: <span className="font-mono font-medium">{rule.streakThreshold}</span>
                                </span>
                              )}
                            </div>
                            {rule.description && (
                              <p className="text-xs text-muted-foreground pl-7 line-clamp-2">
                                {rule.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEvaluateDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
