'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminPage =
  | 'dashboard'
  | 'users'
  | 'wallets'
  | 'deposits'
  | 'withdrawals'
  | 'slot-games'
  | 'games-catalog'
  | 'casino-lobby'
  | 'bets'
  | 'demo-sessions'
  | 'jackpot'
  | 'tournaments'
  | 'tournament-entries'
  | 'marketplace'
  | 'collectibles'
  | 'card-packs'
  | 'card-pulls'
  | 'house-earnings'
  | 'affiliates'
  | 'referrals'
  | 'commissions'
  | 'settings'
  | 'responsible-gaming'
  | 'chat'
  | 'crm-team'
  | 'crm-tasks'
  | 'crm-chat'
  | 'crm-emails'
  | 'player-analytics'
  | 'op-controls'
  | 'game-controls'
  | 'deposit-tracker'
  | 'telegram-alerts'
  | 'rtp-control'
  | 'virtual-games'
  | 'deposit-addresses'
  | 'live-monitor'
  | 'bridge';
  | 'live-monitor';

export interface ActionLogEntry {
  id: string;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'view' | 'navigate';
  entity: string;
  entityId?: string;
  details: string;
  status: 'success' | 'error';
}

const MAX_LOG_ENTRIES = 100;

const PAGE_LABELS: Record<AdminPage, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  wallets: 'Wallets',
  deposits: 'Deposits',
  withdrawals: 'Withdrawals',
  'slot-games': 'Slot Games',
  'games-catalog': 'Games Catalog',
  'casino-lobby': 'Casino Frontend',
  bets: 'Bets',
  'demo-sessions': 'Demo Sessions',
  jackpot: 'Global Jackpot',
  tournaments: 'Tournaments',
  'tournament-entries': 'Tournament Entries',
  marketplace: 'Marketplace',
  collectibles: 'Collectibles',
  'card-packs': 'Card Packs',
  'card-pulls': 'Card Pulls',
  'house-earnings': 'House Earnings',
  affiliates: 'Affiliates',
  referrals: 'Referrals',
  commissions: 'Commissions',
  settings: 'Settings',
  'responsible-gaming': 'Responsible Gaming',
  chat: 'Chat Messages',
  'crm-team': 'Team CRM',
  'crm-tasks': 'Tasks',
  'crm-chat': 'Team Chat',
  'crm-emails': 'Emails',
  'player-analytics': 'Player Analytics',
  'op-controls': 'Operations Control',
  'game-controls': 'RTP & Outcome Control',
  'rtp-control': 'RTP Control',
  'deposit-tracker': 'Deposit Tracker',
  'telegram-alerts': 'Telegram Alerts',
  'virtual-games': 'Virtual Games',
  'deposit-addresses': 'Deposit Addresses',
  'live-monitor': 'Live Monitor',
  bridge: 'Bridge — Governance ↔ Casino',
};

export interface SlotAggregatorConfig {
  apiBaseUrl: string;
  apiKey: string;
  operatorMerchantId: string;
  apiSecret: string;
  callbackUrl: string;
}

const DEFAULT_AGGREGATOR_CONFIG: SlotAggregatorConfig = {
  apiBaseUrl: 'https://tolscrypto.base44.app/api',
  apiKey: '',
  operatorMerchantId: '',
  apiSecret: '',
  callbackUrl: '',
};

/* ------------------------------------------------------------------ */
/*  White-Label Platform Connection                                    */
/* ------------------------------------------------------------------ */

export type PlatformType = 'tols' | 'slot_aggregator' | 'payment_gateway' | 'custom';

