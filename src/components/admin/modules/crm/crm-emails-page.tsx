'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';

import {
  Mail,
  Star,
  Trash2,
  Archive,
  Send,
  Reply,
  Forward,
  Paperclip,
  Search,
  Filter,
  MoreHorizontal,
  Inbox,
  FileText,
  PenSquare,
  X,
  ChevronLeft,
  Check,
  Tag,
  CircleDot,
  SquarePen,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailAddress {
  name: string;
  address: string;
}

interface EmailAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface Email {
  id: string;
  fromAddress: EmailAddress;
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bccAddresses: EmailAddress[];
  subject: string;
  body: string;
  plainBody: string;
  folder: string;
  starred: boolean;
  important: boolean;
  read: boolean;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  taskId: string | null;
  memberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface FolderCounts {
  inbox: number;
  sent: number;
  drafts: number;
  trash: number;
  archive: number;
  starred: number;
  important: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'important', label: 'Important', icon: Tag },
] as const;

type FolderId = (typeof FOLDERS)[number]['id'];

type MobileView = 'list' | 'detail' | 'compose';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-cyan-500',
    'bg-violet-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function buildFolderQueryKey(folder: FolderId, search: string, filterStarred: boolean, filterImportant: boolean) {
  return ['crm-emails', folder, search, filterStarred, filterImportant];
}

// ─── API Hooks ──────────────────────────────────────────────────────────────

function useEmails(folder: FolderId, search: string, filterStarred: boolean, filterImportant: boolean) {
  const params = new URLSearchParams();
  if (folder !== 'starred' && folder !== 'important') {
    params.set('folder', folder);
  }
  if (search) params.set('q', search);
  if (filterStarred) params.set('starred', 'true');
  if (filterImportant) params.set('important', 'true');

  const queryStr = params.toString();
  const url = `/api/crm/emails${queryStr ? `?${queryStr}` : ''}`;

  return useQuery<Email[]>({
    queryKey: buildFolderQueryKey(folder, search, filterStarred, filterImportant),
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch emails' }));
        throw new Error(err.error || 'Failed to fetch emails');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : data.emails ?? data.data ?? [];
    },
    staleTime: 10000,
  });
}

function useMembers() {
  return useQuery<Member[]>({
    queryKey: ['crm-members'],
    queryFn: async () => {
      const res = await fetch('/api/crm/members');
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      return Array.isArray(data) ? data : data.members ?? data.data ?? [];
    },
    staleTime: 60000,
  });
}

function useCreateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/crm/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send email' }));
        throw new Error(err.error || 'Failed to send email');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-emails'] });
      toast.success('Email sent successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/crm/emails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update email' }));
        throw new Error(err.error || 'Failed to update email');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-emails'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/emails?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete email' }));
        throw new Error(err.error || 'Failed to delete email');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-emails'] });
      toast.success('Email deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ folder }: { folder: FolderId }) {
  const folderConfig = FOLDERS.find((f) => f.id === folder);
  const Icon = folderConfig?.icon ?? Inbox;
  const messages: Record<FolderId, { title: string; description: string }> = {
    inbox: { title: 'Your inbox is empty', description: 'No new emails to read. Check back later!' },
    sent: { title: 'No sent emails', description: 'Emails you send will appear here.' },
    drafts: { title: 'No drafts', description: 'Start composing a draft and it will be saved here.' },
    trash: { title: 'Trash is empty', description: 'Deleted emails will appear here for 30 days.' },
    archive: { title: 'No archived emails', description: 'Archived emails will appear here.' },
    starred: { title: 'No starred emails', description: 'Star important emails to find them here.' },
    important: { title: 'No important emails', description: 'Mark emails as important to find them here.' },
  };
  const msg = messages[folder];

  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{msg.title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{msg.description}</p>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function EmailListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 border-b">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmailDetailSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// ─── Recipient Autocomplete ─────────────────────────────────────────────────

interface RecipientInputProps {
  members: Member[];
  value: EmailAddress[];
  onChange: (recipients: EmailAddress[]) => void;
  placeholder?: string;
  label?: string;
}

function RecipientInput({ members, value, onChange, placeholder = 'Add recipients...', label }: RecipientInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMembers = useMemo(() => {
    if (!inputValue) return members.slice(0, 10);
    const q = inputValue.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, inputValue]);

  const existingEmails = useMemo(() => new Set(value.map((r) => r.address.toLowerCase())), [value]);

  function addRecipient(member: Member) {
    if (existingEmails.has(member.email.toLowerCase())) return;
    onChange([...value, { name: member.name, address: member.email }]);
    setInputValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.includes('@')) {
      e.preventDefault();
      addRecipient({ id: '', name: inputValue.split('@')[0], email: inputValue });
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeRecipient(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs font-medium text-muted-foreground">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className="flex flex-wrap items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-md border border-input bg-background text-sm cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
            onClick={() => inputRef.current?.focus()}
          >
            {value.map((r, i) => (
              <Badge
                key={`${r.address}-${i}`}
                variant="secondary"
                className="gap-1 px-2 py-0.5 text-xs font-normal"
              >
                <span className="truncate max-w-[140px]">{r.name || r.address}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecipient(i);
                  }}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              placeholder={value.length === 0 ? placeholder : ''}
              className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search team members..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                {filteredMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={member.id}
                    onSelect={() => addRecipient(member)}
                    disabled={existingEmails.has(member.email.toLowerCase())}
                    className="gap-2"
                  >
                    <Avatar className="size-6">
                      <AvatarFallback
                        className={cn('text-[10px] text-white', getAvatarColor(member.name))}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{member.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                    </div>
                    {existingEmails.has(member.email.toLowerCase()) && (
                      <Check className="size-4 text-muted-foreground" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Compose Dialog ─────────────────────────────────────────────────────────

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  defaultValues?: {
    to?: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    subject?: string;
    body?: string;
    isReply?: boolean;
    isForward?: boolean;
    taskId?: string | null;
  };
}

function ComposeDialog({ open, onOpenChange, members, defaultValues }: ComposeDialogProps) {
  const [to, setTo] = useState<EmailAddress[]>(defaultValues?.to ?? []);
  const [cc, setCc] = useState<EmailAddress[]>(defaultValues?.cc ?? []);
  const [bcc, setBcc] = useState<EmailAddress[]>(defaultValues?.bcc ?? []);
  const [subject, setSubject] = useState(defaultValues?.subject ?? '');
  const [body, setBody] = useState(defaultValues?.body ?? '');
  const [taskId, setTaskId] = useState(defaultValues?.taskId ?? '');
  const [showCc, setShowCc] = useState((defaultValues?.cc?.length ?? 0) > 0);
  const [showBcc, setShowBcc] = useState((defaultValues?.bcc?.length ?? 0) > 0);

  const createEmail = useCreateEmail();

  const isSending = createEmail.isPending;

  function resetForm() {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject('');
    setBody('');
    setTaskId('');
    setShowCc(false);
    setShowBcc(false);
  }

  function handleClose(open: boolean) {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  }

  async function handleSend() {
    if (to.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    createEmail.mutate(
      {
        toAddresses: to,
        ccAddresses: cc,
        bccAddresses: bcc,
        subject: subject.trim(),
        body: body,
        plainBody: body,
        folder: 'sent',
        taskId: taskId || null,
      },
      {
        onSuccess: () => {
          handleClose(false);
        },
      }
    );
  }

  async function handleSaveDraft() {
    if (!subject.trim() && !body.trim()) {
      toast.error('Cannot save an empty draft');
      return;
    }

    createEmail.mutate(
      {
        toAddresses: to,
        ccAddresses: cc,
        bccAddresses: bcc,
        subject: subject.trim(),
        body: body,
        plainBody: body,
        folder: 'drafts',
        taskId: taskId || null,
      },
      {
        onSuccess: () => {
          toast.success('Draft saved');
          handleClose(false);
        },
      }
    );
  }

  const title = defaultValues?.isReply
    ? 'Reply to Email'
    : defaultValues?.isForward
      ? 'Forward Email'
      : 'Compose Email';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {defaultValues?.isReply ? 'Write your reply below.' : defaultValues?.isForward ? 'Forward this email to someone.' : 'Write a new email.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <RecipientInput
            members={members}
            value={to}
            onChange={setTo}
            placeholder="To..."
            label="To"
          />

          <div className="flex items-center gap-2">
            {!showCc && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setShowCc(true)}
              >
                Cc
              </Button>
            )}
            {!showBcc && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setShowBcc(true)}
              >
                Bcc
              </Button>
            )}
          </div>

          {showCc && (
            <RecipientInput
              members={members}
              value={cc}
              onChange={setCc}
              placeholder="Cc..."
              label="Cc"
            />
          )}

          {showBcc && (
            <RecipientInput
              members={members}
              value={bcc}
              onChange={setBcc}
              placeholder="Bcc..."
              label="Bcc"
            />
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="min-h-[200px] resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Link to Task (optional)</Label>
            <Input
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="Enter task ID..."
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSending}
            className="mr-auto"
          >
            <FileText className="size-4 mr-1.5" />
            Save Draft
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSend} disabled={isSending}>
            <Send className="size-4 mr-1.5" />
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Folder Sidebar ─────────────────────────────────────────────────────────

interface FolderSidebarProps {
  activeFolder: FolderId;
  onFolderChange: (folder: FolderId) => void;
  emailCounts: FolderCounts;
  onCompose: () => void;
}

function FolderSidebar({ activeFolder, onFolderChange, emailCounts, onCompose }: FolderSidebarProps) {
  const inboxCount = emailCounts.inbox;

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          onClick={onCompose}
        >
          <PenSquare className="size-4" />
          Compose
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5" role="navigation" aria-label="Email folders">
          {FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            const count =
              folder.id === 'inbox'
                ? inboxCount
                : folder.id === 'starred'
                  ? emailCounts.starred
                  : folder.id === 'important'
                    ? emailCounts.important
                    : 0;

            return (
              <button
                key={folder.id}
                onClick={() => onFolderChange(folder.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{folder.label}</span>
                {count > 0 && (
                  <Badge
                    variant={folder.id === 'inbox' ? 'default' : 'secondary'}
                    className="h-5 min-w-5 px-1.5 text-[10px] font-medium"
                  >
                    {count > 99 ? '99+' : count}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// ─── Email List Item ────────────────────────────────────────────────────────

interface EmailListItemProps {
  email: Email;
  isSelected: boolean;
  isCheckboxChecked: boolean;
  onEmailClick: (email: Email) => void;
  onStarToggle: (e: React.MouseEvent, emailId: string, starred: boolean) => void;
  onCheckboxChange: (emailId: string, checked: boolean) => void;
}

function EmailListItem({
  email,
  isSelected,
  isCheckboxChecked,
  onEmailClick,
  onStarToggle,
  onCheckboxChange,
}: EmailListItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-start gap-2 px-3 py-3 border-b cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent',
        !email.read && 'bg-primary/[0.03]'
      )}
      style={{ borderLeft: isSelected ? '3px solid hsl(var(--primary))' : '3px solid transparent' }}
      onClick={() => onEmailClick(email)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEmailClick(email);
        }
      }}
    >
      <div
        className="flex items-center gap-1 pt-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isCheckboxChecked}
          onCheckedChange={(checked) => onCheckboxChange(email.id, !!checked)}
          aria-label={`Select email: ${email.subject}`}
          className="size-4"
        />
      </div>

      <Avatar className="size-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            'text-[10px] text-white font-medium',
            getAvatarColor(email.fromAddress.name || email.fromAddress.address)
          )}
        >
          {getInitials(email.fromAddress.name || email.fromAddress.address)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {!email.read && (
            <CircleDot className="size-2.5 shrink-0 fill-primary text-primary" />
          )}
          <span
            className={cn(
              'text-sm truncate',
              !email.read ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {email.fromAddress.name || email.fromAddress.address}
          </span>
          {email.important && <Tag className="size-3 shrink-0 text-amber-500" />}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatDate(email.createdAt)}
          </span>
        </div>
        <div
          className={cn(
            'text-sm truncate mb-0.5',
            !email.read ? 'font-semibold text-foreground' : 'text-foreground/80'
          )}
        >
          {email.subject || '(No Subject)'}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {truncate(email.plainBody || email.body?.replace(/<[^>]*>/g, '').slice(0, 100) || '', 80)}
          </span>
          {email.hasAttachments && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
        </div>
      </div>

      <button
        className="shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent mt-0.5"
        onClick={(e) => onStarToggle(e, email.id, email.starred)}
        aria-label={email.starred ? 'Unstar email' : 'Star email'}
      >
        <Star
          className={cn(
            'size-4',
            email.starred
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground'
          )}
        />
      </button>
    </div>
  );
}

// ─── Email Detail ───────────────────────────────────────────────────────────

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onStarToggle: (emailId: string, starred: boolean) => void;
  onImportantToggle: (emailId: string, important: boolean) => void;
  onMoveToFolder: (emailId: string, folder: string) => void;
  onDelete: (emailId: string) => void;
  onReply: (email: Email) => void;
  onForward: (email: Email) => void;
  isMobile: boolean;
}

function EmailDetail({
  email,
  onBack,
  onStarToggle,
  onImportantToggle,
  onMoveToFolder,
  onDelete,
  onReply,
  onForward,
  isMobile,
}: EmailDetailProps) {
  const folderItems = FOLDERS.filter(
    (f) => f.id !== 'starred' && f.id !== 'important' && f.id !== email.folder
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        {isMobile && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReply(email)}
          className="gap-1.5 text-xs"
        >
          <Reply className="size-3.5" />
          Reply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onForward(email)}
          className="gap-1.5 text-xs"
        >
          <Forward className="size-3.5" />
          Forward
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onStarToggle(email.id, !email.starred)}>
              <Star className={cn('size-4 mr-2', email.starred && 'fill-amber-400 text-amber-400')} />
              {email.starred ? 'Unstar' : 'Star'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onImportantToggle(email.id, !email.important)}>
              <Tag className={cn('size-4 mr-2', email.important && 'text-amber-500')} />
              {email.important ? 'Remove Important' : 'Mark Important'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Archive className="size-4 mr-2" />
                Move to...
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {folderItems.map((f) => {
                  const FIcon = f.icon;
                  return (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => onMoveToFolder(email.id, f.id)}
                    >
                      <FIcon className="size-4 mr-2" />
                      {f.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(email.id)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Subject */}
          <h2 className="text-xl font-semibold text-foreground mb-4 leading-tight">
            {email.subject || '(No Subject)'}
            {email.important && (
              <Tag className="inline-block size-5 ml-2 text-amber-500" aria-label="Important" />
            )}
          </h2>

          {/* From / To / CC row */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="size-10 shrink-0 mt-0.5">
              <AvatarFallback
                className={cn(
                  'text-xs text-white font-medium',
                  getAvatarColor(email.fromAddress.name || email.fromAddress.address)
                )}
              >
                {getInitials(email.fromAddress.name || email.fromAddress.address)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {email.fromAddress.name || email.fromAddress.address}
                </span>
                <span className="text-xs text-muted-foreground">
                  &lt;{email.fromAddress.address}&gt;
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <span>To: {email.toAddresses.map((a) => a.name || a.address).join(', ') || '—'}</span>
              </div>
              {email.ccAddresses.length > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span>Cc: {email.ccAddresses.map((a) => a.name || a.address).join(', ')}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatFullDate(email.createdAt)}
              </div>
            </div>
            <button
              onClick={() => onStarToggle(email.id, !email.starred)}
              className="p-1.5 rounded-full hover:bg-accent shrink-0"
              aria-label={email.starred ? 'Unstar email' : 'Star email'}
            >
              <Star
                className={cn(
                  'size-5',
                  email.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
                )}
              />
            </button>
          </div>

          {/* Task link */}
          {email.taskId && (
            <div className="mb-4">
              <Badge variant="outline" className="gap-1.5 text-xs">
                <SquarePen className="size-3" />
                Linked to Task: {email.taskId}
              </Badge>
            </div>
          )}

          {/* Body */}
          <Separator className="mb-6" />
          <div
            className="prose prose-sm max-w-none text-foreground/90 leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic"
            dangerouslySetInnerHTML={{ __html: email.body || email.plainBody?.replace(/\n/g, '<br/>') || '' }}
          />

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Paperclip className="size-4" />
                Attachments ({email.attachments.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-sm max-w-[240px]"
                  >
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{att.fileName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatFileSize(att.fileSize)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CrmEmailsPage() {
  // Folder state
  const [activeFolder, setActiveFolder] = useState<FolderId>('inbox');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterImportant, setFilterImportant] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Selection state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<ComposeDialogProps['defaultValues']>();

  // Mobile view
  const [mobileView, setMobileView] = useState<MobileView>('list');

  // Query hooks
  const { data: emails = [], isLoading: emailsLoading } = useEmails(
    activeFolder,
    searchQuery,
    filterStarred,
    filterImportant
  );
  const { data: members = [] } = useMembers();

  // Mutation hooks
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  // Computed folder counts
  const emailCounts = useMemo(() => {
    // For sidebar counts, we use what we have from the current data.
    // In production, you'd fetch counts from the API or compute on the server.
    const counts: FolderCounts = {
      inbox: 0,
      sent: 0,
      drafts: 0,
      trash: 0,
      archive: 0,
      starred: 0,
      important: 0,
    };
    // If the current folder is inbox, count unread from loaded emails
    if (activeFolder === 'inbox') {
      counts.inbox = emails.filter((e) => !e.read).length;
    }
    counts.starred = emails.filter((e) => e.starred).length;
    counts.important = emails.filter((e) => e.important).length;
    return counts;
  }, [emails, activeFolder]);

  // Handlers
  const handleFolderChange = useCallback((folder: FolderId) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    setCheckedIds(new Set());
    setSearchQuery('');
    setSearchInput('');
    setFilterStarred(false);
    setFilterImportant(false);
    setMobileView('list');
  }, []);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
    setSelectedEmail(null);
    setCheckedIds(new Set());
  }, [searchInput]);

  const handleEmailClick = useCallback(
    (email: Email) => {
      setSelectedEmail(email);
      setMobileView('detail');

      // Mark as read
      if (!email.read) {
        updateEmail.mutate({ id: email.id, read: true });
      }
    },
    [updateEmail]
  );

  const handleStarToggle = useCallback(
    (emailId: string, starred: boolean) => {
      updateEmail.mutate({ id: emailId, starred });
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, starred });
      }
    },
    [updateEmail, selectedEmail]
  );

  const handleStarToggleFromList = useCallback(
    (e: React.MouseEvent, emailId: string, starred: boolean) => {
      e.stopPropagation();
      handleStarToggle(emailId, starred);
    },
    [handleStarToggle]
  );

  const handleImportantToggle = useCallback(
    (emailId: string, important: boolean) => {
      updateEmail.mutate({ id: emailId, important });
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, important });
      }
    },
    [updateEmail, selectedEmail]
  );

  const handleMoveToFolder = useCallback(
    (emailId: string, folder: string) => {
      updateEmail.mutate({ id: emailId, folder });
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
        setMobileView('list');
      }
      toast.success(`Email moved to ${folder}`);
    },
    [updateEmail, selectedEmail]
  );

  const handleDelete = useCallback(
    (emailId: string) => {
      deleteEmail.mutate(emailId);
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
        setMobileView('list');
      }
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    },
    [deleteEmail, selectedEmail]
  );

  const handleCheckboxChange = useCallback((emailId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(emailId);
      } else {
        next.delete(emailId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (checkedIds.size === emails.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(emails.map((e) => e.id)));
    }
  }, [emails, checkedIds.size]);

  const handleBulkStar = useCallback(() => {
    checkedIds.forEach((id) => {
      updateEmail.mutate({ id, starred: true });
    });
    setCheckedIds(new Set());
    toast.success(`${checkedIds.size} email(s) starred`);
  }, [checkedIds, updateEmail]);

  const handleBulkArchive = useCallback(() => {
    checkedIds.forEach((id) => {
      updateEmail.mutate({ id, folder: 'archive' });
    });
    setCheckedIds(new Set());
    setSelectedEmail(null);
    setMobileView('list');
    toast.success(`${checkedIds.size} email(s) archived`);
  }, [checkedIds, updateEmail]);

  const handleBulkDelete = useCallback(() => {
    checkedIds.forEach((id) => {
      deleteEmail.mutate(id);
    });
    setCheckedIds(new Set());
    setSelectedEmail(null);
    setMobileView('list');
    toast.success(`${checkedIds.size} email(s) deleted`);
  }, [checkedIds, deleteEmail]);

  const handleCompose = useCallback(() => {
    setComposeDefaults(undefined);
    setComposeOpen(true);
  }, []);

  const handleReply = useCallback(
    (email: Email) => {
      setComposeDefaults({
        to: [email.fromAddress],
        subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
        body: `\n\n---\nOn ${formatFullDate(email.createdAt)}, ${email.fromAddress.name || email.fromAddress.address} wrote:\n\n${email.plainBody || email.body?.replace(/<[^>]*>/g, '') || ''}`,
        isReply: true,
        taskId: email.taskId,
      });
      setComposeOpen(true);
    },
    []
  );

  const handleForward = useCallback(
    (email: Email) => {
      setComposeDefaults({
        subject: email.subject.startsWith('Fwd: ') ? email.subject : `Fwd: ${email.subject}`,
        body: `\n\n---------- Forwarded message ---------\nFrom: ${email.fromAddress.name} <${email.fromAddress.address}>\nDate: ${formatFullDate(email.createdAt)}\nSubject: ${email.subject}\nTo: ${email.toAddresses.map((a) => `${a.name} <${a.address}>`).join(', ')}\n\n${email.plainBody || email.body?.replace(/<[^>]*>/g, '') || ''}`,
        isForward: true,
        taskId: email.taskId,
      });
      setComposeOpen(true);
    },
    []
  );

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  const allChecked = emails.length > 0 && checkedIds.size === emails.length;
  const someChecked = checkedIds.size > 0 && checkedIds.size < emails.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b shrink-0">
        {mobileView === 'detail' ? (
          <Button variant="ghost" size="icon" className="size-8" onClick={handleBackToList}>
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <h1 className="text-lg font-semibold flex-1">
          {FOLDERS.find((f) => f.id === activeFolder)?.label ?? 'Emails'}
        </h1>
        <Button size="sm" onClick={handleCompose} className="gap-1.5">
          <PenSquare className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">Compose</span>
        </Button>
      </div>

      {/* Three-pane layout (desktop) / single-pane (mobile) */}
      <div className="flex flex-1 min-h-0">
        {/* Folder sidebar — desktop only */}
        <div className="hidden lg:block">
          <FolderSidebar
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            emailCounts={emailCounts}
            onCompose={handleCompose}
          />
        </div>

        {/* Email list — visible on desktop always, mobile only in list view */}
        <div
          className={cn(
            'w-full lg:w-80 border-r flex flex-col shrink-0 bg-background',
            mobileView === 'detail' && 'hidden lg:flex'
          )}
        >
          {/* Search & filter bar */}
          <div className="p-3 space-y-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  className="h-9 pl-8 pr-3"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />
              </div>
              <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={handleSearch}>
                <Filter className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile folder selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden gap-1.5 text-xs">
                    <Inbox className="size-3.5" />
                    {FOLDERS.find((f) => f.id === activeFolder)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {FOLDERS.map((f) => {
                    const FIcon = f.icon;
                    return (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => handleFolderChange(f.id)}
                        className={cn(activeFolder === f.id && 'bg-accent')}
                      >
                        <FIcon className="size-4 mr-2" />
                        {f.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={filterStarred ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => setFilterStarred(!filterStarred)}
              >
                <Star className={cn('size-3', filterStarred && 'fill-current')} />
                Starred
              </Button>
              <Button
                variant={filterImportant ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => setFilterImportant(!filterImportant)}
              >
                <Tag className="size-3" />
                Important
              </Button>
            </div>
          </div>

          {/* Bulk actions bar */}
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b shrink-0">
              <span className="text-xs font-medium text-muted-foreground">
                {checkedIds.size} selected
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={handleBulkStar}
              >
                <Star className="size-3" />
                Star
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={handleBulkArchive}
              >
                <Archive className="size-3" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            </div>
          )}

          {/* Select all row */}
          {emails.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
              <Checkbox
                checked={allChecked}
                ref={(el) => {
                  if (el) {
                    (el as unknown as HTMLInputElement).indeterminate = someChecked;
                  }
                }}
                onCheckedChange={handleSelectAll}
                aria-label="Select all emails"
              />
              <span className="text-xs text-muted-foreground">
                {emails.length} email{emails.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Email list */}
          <ScrollArea className="flex-1">
            {emailsLoading ? (
              <EmailListSkeleton />
            ) : emails.length === 0 ? (
              <EmptyState folder={activeFolder} />
            ) : (
              emails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmail?.id === email.id}
                  isCheckboxChecked={checkedIds.has(email.id)}
                  onEmailClick={handleEmailClick}
                  onStarToggle={handleStarToggleFromList}
                  onCheckboxChange={handleCheckboxChange}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Email detail — visible on desktop always, mobile only in detail view */}
        <div
          className={cn(
            'flex-1 min-w-0 flex flex-col bg-background',
            mobileView === 'list' && 'hidden lg:flex'
          )}
        >
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onBack={handleBackToList}
              onStarToggle={handleStarToggle}
              onImportantToggle={handleImportantToggle}
              onMoveToFolder={handleMoveToFolder}
              onDelete={handleDelete}
              onReply={handleReply}
              onForward={handleForward}
              isMobile={true}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="rounded-full bg-muted p-4 mb-4 mx-auto w-fit">
                  <Mail className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">Select an email</h3>
                <p className="text-sm text-muted-foreground">
                  Choose an email from the list to read it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        members={members}
        defaultValues={composeDefaults}
      />
    </div>
  );
}
