'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { PlatformSetting } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
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
import {
  Settings,
  SlidersHorizontal,
  Clock,
  Tag,
  Key,
  Fingerprint,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  LogOut,
  Lock,
  Zap,
  Gamepad2,
  Globe,
  Server,
  KeyRound,
  ArrowRightLeft,
  Link2,
  Save,
  TestTube,
  Info,
  Plug,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  ArrowDownToLine,
} from 'lucide-react';
import { PageDecoration } from '@/components/admin/shared/page-decoration';
import { useAdminStore, type PlatformConnection, type PlatformType, PLATFORM_TYPES } from '@/stores/admin';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const ENTITY = 'PlatformSetting';

const createFields: FieldConfig[] = [
  { key: 'key', label: 'Setting Key', type: 'text', required: true, placeholder: 'e.g. max_withdrawal_daily' },
  { key: 'value', label: 'Value', type: 'textarea', required: true, placeholder: 'JSON string, number, boolean, or text' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What this setting controls...' },
];

const editFields: FieldConfig[] = [
  { key: 'key', label: 'Setting Key', type: 'text', required: true, readOnly: true, placeholder: 'Setting key' },
  { key: 'value', label: 'Value', type: 'textarea', required: true, placeholder: 'Setting value' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Setting description' },
];

function tryParseJson(str: string): unknown | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function JsonValuePreview({ json }: { json: unknown }) {
  const str = JSON.stringify(json);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-default hover:underline max-w-[200px] inline-block truncate">
          {str.length > 40 ? str.slice(0, 40) + '...' : str}
        </code>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(json, null, 2)}</pre>
      </TooltipContent>
    </Tooltip>
  );
}

function SmartValueDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">null</span>;
  }

  // Boolean preview
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={value} disabled />
        <span className="text-xs text-muted-foreground capitalize">{String(value)}</span>
      </div>
    );
  }

  // Number preview
  if (typeof value === 'number') {
    return <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{value}</code>;
  }

  // String
  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed !== null && typeof parsed === 'object') {
      return <JsonValuePreview json={parsed} />;
    }
    return <span className="text-sm max-w-[200px] inline-block truncate">{value.length > 50 ? value.slice(0, 50) + '...' : value}</span>;
  }

  // Object — collapsed JSON
  if (typeof value === 'object') {
    return <JsonValuePreview json={value} />;
  }

  return <span className="text-sm">{String(value)}</span>;
}

