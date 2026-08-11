# Task 4-a: Bulk Row Selection + User Detail Profile Panel

## Work Summary

### Part 1: Bulk Row Selection with Toolbar Actions in DataTable

**File modified:** `/src/components/admin/shared/data-table.tsx`

Changes:
1. **New props added:**
   - `selectable?: boolean` (default false) - enables row selection mode
   - `onSelectionChange?: (ids: Set<string>) => void` - callback for selection changes
   - `onBulkDelete?: (ids: string[]) => void` - callback for bulk delete action

2. **Checkbox column:** When `selectable=true`, a checkbox column is added before the expandable column. The header has a "select all" checkbox (supports indeterminate state via Radix's `"indeterminate"` value). Each row gets an individual checkbox.

3. **Selected row highlighting:** Selected rows get `bg-primary/5` background class.

4. **Bulk Actions Toolbar:** Animated with framer-motion (slide down + fade). Shows when rows are selected with:
   - Count display ("X selected")
   - Bulk Delete button (destructive variant, red, Trash2 icon) - only shown when `onBulkDelete` prop provided
   - Bulk Export button (outline variant, Download icon) - exports only selected rows using existing `exportToCSV` utility
   - Clear Selection button (ghost variant, X icon, ml-auto to push right)

5. **Selection clearing:** Uses React's "adjusting state during render" pattern (comparing prevItems ref) to clear selection when items change (page/filter/sort changes). Avoids `useEffect` to comply with React Compiler lint rules.

6. **`totalColSpan`** updated: `visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + 1`

7. **Skeleton loading** also includes selectable checkbox skeleton.

### Part 2: User Detail Profile Panel

**File created:** `/src/components/admin/shared/user-profile-panel.tsx`

A slide-in Sheet panel (from right side) with:

1. **Header Section:** Avatar circle with first letter + color derived from username hash, username, email, role badge, status badge, join date.

2. **Tabbed Content (4 tabs):**
   - **Overview:** 6 stat mini-cards in 2-col grid showing Total Deposits, Total Withdrawals, Total Bets, Win Rate, Balance, Total Bet Count. Each with colored icon + label + value.
   - **Wallets:** Mini table showing user's wallets (currency badge, chain, balance, status). Fetched via `useTolsQuery('UserWallet', { q: { user_id } })`.
   - **Transactions:** Combined timeline of deposits + withdrawals sorted by date desc. Each item shows icon (green arrow for deposit, red for withdrawal), amount, status badge, date.
   - **Bets:** Compact list of recent bets showing game type, result badge (win/loss/pending), bet amount, profit/loss (color-coded green/red), date.

3. **Quick Actions:** 2x2 grid at bottom with "Edit User", "View Wallet", "View Deposits", "View Bets" buttons that navigate via Zustand store.

4. Uses `useTolsGet` for user data and `useTolsQuery` for related entities.

### Part 3: Users Page Update

**File modified:** `/src/components/admin/modules/users-page.tsx`

- Added `UserProfilePanel` import and state (`profileUserId`, `profileOpen`)
- Added `selectable` prop to DataTable
- Added `onBulkDelete` handler using `useTolsDelete` mutation
- Added `extraActions` prop with a Profile button (UserCircle icon, emerald color) that opens the profile panel

## Lint Status: ✅ PASS (0 errors, 0 warnings)
