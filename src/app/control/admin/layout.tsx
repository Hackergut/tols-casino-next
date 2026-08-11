'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AdminSidebar, MobileMenuButton } from '@/components/admin/admin-sidebar';
import { useAdminStore, PAGE_LABELS } from '@/stores/admin';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = useAdminStore((s) => s.sidebarOpen);
  const currentPage = useAdminStore((s) => s.currentPage);
  const pageTitle = PAGE_LABELS[currentPage] || 'Dashboard';

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <div className="min-h-screen bg-background text-foreground">
          {/* Desktop Sidebar — CSS toggled, no JS flash */}
          <AdminSidebar />

          {/* Main Content Area — CSS margin, no JS */}
          <div
            className={cn(
              'admin-main-content min-h-screen flex flex-col transition-[margin] duration-300',
              sidebarOpen && 'admin-sidebar-expanded',
            )}
          >
            {/* Sticky Header Bar */}
            <header className="admin-header sticky top-0 z-30 flex items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-md px-3 sm:px-4 safe-area-top">
              {/* Mobile hamburger — CSS hidden on desktop */}
              <MobileMenuButton />

              {/* Mobile: page title — CSS hidden on desktop */}
              <div className="admin-mobile-only flex-1 min-w-0 items-center">
                <span className="admin-mobile-brand truncate">{pageTitle}</span>
              </div>

              {/* Desktop: Control Panel label — CSS hidden on mobile */}
              <div className="admin-desktop-only items-center gap-2">
                <span className="text-sm font-semibold text-foreground/80">Control Panel</span>
                <span
                  className="hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium lg:inline-flex"
                  style={{
                    background: 'color-mix(in oklab, var(--color-lime) 12%, transparent)',
                    color: 'var(--color-lime)',
                  }}
                >
                  <span
                    className="admin-badge-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--color-lime)' }}
                  />
                  Live
                </span>
              </div>

              <div className="flex-1" />

              {/* Back to Casino link */}
              <a
                href="/"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground shrink-0"
              >
                <span className="hidden sm:inline">&#8592; Back to Casino</span>
                <span className="sm:hidden">&#8592;</span>
              </a>
            </header>

            {/* Page Content */}
            <main className="flex-1 p-3 sm:p-4 md:p-6">
              <div className="admin-content admin-page-enter">{children}</div>
            </main>
          </div>

          <Toaster position="bottom-right" richColors />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
