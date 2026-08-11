'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, isPast, isToday, parseISO } from 'date-fns';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  hasSortableData,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Ban,
  ListTodo,
  X,
  AtSign,
  Tag,
  LayoutGrid,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  department: string;
  status: string;
}

interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  reporterId?: string | null;
  dueDate?: string | null;
  tags?: string | null;
  mentions?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: Date | undefined;
  tags: string[];
  mentions: string[];
  order?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLUMNS: { id: TaskStatus; label: string; icon: React.ElementType; bgClass: string; headerClass: string }[] = [
  { id: 'todo', label: 'To Do', icon: ListTodo, bgClass: 'bg-slate-50/70 dark:bg-slate-950/40', headerClass: 'bg-slate-200/80 dark:bg-slate-800/60' },
  { id: 'in_progress', label: 'In Progress', icon: CircleDot, bgClass: 'bg-sky-50/70 dark:bg-sky-950/30', headerClass: 'bg-sky-200/80 dark:bg-sky-800/60' },
  { id: 'review', label: 'Review', icon: Clock, bgClass: 'bg-amber-50/70 dark:bg-amber-950/30', headerClass: 'bg-amber-200/80 dark:bg-amber-800/60' },
  { id: 'done', label: 'Done', icon: CheckCircle2, bgClass: 'bg-emerald-50/70 dark:bg-emerald-950/30', headerClass: 'bg-emerald-200/80 dark:bg-emerald-800/60' },
  { id: 'blocked', label: 'Blocked', icon: Ban, bgClass: 'bg-red-50/70 dark:bg-red-950/30', headerClass: 'bg-red-200/80 dark:bg-red-800/60' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; border: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-emerald-700 dark:text-emerald-400', border: 'border-l-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40', dot: 'bg-emerald-500' },
  medium: { label: 'Medium', color: 'text-amber-700 dark:text-amber-400', border: 'border-l-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40', dot: 'bg-amber-500' },
  high: { label: 'High', color: 'text-orange-700 dark:text-orange-400', border: 'border-l-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/40', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-400', border: 'border-l-red-500', bg: 'bg-red-100 dark:bg-red-900/40', dot: 'bg-red-500' },
};

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: '',
  dueDate: undefined,
  tags: [],
  mentions: [],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseJsonField<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getMemberById(members: TeamMember[], id: string | null | undefined): TeamMember | undefined {
  return members.find((m) => m.id === id);
}

function getDueDateInfo(dueDate: string | null | undefined): { text: string; className: string } | null {
  if (!dueDate) return null;
  try {
    const date = parseISO(dueDate);
    const text = format(date, 'MMM d');
    if (isPast(date) && !isToday(date)) {
      return { text, className: 'text-red-600 dark:text-red-400' };
    }
    if (isToday(date)) {
      return { text: 'Today', className: 'text-amber-600 dark:text-amber-400' };
    }
    return { text, className: 'text-muted-foreground' };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Sortable Task Card                                                 */
/* ------------------------------------------------------------------ */

interface SortableTaskCardProps {
  task: CrmTask;
  members: TeamMember[];
  onEdit: (task: CrmTask) => void;
  onDelete: (task: CrmTask) => void;
}

function SortableTaskCard({ task, members, onEdit, onDelete }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority] || PRIORITY_CONFIG.medium;
  const assignee = getMemberById(members, task.assigneeId);
  const tags = parseJsonField<string>(task.tags);
  const mentions = parseJsonField<string>(task.mentions);
  const dueDateInfo = getDueDateInfo(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'opacity-50 z-50'
          : ''
      }
    >
      <Card className="bg-card border border-border/50 rounded-lg p-3 hover:shadow-md transition-shadow border-l-4 cursor-default group">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
            aria-label="Drag task"
          >
            <GripVertical className="size-4" />
          </button>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="text-sm font-medium leading-snug mb-1.5 line-clamp-2">
              {task.title}
            </h4>

            {/* Priority Badge */}
            <div className="flex items-center gap-1.5 mb-2">
              <Badge
                variant="outline"
                className={`${priorityConfig.border} ${priorityConfig.bg} ${priorityConfig.color} text-[10px] px-1.5 py-0 h-5 border-l-4 font-medium`}
              >
                <span className={`inline-block size-1.5 rounded-full ${priorityConfig.dot} mr-1`} />
                {priorityConfig.label}
              </Badge>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium"
                  >
                    <Tag className="size-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Mentions */}
            {mentions.length > 0 && (
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                {mentions.map((mentionId) => {
                  const mentionedMember = getMemberById(members, mentionId);
                  if (!mentionedMember) return null;
                  return (
                    <span
                      key={mentionId}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                    >
                      <Avatar className="size-3.5 rounded-full">
                        <AvatarImage src={mentionedMember.avatar || undefined} alt={mentionedMember.name} />
                        <AvatarFallback className="text-[6px]">{getInitials(mentionedMember.name)}</AvatarFallback>
                      </Avatar>
                      @{mentionedMember.name.split(' ')[0]}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Footer: Assignee + Due Date + Actions */}
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="flex items-center gap-2 min-w-0">
                {assignee && (
                  <div className="flex items-center gap-1 min-w-0">
                    <Avatar className="size-5 rounded-full shrink-0">
                      <AvatarImage src={assignee.avatar || undefined} alt={assignee.name} />
                      <AvatarFallback className="text-[8px]">{getInitials(assignee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                      {assignee.name.split(' ')[0]}
                    </span>
                  </div>
                )}
                {dueDateInfo && (
                  <div className={`flex items-center gap-0.5 text-[11px] ${dueDateInfo.className} shrink-0`}>
                    <CalendarDays className="size-3" />
                    <span>{dueDateInfo.text}</span>
                  </div>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Pencil className="size-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(task)}
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Droppable Kanban Column                                             */
/* ------------------------------------------------------------------ */

interface KanbanColumnProps {
  column: typeof COLUMNS[number];
  tasks: CrmTask[];
  members: TeamMember[];
  onEdit: (task: CrmTask) => void;
  onDelete: (task: CrmTask) => void;
}

function KanbanColumn({ column, tasks, members, onEdit, onDelete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const taskIds = tasks.map((t) => t.id);
  const Icon = column.icon;

  return (
    <div
      className={`flex flex-col rounded-xl min-w-[280px] w-[280px] shrink-0 ${column.bgClass} border border-border/40 transition-colors ${isOver ? 'ring-2 ring-primary/30 bg-accent/30' : ''}`}
    >
      {/* Column Header */}
      <div className={`rounded-t-xl px-3 py-2.5 flex items-center justify-between ${column.headerClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-foreground/70" />
          <h3 className="text-sm font-semibold">{column.label}</h3>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold tabular-nums">
          {tasks.length}
        </Badge>
      </div>

      {/* Task List */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-340px)] overflow-y-auto kanban-scrollbar"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              members={members}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <ListTodo className="size-8 mb-2" />
            <p className="text-xs">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Form Dialog                                                   */
/* ------------------------------------------------------------------ */

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  editingTask: CrmTask | null;
  defaultStatus?: TaskStatus;
  onSubmit: (data: TaskFormData) => Promise<void>;
}

function TaskFormDialog({ open, onOpenChange, members, editingTask, defaultStatus, onSubmit }: TaskFormDialogProps) {
  const [form, setForm] = useState<TaskFormData>({ ...EMPTY_FORM });
  const [tagInput, setTagInput] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingTask;

  // Reset form when dialog opens or editing task changes
  useEffect(() => {
    if (open) {
      if (editingTask) {
        setForm({
          title: editingTask.title,
          description: editingTask.description || '',
          status: editingTask.status as TaskStatus,
          priority: editingTask.priority as TaskPriority,
          assigneeId: editingTask.assigneeId || '',
          dueDate: editingTask.dueDate ? parseISO(editingTask.dueDate) : undefined,
          tags: parseJsonField<string>(editingTask.tags),
          mentions: parseJsonField<string>(editingTask.mentions),
        });
      } else {
        setForm({ ...EMPTY_FORM, status: defaultStatus || 'todo' });
      }
      setTagInput('');
      setMentionSearch('');
      setShowMentionPicker(false);
    }
  }, [open, editingTask, defaultStatus]);

  // Close mention picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentionPickerRef.current && !mentionPickerRef.current.contains(e.target as Node)) {
        setShowMentionPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return members;
    const q = mentionSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, mentionSearch]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Check if @ was just typed
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w]*)$/);

    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
    }

    setForm((prev) => ({ ...prev, description: value }));
  }, []);

  const handleSelectMention = useCallback((member: TeamMember) => {
    if (!descriptionRef.current) return;

    const textarea = descriptionRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = form.description.slice(0, cursorPos);
    const textAfterCursor = form.description.slice(cursorPos);

    // Replace @search with @name
    const newTextBefore = textBeforeCursor.replace(/@[\w]*$/, `@${member.name.split(' ')[0]} `);
    const newDescription = newTextBefore + textAfterCursor;

    setForm((prev) => ({
      ...prev,
      description: newDescription,
      mentions: prev.mentions.includes(member.id)
        ? prev.mentions
        : [...prev.mentions, member.id],
    }));

    setShowMentionPicker(false);
    setMentionSearch('');

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = newTextBefore.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [form.description]);

  const removeMention = useCallback((memberId: string) => {
    setForm((prev) => ({
      ...prev,
      mentions: prev.mentions.filter((id) => id !== memberId),
    }));
  }, []);

  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setForm((prev) => ({ ...prev, dueDate: date }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch {
      toast.error('Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, onSubmit, onOpenChange]);

  const mentionedMembers = form.mentions
    .map((id) => getMemberById(members, id))
    .filter(Boolean) as TeamMember[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto kanban-scrollbar">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the task details below.'
              : 'Fill in the details to create a new task.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="Enter task title..."
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              autoFocus
            />
          </div>

          {/* Description with @mention support */}
          <div className="grid gap-2 relative">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              ref={descriptionRef}
              id="task-description"
              placeholder="Describe the task... Type @ to mention team members"
              value={form.description}
              onChange={handleDescriptionChange}
              rows={3}
              className="resize-none"
            />

            {/* Mention Picker */}
            {showMentionPicker && (
              <div
                ref={mentionPickerRef}
                className="absolute z-50 bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md kanban-scrollbar"
              >
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AtSign className="size-3" />
                  Mention someone
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                    No members found
                  </p>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      onClick={() => handleSelectMention(member)}
                    >
                      <Avatar className="size-5 rounded-full">
                        <AvatarImage src={member.avatar || undefined} alt={member.name} />
                        <AvatarFallback className="text-[8px]">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{member.role}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Mentioned Members Chips */}
            {mentionedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {mentionedMembers.map((member) => (
                  <Badge
                    key={member.id}
                    variant="secondary"
                    className="gap-1 text-xs pr-1"
                  >
                    <Avatar className="size-3.5 rounded-full">
                      <AvatarImage src={member.avatar || undefined} alt={member.name} />
                      <AvatarFallback className="text-[6px]">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    @{member.name.split(' ')[0]}
                    <button
                      type="button"
                      onClick={() => removeMention(member.id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                      aria-label={`Remove ${member.name} from mentions`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm((prev) => ({ ...prev, status: val as TaskStatus }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((col) => {
                    const ColIcon = col.icon;
                    return (
                      <SelectItem key={col.id} value={col.id}>
                        <div className="flex items-center gap-2">
                          <ColIcon className="size-3.5" />
                          {col.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => setForm((prev) => ({ ...prev, priority: val as TaskPriority }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG.low][]).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${config.dot}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee & Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select
                value={form.assigneeId}
                onValueChange={(val) => setForm((prev) => ({ ...prev, assigneeId: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-4 rounded-full">
                          <AvatarImage src={member.avatar || undefined} alt={member.name} />
                          <AvatarFallback className="text-[6px]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        {member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9"
                  >
                    <CalendarDays className="size-3.5 mr-2" />
                    {form.dueDate ? format(form.dueDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dueDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                  {form.dueDate && (
                    <div className="border-t px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleDateSelect(undefined)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag} className="shrink-0 h-9">
                <Plus className="size-3.5" />
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.title.trim()}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Task' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export function CrmTasksPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [deleteTask, setDeleteTask] = useState<CrmTask | null>(null);

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<CrmTask[]>({
    queryKey: ['crm-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
  });

  // Fetch members
  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['crm-members'],
    queryFn: async () => {
      const res = await fetch('/api/crm/members');
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? data.dueDate.toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      toast.success('Task created successfully');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: TaskFormData & { id: string }) => {
      const { id, ...rest } = data;
      const res = await fetch('/api/crm/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...rest,
          dueDate: rest.dueDate ? rest.dueDate.toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      toast.success('Task updated successfully');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/tasks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      toast.success('Task deleted successfully');
      setDeleteTask(null);
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (filterAssignee !== 'all' && task.assigneeId !== filterAssignee) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, filterPriority, filterAssignee, searchQuery]);

  // Tasks organized by column
  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, CrmTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    };
    for (const task of filteredTasks) {
      const status = task.status as TaskStatus;
      if (map[status]) {
        map[status].push(task);
      }
    }
    // Sort each column by order
    for (const key of Object.keys(map) as TaskStatus[]) {
      map[key].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [filteredTasks]);

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, review: 0, done: 0, blocked: 0 };
    for (const task of tasks) {
      const s = task.status as TaskStatus;
      if (byStatus[s] !== undefined) byStatus[s]++;
    }
    return { total, byStatus };
  }, [tasks]);

  // Drag end handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id;
      let targetContainerId: TaskStatus | null = null;
      let overId = over.id;

      // Determine the target container
      if (COLUMNS.some((col) => col.id === overId)) {
        // Dropped directly on a column
        targetContainerId = overId as TaskStatus;
      } else if (hasSortableData(over)) {
        // Dropped on another task
        targetContainerId = over.data.current?.sortable?.containerId as TaskStatus;
      }

      if (!targetContainerId) return;

      // Find the source container
      let sourceContainerId: TaskStatus | null = null;
      if (hasSortableData(active)) {
        sourceContainerId = active.data.current?.sortable?.containerId as TaskStatus;
      }

      // If dropped on the same container, handle reordering
      if (sourceContainerId && sourceContainerId === targetContainerId) {
        const columnTasks = tasksByColumn[sourceContainerId];
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex);
          // Update orders via batch PUT
          reordered.forEach((task, index) => {
            if (task.order !== index) {
              updateMutation.mutate({
                id: task.id,
                title: task.title,
                description: task.description || '',
                status: task.status as TaskStatus,
                priority: task.priority as TaskPriority,
                assigneeId: task.assigneeId || '',
                dueDate: task.dueDate ? parseISO(task.dueDate) : undefined,
                tags: parseJsonField<string>(task.tags),
                mentions: parseJsonField<string>(task.mentions),
              });
            }
          });
        }
        return;
      }

      // Moving to a different column
      const task = tasks.find((t) => t.id === activeId);
      if (!task) return;

      // Determine the new order
      let newOrder: number;
      if (COLUMNS.some((col) => col.id === overId)) {
        // Dropped on empty column or column header: place at end
        newOrder = tasksByColumn[targetContainerId].length;
      } else {
        // Dropped on a task: insert at that task's position
        const overTask = tasksByColumn[targetContainerId].find((t) => t.id === overId);
        newOrder = overTask ? overTask.order : tasksByColumn[targetContainerId].length;
      }

      updateMutation.mutate({
        id: task.id,
        title: task.title,
        description: task.description || '',
        status: targetContainerId,
        priority: task.priority as TaskPriority,
        assigneeId: task.assigneeId || '',
        dueDate: task.dueDate ? parseISO(task.dueDate) : undefined,
        tags: parseJsonField<string>(task.tags),
        mentions: parseJsonField<string>(task.mentions),
        order: newOrder,
      });
    },
    [tasks, tasksByColumn, updateMutation]
  );

  // Handlers
  const handleCreateTask = useCallback(
    (data: TaskFormData) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const handleUpdateTask = useCallback(
    async (data: TaskFormData) => {
      if (!editingTask) return;
      await updateMutation.mutateAsync({ ...data, id: editingTask.id });
    },
    [editingTask, updateMutation]
  );

  const handleEdit = useCallback((task: CrmTask) => {
    setEditingTask(task);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((task: CrmTask) => {
    setDeleteTask(task);
  }, []);

  const handleOpenCreate = useCallback((status?: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status || 'todo');
    setFormOpen(true);
  }, []);

  const isLoading = tasksLoading || membersLoading;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="size-6 text-primary" />
            Task Board
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and track your team tasks across the pipeline
          </p>
        </div>
        <Button onClick={() => handleOpenCreate()} className="shrink-0">
          <Plus className="size-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground font-medium">Total</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{stats.total}</div>
        </Card>
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          return (
            <Card key={col.id} className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Icon className="size-3" />
                {col.label}
              </div>
              <div className="text-xl font-bold tabular-nums mt-0.5">{stats.byStatus[col.id]}</div>
            </Card>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Filter className="size-3.5 mr-1.5" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG.low][]).map(
                ([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-full ${config.dot}`} />
                      {config.label}
                    </div>
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="size-3.5 rounded-full">
                      <AvatarImage src={member.avatar || undefined} alt={member.name} />
                      <AvatarFallback className="text-[6px]">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[80px]">{member.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterPriority !== 'all' || filterAssignee !== 'all' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setSearchQuery('');
                setFilterPriority('all');
                setFilterAssignee('all');
              }}
            >
              <X className="size-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            <p className="text-sm">Loading tasks...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full min-h-0 p-1">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByColumn[column.id]}
                  members={members}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}

      {/* Task Form Dialog */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        members={members}
        editingTask={editingTask}
        defaultStatus={defaultStatus}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTask} onOpenChange={(open) => { if (!open) setDeleteTask(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTask?.title}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTask && deleteMutation.mutate(deleteTask.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
