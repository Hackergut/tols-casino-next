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
  | 'affiliates'
  | 'promotions'
  | 'settings'
  | 'analytics'
  | 'support'
  | 'audit-logs'
  | 'site-config'
  | 'bonus-engine'
  | 'notifications'
  | 'loyalty'
  | 'responsible-gaming'
  | 'telegram-alerts'
  | 'crypto-payments'
  | 'rtp-control'
  | 'white-label'
  | 'deposit-addresses'
  | 'live-monitor';

export const PAGE_LABELS: Record<AdminPage, string> = {
  'dashboard': 'Dashboard',
  'users': 'Users',
  'wallets': 'Wallets',
  'deposits': 'Deposits',
  'withdrawals': 'Withdrawals',
  'slot-games': 'Slot Games',
  'games-catalog': 'Games Catalog',
  'casino-lobby': 'Casino Lobby',
  'bets': 'Bets',
  'demo-sessions': 'Demo Sessions',
  'jackpot': 'Jackpot',
  'tournaments': 'Tournaments',
  'tournament-entries': 'Tournament Entries',
  'affiliates': 'Affiliates',
  'promotions': 'Promotions',
  'settings': 'Settings',
  'analytics': 'Analytics',
  'support': 'Support',
  'audit-logs': 'Audit Logs',
  'site-config': 'Site Config',
  'bonus-engine': 'Bonus Engine',
  'notifications': 'Notifications',
  'loyalty': 'Loyalty Program',
  'responsible-gaming': 'Responsible Gaming',
  'telegram-alerts': 'Telegram Alerts',
  'crypto-payments': 'Crypto Payments',
  'rtp-control': 'RTP Control',
  'white-label': 'White-Label',
  'deposit-addresses': 'Deposit Addresses',
  'live-monitor': 'Live Monitor',
};

export interface AdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface AdminState {
  currentPage: AdminPage;
  isSidebarCollapsed: boolean;
  isSidebarOpen: boolean;
  searchQuery: string;
  breadcrumbs: string[];
  isLoading: boolean;
  notifications: AdminNotification[];
  selectedEntityId: string | null;
  setPage: (page: AdminPage) => void;
  toggleSidebarCollapse: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setBreadcrumbs: (breadcrumbs: string[]) => void;
  setLoading: (loading: boolean) => void;
  addNotification: (notification: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setSelectedEntityId: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      currentPage: 'dashboard',
      isSidebarCollapsed: false,
      isSidebarOpen: false,
      searchQuery: '',
      breadcrumbs: ['Admin', 'Dashboard'],
      isLoading: false,
      notifications: [],
      selectedEntityId: null,

      setPage: (page: AdminPage) => {
        set({
          currentPage: page,
          breadcrumbs: ['Admin', PAGE_LABELS[page] || page],
          isLoading: true,
          isSidebarOpen: false,
        });
        setTimeout(() => set({ isLoading: false }), 300);
      },

      toggleSidebarCollapse: () => set({ isSidebarCollapsed: !get().isSidebarCollapsed }),
      setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
      setSearchQuery: (query: string) => set({ searchQuery: query }),
      setBreadcrumbs: (breadcrumbs: string[]) => set({ breadcrumbs }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      addNotification: (notification) => {
        const newNotification: AdminNotification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          read: false,
        };
        set({ notifications: [newNotification, ...get().notifications].slice(0, 50) });
      },

      markNotificationRead: (id: string) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        });
      },

      clearNotifications: () => set({ notifications: [] }),
      setSelectedEntityId: (id: string | null) => set({ selectedEntityId: id }),
    }),
    {
      name: 'admin-store',
      partialize: (state) => ({
        currentPage: state.currentPage,
        isSidebarCollapsed: state.isSidebarCollapsed,
        notifications: state.notifications,
        selectedEntityId: state.selectedEntityId,
      }),
    }
  )
);
