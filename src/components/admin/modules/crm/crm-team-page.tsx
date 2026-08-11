'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  UserX,
  Clock,
  Coffee,
  AlertCircle,
  MoreVertical,
  Activity,
  Shield,
  Eye,
  Crown,
  MessageSquare,
  UserPlus,
  Edit3,
  Trash,
  FolderOpen,
  ArrowUpDown,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ── Types ──────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  department: 'general' | 'support' | 'sales' | 'tech' | 'marketing';
  avatar: string | null;
  phone: string | null;
  status: 'active' | 'away' | 'offline' | 'busy';
  bio: string | null;
  joinDate: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

interface CrmActivityItem {
  id: string;
  memberId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

interface MemberFormData {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  department: 'general' | 'support' | 'sales' | 'tech' | 'marketing';
  phone: string;
  bio: string;
  status: 'active' | 'away' | 'offline' | 'busy';
}

// ── Constants ──────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode; description: string }
> = {
  admin: {
    label: 'Admin',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800/50',
    icon: <Crown className="size-3" />,
    description: 'Full system access, user management, billing, and all settings',
  },
  manager: {
    label: 'Manager',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: <Shield className="size-3" />,
    description: 'Team management, task assignment, reports, and pipeline oversight',
  },
  agent: {
    label: 'Agent',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    icon: <UserCheck className="size-3" />,
    description: 'Manage assigned contacts, tasks, emails, and daily interactions',
  },
  viewer: {
    label: 'Viewer',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700/50',
    icon: <Eye className="size-3" />,
    description: 'Read-only access to dashboards, reports, and shared data',
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; ring: string; icon: React.ReactNode; bg?: string }
> = {
  active: {
    label: 'Active',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500/30',
    icon: <UserCheck className="size-4" />,
  },
  away: {
    label: 'Away',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    icon: <Coffee className="size-4" />,
  },
  busy: {
    label: 'Busy',
    dot: 'bg-red-500',
    ring: 'ring-red-500/30',
    icon: <AlertCircle className="size-4" />,
  },
  offline: {
    label: 'Offline',
    dot: 'bg-gray-400',
    ring: 'ring-gray-400/30',
    icon: <UserX className="size-4" />,
  },
};

const DEPARTMENTS = [
  { value: 'all', label: 'All Teams' },
  { value: 'general', label: 'General' },
  { value: 'support', label: 'Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'tech', label: 'Tech' },
  { value: 'marketing', label: 'Marketing' },
] as const;

const ROLES = ['admin', 'manager', 'agent', 'viewer'] as const;
const DEPARTMENTS_OPTIONS = ['general', 'support', 'sales', 'tech', 'marketing'] as const;
const STATUSES = ['active', 'away', 'offline', 'busy'] as const;

const EMPTY_FORM: MemberFormData = {
  name: '',
  email: '',
  role: 'agent',
  department: 'general',
  phone: '',
  bio: '',
  status: 'active',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  commented: 'Commented on',
  assigned: 'Assigned',
  mentioned: 'Mentioned in',
};

const ENTITY_LABELS: Record<string, string> = {
  task: 'Task',
  email: 'Email',
  chat: 'Chat',
  member: 'Member',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <UserPlus className="size-3.5 text-emerald-500" />,
  updated: <Edit3 className="size-3.5 text-amber-500" />,
  deleted: <Trash className="size-3.5 text-red-500" />,
  commented: <MessageSquare className="size-3.5 text-teal-500" />,
  assigned: <UserCheck className="size-3.5 text-teal-500" />,
  mentioned: <Activity className="size-3.5 text-amber-500" />,
};

// ── Helpers ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Component ──────────────────────────────────────────────────────────

export function CrmTeamPage() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'role' | 'status' | 'department'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Queries ─────────────────────────────────────────────────────────

  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersError,
  } = useQuery<TeamMember[]>({
    queryKey: ['crm-members'],
    queryFn: () => fetch('/api/crm/members').then((r) => r.json()),
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<CrmActivityItem[]>({
    queryKey: ['crm-activity', selectedMember?.id],
    queryFn: () => fetch('/api/crm/activity?limit=20').then((r) => r.json()),
    enabled: activityPanelOpen,
  });

  // ── Mutations ───────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: MemberFormData) =>
      fetch('/api/crm/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to create'); });
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Team member added successfully');
      closeMemberDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: MemberFormData & { id: string }) =>
      fetch('/api/crm/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update'); });
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Team member updated successfully');
      closeMemberDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/crm/members?id=${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to delete'); });
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Team member removed');
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Computed Data ───────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, away: 0, busy: 0, offline: 0 };
    members.forEach((m) => {
      if (counts[m.status] !== undefined) counts[m.status]++;
    });
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    let result = [...members];

    if (departmentFilter !== 'all') {
      result = result.filter((m) => m.department === departmentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [members, departmentFilter, searchQuery, sortField, sortDir]);

  const memberActivities = useMemo(() => {
    if (!selectedMember) return [];
    return activities.filter((a) => a.memberId === selectedMember.id);
  }, [activities, selectedMember]);

  // ── Handlers ────────────────────────────────────────────────────────

  function openCreateDialog() {
    setIsEditing(false);
    setFormData(EMPTY_FORM);
    setSelectedMember(null);
    setMemberDialogOpen(true);
  }

  function openEditDialog(member: TeamMember) {
    setIsEditing(true);
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
      phone: member.phone || '',
      bio: member.bio || '',
      status: member.status,
    });
    setMemberDialogOpen(true);
  }

  function openDeleteDialog(member: TeamMember) {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  }

  function closeMemberDialog() {
    setMemberDialogOpen(false);
    setFormData(EMPTY_FORM);
    setSelectedMember(null);
    setIsEditing(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (isEditing && selectedMember) {
      updateMutation.mutate({ id: selectedMember.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function handleDelete() {
    if (selectedMember) {
      deleteMutation.mutate(selectedMember.id);
    }
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function updateForm(field: keyof MemberFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground mt-1">
          Manage your CRM team, roles, and permissions
        </p>
        <div className="mt-2 h-0.5 w-24 rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500/20" />
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['active', 'away', 'busy', 'offline'] as const).map((status) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <Card
              key={status}
              className="border-border/50 bg-card p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
              onClick={() => setDepartmentFilter(departmentFilter === status ? 'all' : 'all')}
            >
              <div className="flex items-center gap-3">
                <div className={`flex size-9 items-center justify-center rounded-lg ${cfg.bg ?? 'bg-secondary'}`}>
                  {cfg.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none">{statusCounts[status]}</p>
                  <p className="text-muted-foreground mt-1 text-xs truncate">{cfg.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Toolbar: Search + Filter + Add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 hover:text-foreground transition-colors"
                onClick={() => setSearchQuery('')}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortField} onValueChange={(v) => toggleSort(v as typeof sortField)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</SelectItem>
              <SelectItem value="role">Role {sortField === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</SelectItem>
              <SelectItem value="status">Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</SelectItem>
              <SelectItem value="department">Dept {sortField === 'department' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            <span className="sm:inline">Add Member</span>
          </Button>
        </div>
      </div>

      {/* Department Tabs */}
      <Tabs value={departmentFilter} onValueChange={setDepartmentFilter}>
        <TabsList className="flex-wrap">
          {DEPARTMENTS.map((dept) => (
            <TabsTrigger key={dept.value} value={dept.value} className="gap-1.5">
              {dept.value === 'all' ? (
                <Users className="size-3.5" />
              ) : (
                <FolderOpen className="size-3.5" />
              )}
              {dept.label}
              {dept.value === 'all' && (
                <span className="text-muted-foreground text-xs">({members.length})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <div
            key={key}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all duration-200 ${cfg.bg ?? 'bg-secondary'} ${cfg.border} ${cfg.color}`}
          >
            {cfg.icon}
            <span className="font-medium">{cfg.label}</span>
            <span className="text-current/60 hidden sm:inline">— {cfg.description}</span>
          </div>
        ))}
      </div>

      {/* Members Grid */}
      {membersLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : membersError ? (
        <Card className="border-border/50 bg-card p-8 text-center">
          <AlertCircle className="text-destructive mx-auto size-10" />
          <p className="mt-3 font-medium">Failed to load team members</p>
          <p className="text-muted-foreground mt-1 text-sm">Please try refreshing the page</p>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card className="border-border/50 bg-card p-12 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
            <Users className="text-muted-foreground size-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {searchQuery || departmentFilter !== 'all'
              ? 'No matching members'
              : 'No team members yet'}
          </h3>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-md mx-auto">
            {searchQuery || departmentFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first team member to the CRM'}
          </p>
          {!searchQuery && departmentFilter === 'all' && (
            <Button onClick={openCreateDialog} className="mt-4 gap-2">
              <Plus className="size-4" />
              Add First Member
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.agent;
            const statusCfg = STATUS_CONFIG[member.status] || STATUS_CONFIG.active;
            return (
              <Card
                key={member.id}
                className="border-border/50 bg-card p-4 transition-all duration-200 hover:shadow-md group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="size-11">
                        <AvatarImage src={member.avatar || undefined} alt={member.name} />
                        <AvatarFallback className="bg-muted text-sm font-semibold">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card ${statusCfg.dot} ${
                          member.status === 'active' ? 'animate-pulse' : ''
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight truncate">{member.name}</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs truncate">{member.email}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => openEditDialog(member)}
                      >
                        <Pencil className="size-3.5" />
                        Edit Member
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => {
                          setSelectedMember(member);
                          setActivityPanelOpen(true);
                        }}
                      >
                        <Activity className="size-3.5" />
                        View Activity
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-red-600 focus:text-red-600"
                        onClick={() => openDeleteDialog(member)}
                      >
                        <Trash2 className="size-3.5" />
                        Remove Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`gap-1 text-[11px] ${roleCfg.bg} ${roleCfg.color} ${roleCfg.border}`}
                  >
                    {roleCfg.icon}
                    {roleCfg.label}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {member.department}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${statusCfg.dot}`} />
                    <span className="capitalize">{statusCfg.label}</span>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="space-y-1.5">
                  {member.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      <span className="truncate">{member.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>Joined {formatRelativeTime(member.joinDate)}</span>
                  </div>
                </div>

                {member.bio && (
                  <p className="text-muted-foreground mt-2 text-xs line-clamp-2">{member.bio}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Member count footer */}
      {!membersLoading && filteredMembers.length > 0 && (
        <p className="text-muted-foreground text-center text-sm">
          Showing {filteredMembers.length} of {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Add / Edit Member Dialog ────────────────────────────────── */}
      <Dialog open={memberDialogOpen} onOpenChange={(open) => { if (!open) closeMemberDialog(); else setMemberDialogOpen(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the member\'s information, role, and permissions.'
                : 'Fill in the details to add a new member to the team.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-name">Name *</Label>
                <Input
                  id="member-name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-email">Email *</Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => updateForm('role', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          {ROLE_CONFIG[role].icon}
                          {ROLE_CONFIG[role].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {ROLE_CONFIG[formData.role]?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => updateForm('department', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS_OPTIONS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        <span className="capitalize">{dept}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => updateForm('status', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                          <span className="capitalize">{STATUS_CONFIG[s].label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-bio">Bio</Label>
              <Textarea
                id="member-bio"
                placeholder="A short bio or description..."
                value={formData.bio}
                onChange={(e) => updateForm('bio', e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeMemberDialog}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {isEditing ? 'Save Changes' : 'Add Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">{selectedMember?.name}</span>?
              This action cannot be undone. All associated data including tasks, emails,
              and activity history will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/30"
            >
              {deleteMutation.isPending && (
                <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Activity Timeline Panel ─────────────────────────────────── */}
      <Dialog open={activityPanelOpen} onOpenChange={setActivityPanelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="size-5 text-teal-500" />
              Activity Timeline
            </DialogTitle>
            <DialogDescription>
              {selectedMember
                ? `Recent activity for ${selectedMember.name}`
                : 'Recent activity across the team'}
            </DialogDescription>
          </DialogHeader>

          {activitiesLoading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : memberActivities.length === 0 && selectedMember ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <Clock className="text-muted-foreground size-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No activity recorded</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Activity will appear here once this member performs actions in the CRM
              </p>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <Clock className="text-muted-foreground size-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No activity yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Activity will be logged as team members use the CRM
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96 pr-3">
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute top-2 left-[15px] bottom-2 w-px bg-border" />

                {(selectedMember ? memberActivities : activities).map((item, idx) => (
                  <div key={item.id} className="relative flex gap-4 pb-4">
                    <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                      {ACTION_ICONS[item.action] || (
                        <Activity className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">
                          {ACTION_LABELS[item.action] || item.action}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {ENTITY_LABELS[item.entityType] || item.entityType}
                        </span>
                      </p>
                      {item.details && (
                        <p className="text-muted-foreground mt-0.5 text-xs truncate">
                          {item.details}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
