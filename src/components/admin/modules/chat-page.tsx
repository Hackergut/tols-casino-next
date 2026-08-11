'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/admin/shared/data-table';
import { EntityDialog, type FieldConfig } from '@/components/admin/shared/entity-dialog';
import { DeleteDialog } from '@/components/admin/shared/delete-dialog';
import { DetailDialog } from '@/components/admin/shared/detail-dialog';
import { formatDate } from '@/lib/tols-utils';
import { useTolsQuery } from '@/lib/tols-hooks';
import type { ChatMessage } from '@/types/tols';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Bot, User, MessagesSquare, Hash, Calendar, Users } from 'lucide-react';
import { PageDecoration } from '@/components/admin/shared/page-decoration';

const ENTITY = 'ChatMessage';

const createFields: FieldConfig[] = [
  { key: 'sender_user_id', label: 'Sender User ID', type: 'text', required: true, placeholder: 'Enter sender user ID' },
  { key: 'recipient_user_id', label: 'Recipient User ID', type: 'text', placeholder: 'Leave empty for channel messages' },
  {
    key: 'channel',
    label: 'Channel',
    type: 'select',
    required: true,
    options: [
      { label: 'Global', value: 'global' },
      { label: 'Game Room', value: 'game_room' },
      { label: 'Tournament', value: 'tournament_<id>' },
      { label: 'Private', value: 'private' },
    ],
  },
  { key: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Message content...' },
];

const editFields: FieldConfig[] = [
  { key: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Updated message content...' },
];

function channelColor(channel: string) {
  switch (channel) {
    case 'global': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
    case 'game_room': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'tournament_<id>': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'private': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function channelLabel(channel: string) {
  return channel.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function RecentMessagesPreview() {
  const { data, isLoading } = useTolsQuery<ChatMessage>(ENTITY, {
    limit: 6,
    sort_by: '-created_date',
  });

  const messages = data?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-5 w-48 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Recent Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {messages.map((msg, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isEven ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isEven ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[70%] space-y-0.5 ${isEven ? '' : 'text-right'}`}>
                  <div className="flex items-center gap-1.5 ${isEven ? '' : 'justify-end'}">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {msg.sender_user_id?.slice(0, 6)}...
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${channelColor(msg.channel)}`}>
                      {channelLabel(msg.channel)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(msg.created_date)}
                    </span>
                  </div>
                  <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${isEven ? 'bg-primary text-primary-foreground rounded-tl-sm' : 'bg-muted rounded-tr-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ChatSummaryCards() {
  const { data, isLoading } = useTolsQuery<ChatMessage>(ENTITY, { limit: 200 });
  const messages = data?.data || [];

  const totalMessages = messages.length;
  const today = new Date().toISOString().split('T')[0];
  const todayMessages = messages.filter((m) => m.created_date?.startsWith(today)).length;
  const uniqueChannels = new Set(messages.map((m) => m.channel)).size;
  const uniqueSenders = new Set(messages.map((m) => m.sender_user_id)).size;

  const cards = [
    { label: 'Total Messages', value: totalMessages.toLocaleString(), icon: MessagesSquare, color: 'sky' },
    { label: "Today's Messages", value: todayMessages.toLocaleString(), icon: Calendar, color: 'emerald' },
    { label: 'Active Channels', value: uniqueChannels.toLocaleString(), icon: Hash, color: 'purple' },
    { label: 'Unique Senders', value: uniqueSenders.toLocaleString(), icon: Users, color: 'amber' },
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

export function ChatPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<ChatMessage | null>(null);

  const columns: Column<ChatMessage>[] = [
    {
      key: 'sender_user_id',
      label: 'Sender',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs cursor-default hover:underline">
              {item.sender_user_id?.slice(0, 8)}...
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="font-mono text-xs">{item.sender_user_id}</p></TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'recipient_user_id',
      label: 'Recipient',
      render: (item) =>
        item.recipient_user_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs cursor-default hover:underline">
                {item.recipient_user_id.slice(0, 8)}...
              </span>
            </TooltipTrigger>
            <TooltipContent><p className="font-mono text-xs">{item.recipient_user_id}</p></TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${channelColor(item.channel)}`}>
          {channelLabel(item.channel)}
        </span>
      ),
    },
    {
      key: 'content',
      label: 'Content',
      render: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm cursor-default hover:underline line-clamp-1 max-w-[250px]">
              {item.content?.length > 60 ? item.content.slice(0, 60) + '...' : item.content || '—'}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-md">
            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'created_date',
      label: 'Created',
      render: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.created_date)}</span>,
    },
  ];

  return (
    <div className="relative">
      <PageDecoration variant="sky" />
      <div className="relative z-10 space-y-6">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <MessagesSquare className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chat Messages</h1>
            <p className="text-sm text-muted-foreground">Monitor in-platform messaging activity, moderation, and channel engagement</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />
      </div>

      <ChatSummaryCards />

      <RecentMessagesPreview />

      <DataTable<ChatMessage>
        entity={ENTITY}
        columns={columns}
        filterKey="sender_user_id"
        title="All Messages"
        createLabel="Send Message"
        onCreate={() => setCreateOpen(true)}
        onView={(item) => { setSelected(item); setViewOpen(true); }}
        onEdit={(item) => { setSelected(item); setEditOpen(true); }}
        onDelete={(item) => { setSelected(item); setDeleteOpen(true); }}
      />

      <EntityDialog
        entity={ENTITY}
        title="Chat Message"
        description="Send a new chat message as an admin."
        fields={createFields}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EntityDialog
        entity={ENTITY}
        title="Chat Message"
        description="Edit message content."
        fields={editFields}
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={selected?.id}
        defaultValues={selected ? { content: selected.content } : undefined}
      />

      <DetailDialog
        title="Chat Message"
        open={viewOpen}
        onOpenChange={setViewOpen}
        data={selected as unknown as Record<string, unknown> | null}
      />

      <DeleteDialog
        entity={ENTITY}
        entityName="Chat Message"
        itemId={selected?.id || null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      </div>
    </div>
  );
}
