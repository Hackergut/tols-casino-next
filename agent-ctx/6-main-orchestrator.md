# Task 6 - Card View Toggle + API Response Time Monitor

## Agent: Main Orchestrator

## Work Log

### Part 1: API Timing Infrastructure (`src/lib/tols-hooks.ts`)
- Added `ApiTimingEntry` interface and module-level `apiTimings` array (max 50 entries)
- Added `getApiTimings()`, `clearApiTimings()`, `subscribeToTimings()` exports
- Added `recordTiming()` internal function
- Wrapped all 5 hooks (`useTolsQuery`, `useTolsGet`, `useTolsCreate`, `useTolsUpdate`, `useTolsDelete`) with `performance.now()` timing and `recordTiming()` calls

### Part 2: API Monitor Component (`src/components/admin/shared/api-monitor.tsx`)
- Created self-contained popover component triggered by Gauge icon
- Shows real-time API response times for last 10 requests
- Features:
  - Average response time display (color-coded: green <500ms, amber <1500ms, red >1500ms)
  - Mini CSS bar chart visualization of recent timings
  - Scrollable list with: status dot, entity name, duration (ms), status code badge, time ago
  - Clear button to reset timing data
  - Empty state when no data
  - Subscribes to timing changes via `subscribeToTimings()`
  - Periodic refresh when popover is open (updates time-ago labels)

### Part 3: Card View Toggle (`src/components/admin/shared/data-table.tsx`)
- Added `cardView?: boolean` prop (default false, backward compatible)
- Added `LayoutGrid` and `List` icon imports, plus `ToggleGroup`/`ToggleGroupItem` from shadcn/ui
- Toggle button appears in toolbar (only when `cardView` is true)
- Card layout implementation:
  - Responsive CSS grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
  - First visible column as bold card title
  - Second visible column as subtitle
  - Remaining columns as label-value pairs
  - Action buttons (view/edit/delete) at bottom
  - Alternating background hint (`bg-card` vs `bg-muted/15`)
  - Hover: `hover:shadow-md` and `hover:border-primary/30`
  - Framer Motion stagger entrance animations
- Skeleton cards for loading state (3 cards with pulse)
- Error state and empty state centered in grid (same style as table)
- Card view uses same search, filter, pagination, sorting as table

### Part 4: Integration (`src/app/page.tsx`)
- Imported `ApiMonitor` component
- Added `<ApiMonitor />` to StickyHeader, between connection status dot and NotificationPanel

## Stage Summary
- All 3 parts implemented and passing lint
- Card view toggle is backward compatible (no prop change needed for existing consumers)
- API monitor is self-contained, uses module-level timing store (no external state management)
- Dev server compiles and runs successfully