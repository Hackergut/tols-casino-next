'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Hash,
  AtSign,
  Plus,
  Send,
  Paperclip,
  Pin,
  PinOff,
  Users,
  ArrowLeft,
  Search,
  MessageSquare,
  Circle,
  X,
  Loader2,
  Trash2,
  MoreVertical,
  Phone,
  Video,
  Smile,
  Check,
  ChevronDown,
  MessageCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

// ---------- Types ----------

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string | null;
  phone: string | null;
  status: string;
  bio: string | null;
  joinDate: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string | null;
  senderName: string | null;
  content: string;
  mentions: string | null;
  readBy: string | null;
  pinned: boolean;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatChannel {
  id: string;
  name: string;
  type: string;
  members: string;
  avatar: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage?: ChatMessage | null;
  unreadCount?: number;
}

// ---------- Constants ----------

const CURRENT_USER_ID = 'admin-current';
const CURRENT_USER_NAME = 'Admin';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500',
  away: 'bg-amber-500',
  busy: 'bg-rose-500',
  offline: 'bg-zinc-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-teal-600',
  'bg-pink-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    if (diffHours < 168) {
      return format(date, 'EEE h:mm a');
    }
    return format(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

function formatMessageTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'h:mm a');
  } catch {
    return '';
  }
}

// ---------- Mention Autocomplete ----------

interface MentionAutocompleteProps {
  members: TeamMember[];
  visible: boolean;
  query: string;
  onSelect: (member: TeamMember) => void;
  position: { top: number; left: number } | null;
}