function SettingsSummaryCards() {
  const { data, isLoading } = useTolsQuery<PlatformSetting>(ENTITY, { limit: 200 });
  const settings = data?.data || [];

  const totalSettings = settings.length;
  const today = new Date().toISOString().split('T')[0];
  const modifiedToday = settings.filter((s) => s.updated_date?.startsWith(today)).length;
  const categories = new Set(
    settings.map((s) => s.key?.split('_')[0]).filter(Boolean)
  ).size;

  const cards = [
    { label: 'Total Settings', value: totalSettings.toLocaleString(), icon: Settings, color: 'sky' },
    { label: 'Modified Today', value: modifiedToday.toLocaleString(), icon: Clock, color: 'amber' },
    { label: 'Categories', value: categories.toLocaleString(), icon: Tag, color: 'emerald' },
    { label: 'Config Groups', value: categories.toLocaleString(), icon: SlidersHorizontal, color: 'purple' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                )}
              </div>
              <div className={`h-10 w-10 rounded-lg bg-${card.color}-500/10 flex items-center justify-center`}>
                <card.icon className={`h-5 w-5 text-${card.color}-500`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CredentialsManagement() {
  const { apiKey, appKey, setApiKey, setAppKey } = useAdminStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAppKey, setShowAppKey] = useState(false);
  const [copiedField, setCopiedField] = useState<'api' | 'app' | null>(null);
  const [editApiKey, setEditApiKey] = useState('');
  const [editAppKey, setEditAppKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = (value: string, field: 'api' | 'app') => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      toast.success(`${field === 'api' ? 'API' : 'App'} key copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const startEditing = () => {
    setEditApiKey(apiKey);
    setEditAppKey(appKey);
    setIsEditing(true);
  };

  const saveEditing = () => {
    if (editApiKey.trim()) {
      setApiKey(editApiKey.trim());
      localStorage.setItem('tols_api_key', editApiKey.trim());
    }
    if (editAppKey.trim()) {
      setAppKey(editAppKey.trim());
      localStorage.setItem('tols_app_key', editAppKey.trim());
    } else {
      setAppKey('');
      localStorage.removeItem('tols_app_key');
    }
    localStorage.setItem('tols_remember_key', 'true');
    setIsEditing(false);
    toast.success('Credentials updated successfully');
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleDisconnect = () => {
    setApiKey('');
    setAppKey('');
    localStorage.removeItem('tols_api_key');
    localStorage.removeItem('tols_app_key');
    localStorage.removeItem('tols_remember_key');
    toast.success('Disconnected — you will be redirected to login');
  };

  const maskedApi = apiKey ? (apiKey.length > 8 ? apiKey.slice(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.slice(-4) : apiKey) : 'Not configured';
  const maskedApp = appKey ? (appKey.length > 8 ? appKey.slice(0, 4) + '•'.repeat(appKey.length - 8) + appKey.slice(-4) : appKey) : 'Not configured';

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-violet-500/15 flex items-center justify-center shadow-lg">
              <Shield className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">API Credentials</CardTitle>
              <CardDescription className="text-xs">Manage your TOLS API key and App key for authentication</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={apiKey ? 'default' : 'secondary'} className="text-[10px]">
              {apiKey ? (
                <><span className="relative flex h-1.5 w-1.5 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>Connected</>
              ) : (
                'Disconnected'
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="view-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* API Key Row */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Key className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">API Key</p>
                  <p className="font-mono text-sm truncate">{showApiKey ? apiKey || '—' : maskedApi}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowApiKey(!showApiKey)}
                    disabled={!apiKey}
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(apiKey, 'api')}
                    disabled={!apiKey}
                  >
                    {copiedField === 'api' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* App Key Row */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Fingerprint className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">App Key</p>
                  <p className="font-mono text-sm truncate">{showAppKey ? appKey || '—' : maskedApp}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowAppKey(!showAppKey)}
                    disabled={!appKey}
                  >
                    {showAppKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(appKey, 'app')}
                    disabled={!appKey}
                  >
                    {copiedField === 'app' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={startEditing}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Update Credentials
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleDisconnect}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">Update your API credentials below. Changes take effect immediately.</p>

              {/* Edit API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Key className="h-3 w-3 text-emerald-500" />
                  API Key <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="Enter your new API key"
                  className="bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>

              {/* Edit App Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Fingerprint className="h-3 w-3 text-violet-500" />
                  App Key <span className="text-muted-foreground/40">(optional)</span>
                </label>
                <Input
                  type="password"
                  value={editAppKey}
                  onChange={(e) => setEditAppKey(e.target.value)}
                  placeholder="Enter your new App key"
                  className="bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={cancelEditing}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={saveEditing}
                  disabled={!editApiKey.trim()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Save Credentials
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform Connections Manager                                          */
/* ------------------------------------------------------------------ */

const PLATFORM_TYPE_ICONS: Record<PlatformType, React.ComponentType<{ className?: string }>> = {
  tols: Layers,
  slot_aggregator: Gamepad2,
  payment_gateway: ArrowDownToLine,
  custom: Globe,
};

const PLATFORM_TYPE_GRADIENTS: Record<PlatformType, string> = {
  tols: 'from-teal-500/15 to-emerald-500/15',
  slot_aggregator: 'from-amber-500/15 to-orange-500/15',
  payment_gateway: 'from-emerald-500/15 to-lime-500/15',
  custom: 'from-violet-500/15 to-purple-500/15',
};

const PLATFORM_TYPE_ICON_COLORS: Record<PlatformType, string> = {
  tols: 'text-teal-500',
  slot_aggregator: 'text-amber-500',
  payment_gateway: 'text-emerald-500',
  custom: 'text-violet-500',
};

function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '•'.repeat(value.length);
  return value.slice(0, 4) + '•'.repeat(Math.min(value.length - 8, 16)) + value.slice(-4);
}

function maskUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.length <= 8) return '•'.repeat(host.length) + parsed.pathname;
    return host.slice(0, 3) + '•'.repeat(Math.min(host.length - 6, 10)) + host.slice(-3) + parsed.pathname;
  } catch {
    return maskValue(url);
  }
}

function StatusIndicator({ status }: { status: PlatformConnection['status'] }) {
  switch (status) {
    case 'connected':
      return (
        <Badge variant='default' className='text-[10px] gap-1'>
          <span className='relative flex h-1.5 w-1.5'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' />
            <span className='relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500' />
          </span>
          Connected
        </Badge>
      );
    case 'testing':
      return (
        <Badge className='text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'>
          <Loader2 className='h-3 w-3 animate-spin' />
          Testing...
        </Badge>
      );
    case 'error':
      return (
        <Badge variant='destructive' className='text-[10px] gap-1'>
          <XCircle className='h-3 w-3' />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant='secondary' className='text-[10px] gap-1'>
          <span className='relative flex h-1.5 w-1.5'>
            <span className='relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground/40' />
          </span>
          Disconnected
        </Badge>
      );
  }
}

interface ConnectionFormData {
  name: string;
  type: PlatformType;
  baseUrl: string;
  apiKey: string;
  appKey: string;
}

const EMPTY_FORM: ConnectionFormData = {
  name: '',
  type: 'tols',
  baseUrl: '',
  apiKey: '',
  appKey: '',
};

function ConnectionFormDialog({
  open,
  onOpenChange,
  editingConnection,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConnection: PlatformConnection | null;
  onSave: (data: ConnectionFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<ConnectionFormData>(EMPTY_FORM);
  const [testing, setTesting] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (editingConnection) {
        setForm({
          name: editingConnection.name,
          type: editingConnection.type,
          baseUrl: editingConnection.baseUrl,
          apiKey: editingConnection.apiKey,
          appKey: editingConnection.appKey,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editingConnection]);

  const isValid = form.name.trim() && form.baseUrl.trim() && form.apiKey.trim();

  const handleTest = async () => {
    if (!form.baseUrl || !form.apiKey) return;
    setTesting(true);
    try {
      const params = new URLSearchParams({ path: '/', api_key: form.apiKey, _test: 'true' });
      if (form.appKey) params.set('app_key', form.appKey);
      const res = await fetch(`/api/tols?${params.toString()}`);
      const data = await res.json();
      if (data?.success) {
        toast.success('Connection test passed! API server is reachable.');
      } else {
        const reason = data?.body || data?.error || `HTTP ${data?.status || res.status}`;
        toast.error(`Connection failed: ${reason}`);
      }
    } catch (err) {
      toast.error(`Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    await onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {editingConnection ? (
              <><Pencil className='h-4 w-4 text-amber-500' /> Edit Connection</>
            ) : (
              <><Plus className='h-4 w-4 text-emerald-500' /> Add Connection</>
            )}
          </DialogTitle>
          <DialogDescription>
            {editingConnection
              ? 'Update platform connection details.'
              : 'Connect to a new platform by providing its API details.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Platform Name */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium flex items-center gap-1.5'>
              <Zap className='h-3 w-3 text-sky-500' />
              Platform Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder='e.g. My TOLS Instance'
              className='bg-background/50 border-border/50 text-sm'
            />
          </div>

          {/* Platform Type */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium flex items-center gap-1.5'>
              <Layers className='h-3 w-3 text-violet-500' />
              Platform Type
            </Label>
            <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as PlatformType }))}>
              <SelectTrigger className='w-full bg-background/50 border-border/50 text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLATFORM_TYPES) as PlatformType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {PLATFORM_TYPES[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Base URL */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium flex items-center gap-1.5'>
              <Globe className='h-3 w-3 text-sky-500' />
              API Base URL <span className='text-destructive'>*</span>
            </Label>
            <Input
              type='url'
              value={form.baseUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder='https://api.example.com'
              className='bg-background/50 border-border/50 font-mono text-sm'
            />
          </div>

          {/* API Key */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium flex items-center gap-1.5'>
              <Key className='h-3 w-3 text-emerald-500' />
              API Key <span className='text-destructive'>*</span>
            </Label>
            <Input
              type='password'
              value={form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder='Enter your API key'
              className='bg-background/50 border-border/50 font-mono text-sm'
            />
          </div>

          {/* App Key (optional) */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium flex items-center gap-1.5'>
              <Fingerprint className='h-3 w-3 text-violet-500' />
              App Key <span className='text-muted-foreground/40'>(optional)</span>
            </Label>
            <Input
              type='password'
              value={form.appKey}
              onChange={(e) => setForm((prev) => ({ ...prev, appKey: e.target.value }))}
              placeholder='Enter your App key'
              className='bg-background/50 border-border/50 font-mono text-sm'
            />
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5 text-xs'
            onClick={handleTest}
            disabled={!form.baseUrl || !form.apiKey || testing}
          >
            {testing ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <TestTube className='h-3.5 w-3.5' />}
            Test Connection
          </Button>
          <Button
            size='sm'
            className='gap-1.5 text-xs'
            onClick={handleSave}
            disabled={!isValid}
          >
            <Save className='h-3.5 w-3.5' />
            {editingConnection ? 'Save Changes' : 'Save Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConnectionDialog({
  open,
  onOpenChange,
  connection,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: PlatformConnection | null;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{connection?.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this platform connection and its credentials. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className='gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            <Trash2 className='h-3.5 w-3.5' />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PlatformConnectionsManager() {
  const {
    platformConnections,
    activeConnectionId,
    addPlatformConnection,
    updatePlatformConnection,
    removePlatformConnection,
    setActiveConnection,
    setConnectionStatus,
  } = useAdminStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<PlatformConnection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformConnection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingConnection(null);
    setDialogOpen(true);
  };

  const handleQuickAdd = (type: PlatformType) => {
    setEditingConnection(null);
    setDialogOpen(true);
  };

  const handleEdit = (conn: PlatformConnection) => {
    setEditingConnection(conn);
    setDialogOpen(true);
  };

  const handleDeleteClick = (conn: PlatformConnection) => {
    setDeleteTarget(conn);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      removePlatformConnection(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleSave = async (data: ConnectionFormData) => {
    if (editingConnection) {
      updatePlatformConnection(editingConnection.id, {
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        appKey: data.appKey,
      });
      toast.success(`"${data.name}" updated`);
    } else {
      const id = addPlatformConnection({
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        appKey: data.appKey,
        isActive: platformConnections.length === 0,
        status: 'disconnected',
        lastTestedAt: null,
      });
      if (platformConnections.length === 0) {
        setActiveConnection(id);
      }
      toast.success(`"${data.name}" added`);
    }
  };

  const handleTest = async (conn: PlatformConnection) => {
    setTestingId(conn.id);
    setConnectionStatus(conn.id, 'testing');
    try {
      const params = new URLSearchParams({ path: '/', api_key: conn.apiKey, _test: 'true' });
      if (conn.appKey) params.set('app_key', conn.appKey);
      const res = await fetch(`/api/tols?${params.toString()}`);
      const data = await res.json();
      if (data?.success) {
        setConnectionStatus(conn.id, 'connected');
        toast.success(`"${conn.name}" connected successfully`);
      } else {
        setConnectionStatus(conn.id, 'error');
        const reason = data?.body || data?.error || `HTTP ${data?.status || res.status}`;
        toast.error(`"${conn.name}" failed: ${reason}`);
      }
    } catch (err) {
      setConnectionStatus(conn.id, 'error');
      toast.error(`"${conn.name}" error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleSetActive = (conn: PlatformConnection) => {
    setActiveConnection(conn.id);
    toast.success(`"${conn.name}" set as active connection`);
  };

  return (
    <>
      <Card className='bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-sky-500/15 flex items-center justify-center shadow-lg'>
                <Plug className='h-5 w-5 text-violet-500' />
              </div>
              <div>
                <CardTitle className='text-base font-semibold'>Platform Connections</CardTitle>
                <CardDescription className='text-xs'>White-label: connect to any platform using an API key and base URL</CardDescription>
              </div>
            </div>
            <Button
              size='sm'
              className='gap-1.5 text-xs'
              onClick={handleAdd}
            >
              <Plus className='h-3.5 w-3.5' />
              Add Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode='wait'>
            {platformConnections.length === 0 ? (
              <motion.div
                key='empty-state'
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className='py-8'
              >
                <div className='flex flex-col items-center justify-center text-center space-y-3'>
                  <div className='h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center'>
                    <Plug className='h-7 w-7 text-muted-foreground/40' />
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>No platform connections</p>
                    <p className='text-xs text-muted-foreground/60 mt-1'>Add your first platform connection to get started</p>
                  </div>
                  <div className='flex items-center gap-2 mt-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='gap-1.5 text-xs'
                      onClick={() => handleQuickAdd('tols')}
                    >
                      <Layers className='h-3.5 w-3.5 text-teal-500' />
                      TOLS Platform
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='gap-1.5 text-xs'
                      onClick={() => handleQuickAdd('slot_aggregator')}
                    >
                      <Gamepad2 className='h-3.5 w-3.5 text-amber-500' />
                      Slot Aggregator
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key='connections-list'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className='space-y-3'
              >
                {platformConnections.map((conn, index) => {
                  const IconComp = PLATFORM_TYPE_ICONS[conn.type];
                  const gradient = PLATFORM_TYPE_GRADIENTS[conn.type];
                  const iconColor = PLATFORM_TYPE_ICON_COLORS[conn.type];
                  const isActive = conn.id === activeConnectionId;
                  const isTesting = testingId === conn.id;

                  return (
                    <motion.div
                      key={conn.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    >
                      <div
                        className={`
                          relative p-4 rounded-xl border transition-all duration-300
                          ${isActive
                            ? 'bg-primary/[0.03] border-primary/30 shadow-sm shadow-primary/5'
                            : 'bg-background/50 border-border/40 hover:border-border/60'
                          }
                        `}
                      >
                        {/* Active indicator stripe */}
                        {isActive && (
                          <div className='absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-primary to-primary/50' />
                        )}

                        <div className='flex items-start gap-3'>
                          {/* Icon */}
                          <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 mt-0.5`}>
                            <IconComp className={`h-4 w-4 ${iconColor}`} />
                          </div>

                          {/* Info */}
                          <div className='flex-1 min-w-0 space-y-1.5'>
                            <div className='flex items-center gap-2 flex-wrap'>
                              <span className='text-sm font-semibold truncate'>{conn.name}</span>
                              <Badge variant='outline' className='text-[10px] gap-1 shrink-0'>
                                <IconComp className='h-2.5 w-2.5' />
                                {PLATFORM_TYPES[conn.type].label}
                              </Badge>
                              <StatusIndicator status={conn.status} />
                              {isActive && (
                                <Badge className='text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0'>
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                              <span className='flex items-center gap-1.5 truncate max-w-[280px]'>
                                <Globe className='h-3 w-3 shrink-0' />
                                <span className='font-mono'>{maskUrl(conn.baseUrl)}</span>
                              </span>
                              <span className='flex items-center gap-1.5 shrink-0'>
                                <Key className='h-3 w-3' />
                                <span className='font-mono'>{maskValue(conn.apiKey)}</span>
                              </span>
                              {conn.appKey && (
                                <span className='flex items-center gap-1.5 shrink-0'>
                                  <Fingerprint className='h-3 w-3' />
                                  <span className='font-mono'>{maskValue(conn.appKey)}</span>
                                </span>
                              )}
                            </div>
                            {conn.lastTestedAt && (
                              <p className='text-[10px] text-muted-foreground/50'>
                                Last tested: {new Date(conn.lastTestedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className='flex items-center gap-1 shrink-0'>
                            {!isActive && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='h-7 w-7'
                                    onClick={() => handleSetActive(conn)}
                                  >
                                    <CheckCircle2 className='h-3.5 w-3.5 text-muted-foreground hover:text-emerald-500' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className='text-xs'>Set as active</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-7 w-7'
                                  onClick={() => handleTest(conn)}
                                  disabled={isTesting}
                                >
                                  {isTesting ? (
                                    <Loader2 className='h-3.5 w-3.5 animate-spin text-amber-500' />
                                  ) : (
                                    <TestTube className='h-3.5 w-3.5' />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className='text-xs'>Test connection</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-7 w-7'
                                  onClick={() => handleEdit(conn)}
                                >
                                  <Pencil className='h-3.5 w-3.5' />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className='text-xs'>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-7 w-7 hover:text-destructive'
                                  onClick={() => handleDeleteClick(conn)}
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className='text-xs'>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <div className='flex items-center justify-between pt-2'>
                  <p className='text-[11px] text-muted-foreground/60'>
                    {platformConnections.length} connection{platformConnections.length !== 1 ? 's' : ''} configured
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    className='gap-1.5 text-xs'
                    onClick={handleAdd}
                  >
                    <Plus className='h-3.5 w-3.5' />
                    Add Another
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <ConnectionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingConnection={editingConnection}
        onSave={handleSave}
      />

      <DeleteConnectionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        connection={deleteTarget}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'password' | 'url';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

const AGGREGATOR_FIELDS: ConfigField[] = [
  {
    key: 'apiBaseUrl',
    label: 'API Base URL',
    placeholder: 'https://api.staging.betkraft.co.uk',
    required: true,
    type: 'url',
    description: 'Base URL for the slot aggregator API endpoint',
    icon: Globe,
    iconColor: 'text-sky-500',
  },
  {
    key: 'apiKey',
    label: 'API Key',
    placeholder: 'Enter your aggregator API key',
    required: true,
    type: 'password',
    description: 'Authentication key for aggregator API requests',
    icon: Key,
    iconColor: 'text-emerald-500',
  },
  {
    key: 'operatorMerchantId',
    label: 'Operator / Merchant ID',
    placeholder: 'Enter your operator or merchant ID',
    required: false,
    type: 'text',
    description: 'Your unique operator or merchant identifier (App Key)',
    icon: KeyRound,
    iconColor: 'text-violet-500',
  },
  {
    key: 'apiSecret',
    label: 'API Secret',
    placeholder: 'Enter signing secret',
    required: false,
    type: 'password',
    description: 'Secret used to sign real-money outcome callbacks',
    icon: Lock,
    iconColor: 'text-amber-500',
  },
  {
    key: 'callbackUrl',
    label: 'Callback URL (Real-Money Outcomes)',
    placeholder: 'https://your-domain.com/api/callbacks/outcomes',
    required: false,
    type: 'url',
    description: 'URL where the aggregator sends real-money game outcomes',
    icon: Link2,
    iconColor: 'text-rose-500',
  },
];

function SlotAggregatorConfiguration() {
  const { slotAggregatorConfig, setSlotAggregatorConfig } = useAdminStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editConfig, setEditConfig] = useState(slotAggregatorConfig);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});

  const configuredCount = AGGREGATOR_FIELDS.filter((f) => slotAggregatorConfig[f.key as keyof typeof slotAggregatorConfig]?.trim()).length;
  const requiredConfigured = AGGREGATOR_FIELDS.filter((f) => f.required && slotAggregatorConfig[f.key as keyof typeof slotAggregatorConfig]?.trim()).length;
  const totalRequired = AGGREGATOR_FIELDS.filter((f) => f.required).length;
  const isFullyConfigured = requiredConfigured === totalRequired;

  const startEditing = () => {
    setEditConfig({ ...slotAggregatorConfig });
    setIsEditing(true);
  };

  const saveConfig = () => {
    setSlotAggregatorConfig(editConfig);
    setIsEditing(false);
    toast.success('Slot Aggregator configuration saved');
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '•'.repeat(value.length);
    return value.slice(0, 3) + '•'.repeat(Math.min(value.length - 6, 12)) + value.slice(-3);
  };

  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-sky-500/15 flex items-center justify-center shadow-lg">
              <Gamepad2 className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Slot Aggregator</CardTitle>
              <CardDescription className="text-xs">
                Credentials used by the backend to launch real-money and demo slot sessions
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isFullyConfigured ? 'default' : 'secondary'} className="text-[10px]">
              {configuredCount}/{AGGREGATOR_FIELDS.length} fields
            </Badge>
            <Badge variant={isFullyConfigured ? 'default' : 'destructive'} className="text-[10px]">
              {isFullyConfigured ? 'Configured' : 'Not configured'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="view-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {AGGREGATOR_FIELDS.map((field) => {
                const value = slotAggregatorConfig[field.key as keyof typeof slotAggregatorConfig] || '';
                const isConfigured = value.trim().length > 0;
                const IconComponent = field.icon;

                return (
                  <div
                    key={field.key}
                    className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40 group hover:border-border/60 transition-colors"
                  >
                    <div className={`h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0`}>
                      <IconComponent className={`h-4 w-4 ${field.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {field.label}
                          {field.required && <span className="text-destructive">*</span>}
                        </p>
                        {isConfigured ? (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        ) : (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground/30" />
                          </span>
                        )}
                      </div>
                      {isConfigured ? (
                        <p className="font-mono text-xs truncate mt-0.5">
                          {revealedFields[field.key] ? value : maskValue(value)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic mt-0.5">Not configured</p>
                      )}
                    </div>
                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => toggleReveal(field.key)}
                      >
                        {revealedFields[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Info bar */}
              <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/10">
                <Info className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Required: <strong>API Base URL</strong> + <strong>API Key</strong>. The launch backend reads these server-side.
                  The <strong>Operator/Merchant ID</strong> maps to your TOLS App Key. The <strong>API Secret</strong> is used to sign real-money callbacks.
                </p>
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                  <div className="flex items-center gap-1.5">
                    <TestTube className="h-3 w-3 text-amber-500/60" />
                    <span>Required: {requiredConfigured}/{totalRequired}</span>
                  </div>
                  <span className="text-muted-foreground/20">·</span>
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3 w-3 text-sky-500/60" />
                    <span>Server-side launch</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={startEditing}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Configure
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Configure the slot aggregator credentials. Required fields are marked with <span className="text-destructive">*</span>.
              </p>

              {AGGREGATOR_FIELDS.map((field) => {
                const IconComponent = field.icon;
                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <IconComponent className={`h-3 w-3 ${field.iconColor}`} />
                      <label className="text-xs font-medium text-muted-foreground">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>
                    </div>
                    <Input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={editConfig[field.key as keyof typeof editConfig] || ''}
                      onChange={(e) => setEditConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="bg-background/50 border-border/50 font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground/50">{field.description}</p>
                  </div>
                );
              })}

              <Separator className="my-3" />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={cancelEditing}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={saveConfig}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Configuration
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformSetting | null>(null);

  const columns: Column<PlatformSetting>[] = [
    {
      key: 'key',
      label: 'Key',
      render: (item) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold">
          {item.key}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (item) => <SmartValueDisplay value={item.value} />,
    },
    {
      key: 'description',
      label: 'Description',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground cursor-default hover:underline line-clamp-1 max-w-[200px]">
              {item.description?.length > 40 ? item.description.slice(0, 40) + '...' : item.description || '—'}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-sm">{item.description || 'No description'}</p>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.created_date)}</span>,
    },
    {
      key: 'updated_date',
      label: 'Updated',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.updated_date)}</span>,
    },
  ];

  return (
    <div className="relative">
      <PageDecoration variant="sky" />
      <div className="relative z-10 space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <Settings className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
            <p className="text-sm text-muted-foreground">Configure global platform settings, feature flags, and system parameters</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />
      </div>

      {/* Platform Connections (White-Label) */}
      <PlatformConnectionsManager />

      {/* Credentials Management */}
      <CredentialsManagement />

      {/* Slot Aggregator Configuration */}
      <SlotAggregatorConfiguration />

      <SettingsSummaryCards />

      <DataTable<PlatformSetting>
        entity={ENTITY}
        columns={columns}
        filterKey="key"
        title="Settings"
        createLabel="New Setting"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
      />

      <EntityDialog
        entity={ENTITY}
        title="Setting"
        description="Create a new platform setting."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Setting"
        description="Update setting value. The key is read-only."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected
          ? { key: selected.key, value: typeof selected.value === 'object' ? JSON.stringify(selected.value) : String(selected.value ?? ''), description: selected.description }
          : undefined}
      />

      <DetailDialog
        title="Setting"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Setting"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      </div>
    </div>
  );
}
