# Task 2-a: Admin Panel Route (/control/admin)

## Agent: Main

### What was done:

1. **Created `/src/app/control/admin/layout.tsx`**
   - Client component wrapping all admin pages
   - Includes `QueryClientProvider` with module-level `QueryClient` (staleTime 30s, no refetch on focus)
   - Includes `ThemeProvider` (dark default, class attribute)
   - Includes `Toaster` from sonner (bottom-right, rich colors)
   - Renders `AdminSidebar` (fixed, left side, hidden on mobile)
   - Renders `MobileMenuButton` in sticky header
   - Content area offset by sidebar width using `ml-64`/`ml-16` with `useIsMobile()` check
   - Sticky header with mobile menu button and "← Casino" back link
   - Smooth margin transition (300ms) when sidebar collapses/expands

2. **Created `/src/app/control/admin/page.tsx`** (replaced placeholder)
   - Password protection gate using localStorage (`tols_admin_auth` key)
   - Default password: `admin2024` (overridable via `NEXT_PUBLIC_ADMIN_PASSWORD`)
   - Password gate renders as a `fixed inset-0 z-50` overlay covering the layout sidebar
   - All 32 admin modules imported via `next/dynamic` to avoid OOM:
     - DashboardPage, UsersPage, DepositsPage, WithdrawalsPage, WalletsPage
     - GamesCatalogPage, SlotGamesPage, CasinoLobbyPage, BetsPage, DemoSessionsPage
     - JackpotPage, TournamentsPage, TournamentEntriesPage
     - MarketplacePage, CollectiblesPage, CardPacksPage, CardPullsPage
     - HouseEarningsPage, AffiliatesPage, ReferralsPage, CommissionsPage
     - SettingsPage, ResponsibleGamingPage, ChatPage
     - CrmTeamPage, CrmTasksPage, CrmChatPage, CrmEmailsPage
     - PlayerAnalyticsPage, OpControlsPage, DepositTrackerPage, TelegramAlertsPage
   - `PageRouter` component with switch/case mapping `useAdminStore().currentPage` to correct module
   - `PageHeader` shows current page title (from `PAGE_LABELS`) and logout button
   - Loading spinner for each dynamic import

### Verified:
- All 32 module export names confirmed via `rg` scan
- ESLint passes with zero errors
- Dev server compiles without errors
- No modifications to root page.tsx or admin sidebar
- No new API routes created