function MentionAutocomplete({
  members,
  visible,
  query,
  onSelect,
  position,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return members.slice(0, 8);
    const q = query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [members, query]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when query changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (!visible || !listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, visible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
      }
    },
    [visible, filtered, selectedIndex, onSelect]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-lg border bg-popover shadow-lg overflow-hidden"
      style={position ? { position: 'fixed', top: position.top - 4, left: position.left } : undefined}
    >
      <div className="p-1.5 text-xs font-medium text-muted-foreground border-b">
        {query ? `Matching "${query}"` : 'Team Members'}
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.map((member, index) => (
          <button
            key={member.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            )}
            onClick={() => onSelect(member)}
          >
            <div className="relative">
              <Avatar className="size-7">
                {member.avatar && <AvatarImage src={member.avatar} alt={member.name} />}
                <AvatarFallback className={cn('text-[10px] text-white', getAvatarColor(member.name))}>
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-popover',
                  STATUS_COLORS[member.status] || STATUS_COLORS.offline
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">@{member.name.replace(/\s+/g, '').toLowerCase()}</div>
              <div className="text-xs text-muted-foreground truncate">{member.role}</div>
            </div>
            <span
              className={cn(
                'size-2 rounded-full shrink-0',
                STATUS_COLORS[member.status] || STATUS_COLORS.offline
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Create Channel Dialog ----------

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  onSuccess: () => void;
}

function CreateChannelDialog({
  open,
  onOpenChange,
  members,
  onSuccess,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<string>('channel');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isDirectMode, setIsDirectMode] = useState(false);
  const [directTarget, setDirectTarget] = useState<string>('');

  const queryClient = useQueryClient();

  const createChannel = useMutation({
    mutationFn: async (data: {
      type: 'channel';
      name: string;
      channelType: string;
      members: string[];
      description: string;
      createdBy: string;
    }) => {
      const res = await fetch('/api/crm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create channel' }));
        throw new Error(err.error || 'Failed to create channel');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-channels'] });
      toast.success(channelType === 'direct' ? 'Direct message created' : 'Channel created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetForm = () => {
    setName('');
    setChannelType('channel');
    setDescription('');
    setSelectedMembers([]);
    setSearch('');
    setIsDirectMode(false);
    setDirectTarget('');
  };

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelType === 'direct') {
      if (!directTarget) {
        toast.error('Please select a team member');
        return;
      }
      const target = members.find((m) => m.id === directTarget);
      createChannel.mutate({
        type: 'channel',
        name: target ? `DM with ${target.name}` : 'Direct Message',
        channelType: 'direct',
        members: [CURRENT_USER_ID, directTarget],
        description: '',
        createdBy: CURRENT_USER_ID,
      });
    } else {
      if (!name.trim()) {
        toast.error('Channel name is required');
        return;
      }
      createChannel.mutate({
        type: 'channel',
        name: name.trim(),
        channelType: 'channel',
        members: [CURRENT_USER_ID, ...selectedMembers],
        description: description.trim(),
        createdBy: CURRENT_USER_ID,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New {channelType === 'direct' ? 'Direct Message' : 'Channel'}</DialogTitle>
          <DialogDescription>
            {channelType === 'direct'
              ? 'Start a private conversation with a team member'
              : 'Create a channel for your team to communicate'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setChannelType('channel'); setIsDirectMode(false); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors',
                channelType === 'channel'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
              )}
            >
              <Hash className="size-4" />
              Channel
            </button>
            <button
              type="button"
              onClick={() => { setChannelType('direct'); setIsDirectMode(true); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors',
                channelType === 'direct'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
              )}
            >
              <AtSign className="size-4" />
              Direct Message
            </button>
          </div>

          {isDirectMode ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Team Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-48 rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
                  ) : (
                    filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-left transition-colors',
                          directTarget === member.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent'
                        )}
                        onClick={() => setDirectTarget(member.id)}
                      >
                        <div className="relative">
                          <Avatar className="size-8">
                            {member.avatar && (
                              <AvatarImage src={member.avatar} alt={member.name} />
                            )}
                            <AvatarFallback
                              className={cn(
                                'text-xs text-white',
                                getAvatarColor(member.name)
                              )}
                            >
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
                              STATUS_COLORS[member.status] || STATUS_COLORS.offline
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.role}</div>
                        </div>
                        {directTarget === member.id && (
                          <Check className="size-4 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="channel-name"
                    placeholder="e.g. sales-team"
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-desc">Description (optional)</Label>
                <Textarea
                  id="channel-desc"
                  placeholder="What is this channel about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Invite Members</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-40 rounded-md border">
                  <div className="p-2 space-y-1">
                    {filteredMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No members found
                      </p>
                    ) : (
                      filteredMembers.map((member) => (
                        <label
                          key={member.id}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors',
                            selectedMembers.includes(member.id)
                              ? 'bg-primary/5'
                              : 'hover:bg-accent'
                          )}
                        >
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={() => toggleMember(member.id)}
                          />
                          <div className="relative">
                            <Avatar className="size-7">
                              {member.avatar && (
                                <AvatarImage src={member.avatar} alt={member.name} />
                              )}
                              <AvatarFallback
                                className={cn(
                                  'text-[10px] text-white',
                                  getAvatarColor(member.name)
                                )}
                              >
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-background',
                                STATUS_COLORS[member.status] || STATUS_COLORS.offline
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{member.name}</div>
                            <div className="text-xs text-muted-foreground">{member.role}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {selectedMembers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-xs text-muted-foreground">Selected:</span>
                    {selectedMembers.map((id) => {
                      const m = members.find((mem) => mem.id === id);
                      if (!m) return null;
                      return (
                        <Badge key={id} variant="secondary" className="text-xs gap-1">
                          {m.name}
                          <button
                            type="button"
                            className="ml-0.5 hover:text-destructive"
                            onClick={() => toggleMember(id)}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createChannel.isPending}>
              {createChannel.isPending && <Loader2 className="size-4 animate-spin" />}
              {channelType === 'direct' ? 'Start Conversation' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Message Bubble ----------

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  membersMap: Map<string, TeamMember>;
  onPin: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}

function MessageBubble({ message, isOwn, membersMap, onPin, onDelete }: MessageBubbleProps) {
  const sender = message.senderId ? membersMap.get(message.senderId) : null;
  const senderName = message.senderName || sender?.name || 'Unknown';

  const parsedContent = useMemo(() => {
    if (!message.content) return '';
    try {
      const mentions: string[] = message.mentions ? JSON.parse(message.mentions) : [];
      let content = message.content;
      mentions.forEach((mentionId, idx) => {
        const member = membersMap.get(mentionId);
        const mentionName = member?.name || `@user-${mentionId.slice(0, 4)}`;
        content = content.replace(
          `@mention-${idx}`,
          `<span class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">@${mentionName.replace(/\s+/g, '').toLowerCase()}</span>`
        );
      });
      return content;
    } catch {
      return message.content;
    }
  }, [message.content, message.mentions, membersMap]);

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-2 transition-colors hover:bg-accent/30',
        isOwn && 'flex-row-reverse'
      )}
    >
      <Avatar className="size-8 mt-0.5 shrink-0">
        {sender?.avatar && <AvatarImage src={sender.avatar} alt={senderName} />}
        <AvatarFallback
          className={cn('text-xs text-white', getAvatarColor(senderName))}
        >
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col min-w-0 max-w-[70%]', isOwn && 'items-end')}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-semibold">{senderName}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatMessageTime(message.createdAt)}
          </span>
          {message.edited && (
            <span className="text-[10px] text-muted-foreground italic">(edited)</span>
          )}
        </div>

        <div
          className={cn(
            'relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border rounded-bl-md shadow-sm'
          )}
        >
          <div
            className="message-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parsedContent) }}
          />
        </div>

        {message.pinned && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
            <Pin className="size-3" />
            <span>Pinned</span>
          </div>
        )}

        <div className={cn('flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity', isOwn && 'flex-row-reverse')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6">
                <MoreVertical className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
              <DropdownMenuItem onClick={() => onPin(message)}>
                {message.pinned ? (
                  <>
                    <PinOff className="size-4 mr-2" /> Unpin Message
                  </>
                ) : (
                  <>
                    <Pin className="size-4 mr-2" /> Pin Message
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(message)}
              >
                <Trash2 className="size-4 mr-2" /> Delete Message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ---------- Pinned Messages Section ----------

interface PinnedSectionProps {
  messages: ChatMessage[];
  membersMap: Map<string, TeamMember>;
  onUnpin: (message: ChatMessage) => void;
}

function PinnedSection({ messages, membersMap, onUnpin }: PinnedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  return (
    <div className="mx-4 mt-3 mb-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Pin className="size-3.5" />
          <span>Pinned Messages ({messages.length})</span>
        </div>
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-amber-200/50 dark:border-amber-800/30">
          <ScrollArea className="max-h-36">
            <div className="p-2 space-y-2">
              {messages.map((msg) => {
                const sender = msg.senderId ? membersMap.get(msg.senderId) : null;
                const senderName = msg.senderName || sender?.name || 'Unknown';
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 rounded-md bg-background/60 p-2 group"
                  >
                    <Avatar className="size-6 shrink-0">
                      <AvatarFallback
                        className={cn('text-[8px] text-white', getAvatarColor(senderName))}
                      >
                        {getInitials(senderName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{senderName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 truncate">{msg.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUnpin(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ---------- Member List Panel ----------

interface MemberListPanelProps {
  channel: ChatChannel;
  members: TeamMember[];
}

function MemberListPanel({ channel, members }: MemberListPanelProps) {
  let channelMembers: string[] = [];
  try {
    channelMembers = JSON.parse(channel.members || '[]');
  } catch {
    channelMembers = [];
  }

  const channelMemberList = members.filter((m) => channelMembers.includes(m.id));

  const onlineMembers = channelMemberList.filter((m) => m.status === 'active');
  const offlineMembers = channelMemberList.filter((m) => m.status !== 'active');

  return (
    <div className="w-64 border-l bg-card/50 flex flex-col shrink-0">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Members ({channelMemberList.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {onlineMembers.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Online — {onlineMembers.length}
              </div>
              {onlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                >
                  <div className="relative">
                    <Avatar className="size-7">
                      {member.avatar && (
                        <AvatarImage src={member.avatar} alt={member.name} />
                      )}
                      <AvatarFallback
                        className={cn('text-[10px] text-white', getAvatarColor(member.name))}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card',
                        STATUS_COLORS[member.status]
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{member.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{member.role}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {offlineMembers.length > 0 && (
            <>
              {onlineMembers.length > 0 && <Separator className="my-2" />}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Offline — {offlineMembers.length}
              </div>
              {offlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors opacity-60"
                >
                  <div className="relative">
                    <Avatar className="size-7">
                      {member.avatar && (
                        <AvatarImage src={member.avatar} alt={member.name} />
                      )}
                      <AvatarFallback
                        className={cn('text-[10px] text-white', getAvatarColor(member.name))}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card',
                        STATUS_COLORS[member.status]
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{member.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {STATUS_LABELS[member.status] || 'Offline'}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {channelMemberList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No members in this channel</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------- Empty State ----------

function EmptyState({ onCreateChannel }: { onCreateChannel: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <MessageCircle className="size-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No conversations yet</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Start team communication by creating a channel or starting a direct message with a team member.
      </p>
      <Button onClick={onCreateChannel}>
        <Plus className="size-4 mr-2" />
        Create Channel
      </Button>
    </div>
  );
}

// ---------- Channel List Item ----------

interface ChannelListItemProps {
  channel: ChatChannel;
  isActive: boolean;
  onClick: () => void;
}

function ChannelListItem({ channel, isActive, onClick }: ChannelListItemProps) {
  const isDirect = channel.type === 'direct';
  const Icon = isDirect ? AtSign : Hash;

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground/80 hover:bg-accent'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex items-center justify-center size-8 rounded-lg shrink-0',
          isActive
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="size-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{channel.name}</span>
          {channel.latestMessage && (
            <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
              {formatTimestamp(channel.latestMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {channel.latestMessage
              ? `${channel.latestMessage.senderName || 'Someone'}: ${channel.latestMessage.content}`
              : channel.description || 'No messages yet'}
          </span>
          {(channel.unreadCount ?? 0) > 0 && (
            <span className="ml-2 flex items-center justify-center size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shrink-0">
              {(channel.unreadCount ?? 0) > 99 ? '99+' : channel.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------- Main Component ----------

export function CrmChatPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [collectedMentions, setCollectedMentions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Fetch channels
  const {
    data: channels = [],
    isLoading: channelsLoading,
  } = useQuery<ChatChannel[]>({
    queryKey: ['crm-channels'],
    queryFn: async () => {
      const res = await fetch('/api/crm/chat');
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
  });

  // Fetch team members
  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ['crm-members'],
    queryFn: async () => {
      const res = await fetch('/api/crm/members');
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
  });

  // Build members map
  const membersMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Fetch messages for active channel
  const {
    data: messages = [],
    isLoading: messagesLoading,
  } = useQuery<ChatMessage[]>({
    queryKey: ['crm-messages', activeChannelId],
    queryFn: async () => {
      if (!activeChannelId) return [];
      const res = await fetch(`/api/crm/chat?channelId=${activeChannelId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!activeChannelId,
    refetchInterval: 5000,
  });

  // Pinned messages
  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.pinned),
    [messages]
  );

  // Active channel
  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  // Filter channels by search
  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, channelSearch]);

  // Separate channel types
  const channelList = filteredChannels.filter((c) => c.type === 'channel');
  const directList = filteredChannels.filter((c) => c.type === 'direct');

  // Auto-select first channel when channels become available
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      channelId: string;
      senderId: string;
      senderName: string;
      content: string;
      mentions: string[];
    }) => {
      const res = await fetch('/api/crm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', ...data }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-messages', activeChannelId] });
      queryClient.invalidateQueries({ queryKey: ['crm-channels'] });
      setMessageText('');
      setCollectedMentions([]);
      inputRef.current?.focus();
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Pin/unpin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const res = await fetch('/api/crm/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', id, pinned }),
      });
      if (!res.ok) throw new Error('Failed to update message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-messages', activeChannelId] });
      toast.success('Message updated');
    },
    onError: () => {
      toast.error('Failed to update message');
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/chat?id=${id}&type=message`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-messages', activeChannelId] });
      queryClient.invalidateQueries({ queryKey: ['crm-channels'] });
      toast.success('Message deleted');
    },
    onError: () => {
      toast.error('Failed to delete message');
    },
  });

  // Delete channel mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/chat?id=${id}&type=channel`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete channel');
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['crm-channels'] });
      if (activeChannelId === id) {
        setActiveChannelId(null);
        if (isMobile) setMobileShowChat(false);
      }
      toast.success('Channel deleted');
    },
    onError: () => {
      toast.error('Failed to delete channel');
    },
  });

  // Handle send message
  const handleSend = useCallback(() => {
    if (!messageText.trim() || !activeChannelId) return;

    let content = messageText.trim();
    const mentions = [...collectedMentions];

    // Replace @mentions in content with placeholder tokens
    mentions.forEach((mentionId, idx) => {
      const member = membersMap.get(mentionId);
      if (member) {
        const mentionName = `@${member.name.replace(/\s+/g, '').toLowerCase()}`;
        // Find and replace the mention text in content
        const regex = new RegExp(mentionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        content = content.replace(regex, `@mention-${idx}`);
      }
    });

    sendMessageMutation.mutate({
      channelId: activeChannelId,
      senderId: CURRENT_USER_ID,
      senderName: CURRENT_USER_NAME,
      content,
      mentions,
    });
  }, [messageText, activeChannelId, collectedMentions, membersMap, sendMessageMutation]);

  // Handle input change (for @mention detection)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageText(value);

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@([\w.]*)$/);

      if (mentionMatch) {
        setShowMentionPopup(true);
        setMentionQuery(mentionMatch[1]);

        // Calculate position for popup
        if (inputWrapperRef.current) {
          const rect = inputWrapperRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.top,
            left: rect.left,
          });
        }
      } else {
        setShowMentionPopup(false);
        setMentionQuery('');
      }
    },
    []
  );

  // Handle mention select
  const handleMentionSelect = useCallback(
    (member: TeamMember) => {
      const cursorPos = inputRef.current?.selectionStart || messageText.length;
      const textBeforeCursor = messageText.slice(0, cursorPos);
      const mentionStart = textBeforeCursor.lastIndexOf('@');
      const mentionText = `@${member.name.replace(/\s+/g, '').toLowerCase()} `;

      const newText =
        messageText.slice(0, mentionStart) + mentionText + messageText.slice(cursorPos);
      setMessageText(newText);
      setCollectedMentions((prev) =>
        prev.includes(member.id) ? prev : [...prev, member.id]
      );
      setShowMentionPopup(false);
      setMentionQuery('');

      // Set cursor position after the inserted mention
      setTimeout(() => {
        const newCursorPos = mentionStart + mentionText.length;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    },
    [messageText]
  );

  // Handle keyboard shortcut in input
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!showMentionPopup) {
          handleSend();
        }
      }
    },
    [handleSend, showMentionPopup]
  );

  // Handle channel select
  const handleChannelSelect = useCallback(
    (channelId: string) => {
      setActiveChannelId(channelId);
      if (isMobile) setMobileShowChat(true);
    },
    [isMobile]
  );

  // Handle back button (mobile)
  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  // Render channel sidebar
  const renderSidebar = () => (
    <div className="w-72 border-r bg-card flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            Team Chat
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Channel List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {channelsLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-2.5 w-36" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {channelList.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Channels
                  </div>
                  {channelList.map((channel) => (
                    <ChannelListItem
                      key={channel.id}
                      channel={channel}
                      isActive={channel.id === activeChannelId}
                      onClick={() => handleChannelSelect(channel.id)}
                    />
                  ))}
                </>
              )}
              {directList.length > 0 && (
                <>
                  {channelList.length > 0 && <Separator className="my-2" />}
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Direct Messages
                  </div>
                  {directList.map((channel) => (
                    <ChannelListItem
                      key={channel.id}
                      channel={channel}
                      isActive={channel.id === activeChannelId}
                      onClick={() => handleChannelSelect(channel.id)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Render chat area
  const renderChatArea = () => {
    if (!activeChannel) {
      return <EmptyState onCreateChannel={() => setCreateDialogOpen(true)} />;
    }

    return (
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && (
            <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleBack}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div
            className={cn(
              'flex items-center justify-center size-8 rounded-lg shrink-0',
              activeChannel.type === 'direct' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400' : 'bg-primary/10 text-primary'
            )}
          >
            {activeChannel.type === 'direct' ? (
              <AtSign className="size-4" />
            ) : (
              <Hash className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{activeChannel.name}</h3>
            {activeChannel.description && (
              <p className="text-[11px] text-muted-foreground truncate">{activeChannel.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <Phone className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voice Call</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <Video className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Video Call</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showMembers ? 'secondary' : 'ghost'}
                size="icon"
                className="size-8"
                onClick={() => setShowMembers(!showMembers)}
              >
                <Users className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Members</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                <Plus className="size-4 mr-2" /> New Channel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteChannelMutation.mutate(activeChannel.id)}
                disabled={deleteChannelMutation.isPending}
              >
                <Trash2 className="size-4 mr-2" /> Delete Channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pinned Messages */}
      <PinnedSection
        messages={pinnedMessages}
        membersMap={membersMap}
        onUnpin={(msg) => togglePinMutation.mutate({ id: msg.id, pinned: false })}
      />

      {/* Messages List */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {messagesLoading ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn('flex gap-3', i % 2 === 1 && 'flex-row-reverse')}>
                  <Skeleton className="size-8 rounded-full" />
                  <div className={cn('space-y-1.5', i % 2 === 1 && 'items-end')}>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                    <Skeleton className="h-10 w-56 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-1">No messages yet</h3>
              <p className="text-xs text-muted-foreground">Send the first message in this {activeChannel.type === 'direct' ? 'conversation' : 'channel'}</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === CURRENT_USER_ID}
                  membersMap={membersMap}
                  onPin={(msg) =>
                    togglePinMutation.mutate({
                      id: msg.id,
                      pinned: !msg.pinned,
                    })
                  }
                  onDelete={(msg) => deleteMessageMutation.mutate(msg.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t p-3 shrink-0">
        <div
          ref={inputWrapperRef}
          className="relative flex items-end gap-2 rounded-lg border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring/50 transition-all"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground">
                <Paperclip className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach File</TooltipContent>
          </Tooltip>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={`Message ${activeChannel.name}...`}
              rows={1}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[32px] max-h-32 py-1.5"
              style={{
                height: 'auto',
                overflow: messageText.split('\n').length > 3 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground">
                <Smile className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Emoji</TooltipContent>
          </Tooltip>

          <Button
            size="icon"
            className="size-8 shrink-0"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            onClick={handleSend}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>

          <MentionAutocomplete
            members={members}
            visible={showMentionPopup}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            position={mentionPosition}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            Press <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Shift+Enter</kbd> for new line. Type <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">@</kbd> to mention someone.
          </p>
      </div>
    </div>
    );
  };

  // Mobile: show channel list or chat
  if (isMobile) {
    if (mobileShowChat && activeChannel) {
      return (
        <div className="h-full flex flex-col bg-background">
          {renderChatArea()}
          <CreateChannelDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            members={members}
            onSuccess={() => {}}
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-background">
        {renderSidebar()}
        {!channelsLoading && channels.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-4">
            <EmptyState onCreateChannel={() => setCreateDialogOpen(true)} />
          </div>
        )}
        <CreateChannelDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          members={members}
          onSuccess={() => {}}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-full flex bg-background rounded-xl border shadow-sm overflow-hidden">
      {renderSidebar()}

      {channels.length === 0 && !channelsLoading ? (
        <EmptyState onCreateChannel={() => setCreateDialogOpen(true)} />
      ) : (
        renderChatArea()
      )}

      {/* Member List Panel */}
      {showMembers && activeChannel && (
        <MemberListPanel channel={activeChannel} members={members} />
      )}

      <CreateChannelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        members={members}
        onSuccess={() => {}}
      />
    </div>
  );
}