export interface PlatformConnection {
  id: string;
  name: string;
  type: PlatformType;
  baseUrl: string;
  apiKey: string;
  appKey: string;
  isActive: boolean;
  status: 'disconnected' | 'testing' | 'connected' | 'error';
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PLATFORM_TYPES: Record<PlatformType, { label: string; icon: string; color: string; description: string }> = {
  tols: { label: 'TOLS Platform', icon: 'Layers', color: '#14b8a6', description: 'TOLS gaming platform API' },
  slot_aggregator: { label: 'Slot Aggregator', icon: 'Gamepad2', color: '#f59e0b', description: 'Slot game aggregation service' },
  payment_gateway: { label: 'Payment Gateway', icon: 'ArrowDownToLine', color: '#22c55e', description: 'Payment processing service' },
  custom: { label: 'Custom Platform', icon: 'Globe', color: '#8b5cf6', description: 'Any custom REST API endpoint' },
};

interface AdminState {
  currentPage: AdminPage;
  sidebarOpen: boolean;
  apiKey: string;
  appKey: string;
  slotAggregatorConfig: SlotAggregatorConfig;
  platformConnections: PlatformConnection[];
  activeConnectionId: string | null;
  actionLog: ActionLogEntry[];
  selectedEntityId: string | null;
  setCurrentPage: (page: AdminPage) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setApiKey: (key: string) => void;
  setAppKey: (key: string) => void;
  setSlotAggregatorConfig: (config: Partial<SlotAggregatorConfig>) => void;
  setSelectedEntityId: (id: string | null) => void;
  addActionLog: (entry: Omit<ActionLogEntry, 'id' | 'timestamp'>) => void;
  clearActionLog: () => void;
  addPlatformConnection: (connection: Omit<PlatformConnection, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePlatformConnection: (id: string, updates: Partial<PlatformConnection>) => void;
  removePlatformConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setConnectionStatus: (id: string, status: PlatformConnection['status']) => void;
}

export { PAGE_LABELS };

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      currentPage: 'dashboard',
      sidebarOpen: true,
      apiKey: '',
      appKey: '',
      slotAggregatorConfig: DEFAULT_AGGREGATOR_CONFIG,
      platformConnections: [],
      activeConnectionId: null,
      actionLog: [],
      selectedEntityId: null,

      setCurrentPage: (page) => {
        const prev = get().currentPage;
        set({ currentPage: page });
        if (prev !== page || page !== 'dashboard') {
          const label = PAGE_LABELS[page] || page;
          get().addActionLog({
            action: 'navigate',
            entity: label,
            details: `Navigated to ${label}`,
            status: 'success',
          });
        }
      },

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setApiKey: (key) => set({ apiKey: key }),
      setAppKey: (key) => set({ appKey: key }),
      setSlotAggregatorConfig: (config) =>
        set((state) => ({
          slotAggregatorConfig: { ...state.slotAggregatorConfig, ...config },
        })),
      setSelectedEntityId: (id) => set({ selectedEntityId: id }),

      addPlatformConnection: (connection) => {
        const id = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const newConnection: PlatformConnection = {
          ...connection,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          platformConnections: [...state.platformConnections, newConnection],
        }));
        return id;
      },

      updatePlatformConnection: (id, updates) => {
        set((state) => ({
          platformConnections: state.platformConnections.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      removePlatformConnection: (id) => {
        set((state) => ({
          platformConnections: state.platformConnections.filter((c) => c.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        }));
      },

      setActiveConnection: (id) => {
        set((state) => ({
          activeConnectionId: id,
          platformConnections: state.platformConnections.map((c) => ({
            ...c,
            isActive: c.id === id,
          })),
        }));
      },

      setConnectionStatus: (id, status) => {
        set((state) => ({
          platformConnections: state.platformConnections.map((c) =>
            c.id === id ? { ...c, status, lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      addActionLog: (entry) =>
        set((state) => {
          const newEntry: ActionLogEntry = {
            ...entry,
            id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: new Date(),
          };
          const log = [...state.actionLog, newEntry];
          if (log.length > MAX_LOG_ENTRIES) {
            log.splice(0, log.length - MAX_LOG_ENTRIES);
          }
          return { actionLog: log };
        }),

      clearActionLog: () => set({ actionLog: [] }),
    }),
    {
      name: 'tols-admin-store',
      partialize: (state) => ({
        apiKey: state.apiKey,
        appKey: state.appKey,
        slotAggregatorConfig: state.slotAggregatorConfig,
        platformConnections: state.platformConnections,
        activeConnectionId: state.activeConnectionId,
        sidebarOpen: state.sidebarOpen,
        selectedEntityId: state.selectedEntityId,
      }),
    }
  )
);
