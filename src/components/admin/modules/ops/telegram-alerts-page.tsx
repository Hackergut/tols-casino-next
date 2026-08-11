'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Bell,
  Send,
  Settings,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Edit,
  Trash2,
  Play,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Loader2,
  Activity,
  Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

type EventType =
  | 'deposit'
  | 'withdrawal'
  | 'streak'
  | 'big_win'
  | 'big_loss'
  | 'new_player'
  | 'control_applied'
  | 'custom';

type NotificationStatus = 'sent' | 'failed' | 'pending';

type ConditionOperator = '>' | '<' | '>=' | '<=' | '==';
type ConditionField = 'amount' | 'streak' | 'deposit_count';

interface Condition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number;
}

interface AlertRule {
  id: string;
  name: string;
  event_type: EventType;
  condition: Condition;
  telegram_chat_id: string;
  thread_id?: string;
  message_template?: string;
  cooldown_minutes: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Notification {
  id: string;
  rule_id: string;
  rule_name?: string;
  status: NotificationStatus;
  message: string;
  error?: string;
  sent_at?: string;
  created_at: string;
}

interface BotStatus {
  connected: boolean;
  bot_username?: string;
}

interface TelegramApiResponse {
  rules?: AlertRule[];
  notifications?: Notification[];
  stats?: {
    total_rules: number;
    active_rules: number;
    sent_today: number;
    failed_today: number;
  };
  bot_status?: BotStatus;
}

// ─── Constants ───────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { emoji: string; label: string; color: string }
> = {
  deposit: { emoji: '💰', label: 'Deposit', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  withdrawal: { emoji: '💸', label: 'Withdrawal', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  streak: { emoji: '🔥', label: 'Streak', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  big_win: { emoji: '🏆', label: 'Big Win', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  big_loss: { emoji: '⚠️', label: 'Big Loss', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  new_player: { emoji: '👤', label: 'New Player', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  control_applied: { emoji: '🎮', label: 'Control Applied', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  custom: { emoji: '⚙️', label: 'Custom', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const EVENT_TYPES: EventType[] = [
  'deposit',
  'withdrawal',
  'streak',
  'big_win',
  'big_loss',
  'new_player',
  'control_applied',
  'custom',
];

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'amount', label: 'Amount' },
  { value: 'streak', label: 'Streak' },
  { value: 'deposit_count', label: 'Deposit Count' },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
];

const DEFAULT_MESSAGE_TEMPLATE =
  '🔔 Alert: {event}\n👤 Player: {player}\n💰 Amount: {amount}\n⏰ {timestamp}';

const EMPTY_RULE_FORM = {
  name: '',
  event_type: 'deposit' as EventType,
  condition_field: 'amount' as ConditionField,
  condition_operator: '>' as ConditionOperator,
  condition_value: 0,
  telegram_chat_id: '',
  thread_id: '',
  message_template: DEFAULT_MESSAGE_TEMPLATE,
  cooldown_minutes: 5,
  enabled: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCondition(condition: Condition): string {
  const fieldLabel =
    CONDITION_FIELDS.find((f) => f.value === condition.field)?.label ?? condition.field;
  return `${fieldLabel} ${condition.operator} ${condition.value}`;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function statusIcon(status: NotificationStatus) {
  switch (status) {
    case 'sent':
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
  }
}

// ─── Component ───────────────────────────────────────────────────────

export function TelegramAlertsPage() {
  const queryClient = useQueryClient();

  // State: Bot config
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // State: Dialogs
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // State: Form
  const [form, setForm] = useState(EMPTY_RULE_FORM);

  // ── Queries ──────────────────────────────────────────────────────

  const rulesQuery = useQuery<TelegramApiResponse>({
    queryKey: ['telegram-alerts', 'rules'],
    queryFn: async () => {
      const res = await fetch('/api/ops/telegram');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to fetch rules (${res.status})`);
      }
      return res.json();
    },
    staleTime: 15_000,
  });

  const notificationsQuery = useQuery<TelegramApiResponse>({
    queryKey: ['telegram-alerts', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/ops/telegram?notifications=true&limit=50');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to fetch notifications (${res.status})`);
      }
      return res.json();
    },
    staleTime: 15_000,
    enabled: historyOpen,
  });

  const rules: AlertRule[] = rulesQuery.data?.rules ?? [];
  const notifications: Notification[] = notificationsQuery.data?.notifications ?? [];
  const stats = rulesQuery.data?.stats;
  const botStatus = rulesQuery.data?.bot_status;

  // ── Mutations ─────────────────────────────────────────────────────

  const configMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch('/api/ops/telegram?action=config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Config failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Bot token configured successfully');
      queryClient.invalidateQueries({ queryKey: ['telegram-alerts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/telegram?action=config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Connection test failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => toast.success('Bot connection successful'),
    onError: (err) => toast.error(err.message),
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        name: data.name,
        event_type: data.event_type,
        condition: {
          field: data.condition_field,
          operator: data.condition_operator,
          value: data.condition_value,
        },
        telegram_chat_id: data.telegram_chat_id,
        thread_id: data.thread_id || undefined,
        message_template: data.message_template || undefined,
        cooldown_minutes: data.cooldown_minutes,
        enabled: data.enabled,
      };
      const res = await fetch('/api/ops/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Create failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Alert rule created');
      closeRuleDialog();
      queryClient.invalidateQueries({ queryKey: ['telegram-alerts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async (data: typeof form & { id: string }) => {
      const payload = {
        id: data.id,
        name: data.name,
        event_type: data.event_type,
        condition: {
          field: data.condition_field,
          operator: data.condition_operator,
          value: data.condition_value,
        },
        telegram_chat_id: data.telegram_chat_id,
        thread_id: data.thread_id || undefined,
        message_template: data.message_template || undefined,
        cooldown_minutes: data.cooldown_minutes,
        enabled: data.enabled,
      };
      const res = await fetch('/api/ops/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Update failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Alert rule updated');
      closeRuleDialog();
      queryClient.invalidateQueries({ queryKey: ['telegram-alerts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ops/telegram?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Rule deleted');
      setDeletingRule(null);
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['telegram-alerts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const sendTestMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch('/api/ops/telegram?action=send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: ruleId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Test send failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => toast.success('Test alert sent'),
    onError: (err) => toast.error(err.message),
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/telegram?action=process-queue', {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Queue processing failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Queue processing triggered');
      queryClient.invalidateQueries({ queryKey: ['telegram-alerts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Form helpers ─────────────────────────────────────────────────

  const openCreateDialog = useCallback(() => {
    setEditingRule(null);
    setForm(EMPTY_RULE_FORM);
    setRuleDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      event_type: rule.event_type,
      condition_field: rule.condition.field,
      condition_operator: rule.condition.operator,
      condition_value: rule.condition.value,
      telegram_chat_id: rule.telegram_chat_id,
      thread_id: rule.thread_id ?? '',
      message_template: rule.message_template ?? DEFAULT_MESSAGE_TEMPLATE,
      cooldown_minutes: rule.cooldown_minutes,
      enabled: rule.enabled,
    });
    setRuleDialogOpen(true);
  }, []);

  const closeRuleDialog = useCallback(() => {
    setRuleDialogOpen(false);
    setEditingRule(null);
    setForm(EMPTY_RULE_FORM);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (!form.telegram_chat_id.trim()) {
      toast.error('Telegram Chat ID is required');
      return;
    }
    if (editingRule) {
      updateRuleMutation.mutate({ ...form, id: editingRule.id });
    } else {
      createRuleMutation.mutate(form);
    }
  }, [form, editingRule, updateRuleMutation, createRuleMutation]);

  const handleDelete = useCallback(() => {
    if (deletingRule) {
      deleteRuleMutation.mutate(deletingRule.id);
    }
  }, [deletingRule, deleteRuleMutation]);

  const updateForm = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isSaving = createRuleMutation.isPending || updateRuleMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Telegram Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Telegram bot and manage alert notification rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => processQueueMutation.mutate()}
            disabled={processQueueMutation.isPending}
          >
            {processQueueMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1.5" />
            )}
            Process Queue
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Rules</p>
                <p className="text-xl font-bold">
                  {rulesQuery.isLoading ? (
                    <Skeleton className="h-6 w-8 inline-block" />
                  ) : (
                    stats?.total_rules ?? rules.length
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Rules</p>
                <p className="text-xl font-bold">
                  {rulesQuery.isLoading ? (
                    <Skeleton className="h-6 w-8 inline-block" />
                  ) : (
                    stats?.active_rules ?? rules.filter((r) => r.enabled).length
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sent Today</p>
                <p className="text-xl font-bold">
                  {rulesQuery.isLoading ? (
                    <Skeleton className="h-6 w-8 inline-block" />
                  ) : (
                    stats?.sent_today ?? 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failed Today</p>
                <p className="text-xl font-bold">
                  {rulesQuery.isLoading ? (
                    <Skeleton className="h-6 w-8 inline-block" />
                  ) : (
                    stats?.failed_today ?? 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot Configuration Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base">Bot Configuration</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {botStatus?.connected ? (
                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Connected
                  {botStatus.bot_username && (
                    <span className="text-muted-foreground">(@{botStatus.bot_username})</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Disconnected
                </div>
              )}
            </div>
          </div>
          <CardDescription>
            Enter your Telegram Bot Token from @BotFather to enable notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="pl-9 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => configMutation.mutate(botToken)}
                disabled={configMutation.isPending || !botToken.trim()}
              >
                {configMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 mr-1.5" />
                )}
                Configure Bot
              </Button>
              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4 mr-1.5" />
                )}
                Test Connection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Rules Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Alert Rules</CardTitle>
            <Badge variant="secondary">{rules.length} rule{rules.length !== 1 ? 's' : ''}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No alert rules configured</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Create your first alert rule to start receiving Telegram notifications for
                important events.
              </p>
              <Button className="mt-4" size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Name</TableHead>
                    <TableHead className="min-w-[120px]">Event Type</TableHead>
                    <TableHead className="min-w-[130px]">Condition</TableHead>
                    <TableHead className="min-w-[120px]">Chat ID</TableHead>
                    <TableHead className="min-w-[80px]">Cooldown</TableHead>
                    <TableHead className="min-w-[70px]">Enabled</TableHead>
                    <TableHead className="min-w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const evtConfig = EVENT_TYPE_CONFIG[rule.event_type] ?? EVENT_TYPE_CONFIG.custom;
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={evtConfig.color}
                          >
                            <span className="mr-1">{evtConfig.emoji}</span>
                            {evtConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {formatCondition(rule.condition)}
                          </code>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {truncate(rule.telegram_chat_id, 18)}
                          {rule.thread_id && (
                            <span className="text-muted-foreground ml-1">
                              /{truncate(rule.thread_id, 8)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rule.cooldown_minutes}m
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.enabled}
                            disabled
                            className="pointer-events-none"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Send test alert"
                              onClick={() => sendTestMutation.mutate(rule.id)}
                              disabled={sendTestMutation.isPending}
                            >
                              {sendTestMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit rule"
                              onClick={() => openEditDialog(rule)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete rule"
                              onClick={() => {
                                setDeletingRule(rule);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Notification History (Collapsible) */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <CardTitle className="text-base">Notification History</CardTitle>
                  {notifications.length > 0 && (
                    <Badge variant="secondary">{notifications.length}</Badge>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    historyOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Separator className="mb-4" />
              {notificationsQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notifications recorded yet.
                </p>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                      >
                        <div className="mt-0.5">{statusIcon(notif.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {notif.rule_name && (
                              <span className="font-medium text-xs truncate">
                                {notif.rule_name}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                notif.status === 'sent'
                                  ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                                  : notif.status === 'failed'
                                  ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                                  : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {notif.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground break-all">
                            {truncate(notif.message, 160)}
                          </p>
                          {notif.error && (
                            <p className="text-xs text-red-500 mt-1">{notif.error}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatTimestamp(notif.sent_at ?? notif.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Create / Edit Rule Dialog ──────────────────────────────── */}
      <Dialog open={ruleDialogOpen} onOpenChange={(open) => !open && closeRuleDialog()}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Update the alert rule configuration below.'
                : 'Define a new Telegram alert rule with conditions and delivery settings.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 py-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="rule-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rule-name"
                  placeholder="e.g. High-value deposit alert"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
              </div>

              {/* Event Type */}
              <div className="space-y-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select
                  value={form.event_type}
                  onValueChange={(v) => updateForm('event_type', v as EventType)}
                >
                  <SelectTrigger id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((et) => {
                      const cfg = EVENT_TYPE_CONFIG[et];
                      return (
                        <SelectItem key={et} value={et}>
                          <span className="mr-1.5">{cfg.emoji}</span>
                          {cfg.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition Builder */}
              <div className="space-y-2">
                <Label>Condition</Label>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Field</Label>
                    <Select
                      value={form.condition_field}
                      onValueChange={(v) => updateForm('condition_field', v as ConditionField)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Op</Label>
                    <Select
                      value={form.condition_operator}
                      onValueChange={(v) => updateForm('condition_operator', v as ConditionOperator)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.condition_value}
                      onChange={(e) => updateForm('condition_value', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Telegram Chat ID */}
              <div className="space-y-2">
                <Label htmlFor="chat-id">
                  Telegram Chat ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="chat-id"
                  placeholder="e.g. -1001234567890"
                  value={form.telegram_chat_id}
                  onChange={(e) => updateForm('telegram_chat_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The numeric ID of the chat, group, or channel.
                </p>
              </div>

              {/* Thread ID */}
              <div className="space-y-2">
                <Label htmlFor="thread-id">Thread ID</Label>
                <Input
                  id="thread-id"
                  placeholder="Optional — for supergroup topics"
                  value={form.thread_id}
                  onChange={(e) => updateForm('thread_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required only for posting to specific topics in supergroups.
                </p>
              </div>

              {/* Message Template */}
              <div className="space-y-2">
                <Label htmlFor="msg-template">Message Template</Label>
                <Textarea
                  id="msg-template"
                  placeholder="Use {player}, {amount}, {streak}, {event}, {timestamp}"
                  value={form.message_template}
                  onChange={(e) => updateForm('message_template', e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{'{player}'}</code>{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{'{amount}'}</code>{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{'{streak}'}</code>{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{'{event}'}</code>{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{'{timestamp}'}</code>
                </p>
              </div>

              {/* Cooldown Minutes */}
              <div className="space-y-2">
                <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  placeholder="5"
                  value={form.cooldown_minutes}
                  onChange={(e) => updateForm('cooldown_minutes', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum interval between repeated notifications for this rule.
                </p>
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled-switch">Enabled</Label>
                <Switch
                  id="enabled-switch"
                  checked={form.enabled}
                  onCheckedChange={(checked) => updateForm('enabled', checked)}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={closeRuleDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deletingRule?.name}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRuleMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRuleMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deleteRuleMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
