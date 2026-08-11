'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronDown,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  Inbox,
  AlertTriangle,
  Filter,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  LayoutGrid,
  List,
  ArrowRightLeft,
  Columns3,
  Copy,
  Check,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { AnimatePresence, motion } from 'framer-motion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useTolsQuery } from '@/lib/tols-hooks';
import { useAdminStore } from '@/stores/admin';
import { ENTITY_MAP } from '@/types/tols';
import { ENTITY_ID_FIELD_MAP } from '@/components/admin/shared/entity-cross-links';
import { ExportButton } from '@/components/admin/shared/export-button';
import { DateRangePicker } from '@/components/admin/shared/date-range-picker';
import { exportToCSV } from '@/lib/csv-export';
import { StatusBadge, CurrencyBadge, RarityBadge, formatDate, truncateAddress } from '@/lib/tols-utils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  hidden?: boolean;
  statusOptions?: { label: string; value: string }[];
}

export interface FilterOption {
  label: string;
  value: string;
  field: string;
}

export interface StatusFilterOption {
  label: string;
  value: string;
}

interface DataTableProps<T> {
  entity: string;
  columns: Column<T>[];
  filterKey?: string;
  defaultFilter?: string;
  onCreate?: () => void;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  createLabel?: string;
  title?: string;
  extraActions?: (item: T) => React.ReactNode;
  filters?: FilterOption[];
  entityLabel?: string;
  statusFilters?: StatusFilterOption[];
  statusFilterKey?: string;
  exportable?: boolean;
  exportFilename?: string;
  dateRangeKey?: string;
  expandable?: boolean;
  selectable?: boolean;
  onSelectionChange?: (ids: Set<string>) => void;
  onBulkDelete?: (ids: string[]) => void;
  bulkStatusChange?: boolean;
  cardView?: boolean;
  onBatchStatusChange?: (ids: string[], newStatus: string) => void;
  statusField?: string;
  statusOptions?: { label: string; value: string }[];
  inlineEditableFields?: string[];
  onInlineEdit?: (id: string, field: string, newValue: string) => void;
  /** Show a row index (#) column (default: false) */
  showRowIndex?: boolean;
  /** Enable quick-view popover on row hover (default: true) */
  quickView?: boolean;
}

export function DataTable<T extends { id: string }>({
  entity,
  columns,
  filterKey,
  defaultFilter,
  onCreate,
  onView,
  onEdit,
  onDelete,
  createLabel = 'Create',
  title,
  extraActions,
  filters,
  entityLabel,
  statusFilters,
  statusFilterKey = 'status',
  exportable = false,
  exportFilename,
  dateRangeKey,
  expandable = false,
  selectable = false,
  onSelectionChange,
  onBulkDelete,
  bulkStatusChange = false,
  cardView = false,
  onBatchStatusChange,
  statusField,
  statusOptions,
  inlineEditableFields,
  onInlineEdit,
  showRowIndex = false,
  quickView = true,
}: DataTableProps<T>) {
  const apiKey = useAdminStore((s) => s.apiKey);
  const setCurrentPage = useAdminStore((s) => s.setCurrentPage);
  const setSelectedEntityId = useAdminStore((s) => s.setSelectedEntityId);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [goToPage, setGoToPage] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const limit = 15;

  // Expanded rows state for expandable detail view
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [flashCell, setFlashCell] = useState<{ rowId: string; field: string } | null>(null);

  // Track which field key was copied (for checkmark feedback)
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Card/table view mode
  const [userViewMode, setUserViewMode] = useState<'table' | 'card' | null>(null);
  const [hasManualOverride, setHasManualOverride] = useState(false);

  // Mobile detection
  const isMobile = useIsMobile();

  // Scroll tracking for scroll-to-top button
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Column visibility state
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());

  // Bulk status change state (legacy internal API approach)
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);

  // === Quick-View Popover State ===
  const [quickViewItem, setQuickViewItem] = useState<T | null>(null);
  const [quickViewPos, setQuickViewPos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive effective view mode: mobile auto-switches to card, desktop to table, unless user manually overrode
  const viewMode = useMemo(() => {
    if (userViewMode !== null && hasManualOverride) return userViewMode;
    if (cardView && isMobile) return 'card';
    return 'table';
  }, [userViewMode, cardView, isMobile, hasManualOverride]);

  const mobileAutoSwitched = cardView && isMobile && !hasManualOverride;

  // Gradient colors for card top borders
  const cardGradientColors = useMemo(
    () => [
      'from-rose-400 via-orange-400 to-amber-400',
      'from-violet-400 via-purple-400 to-fuchsia-400',
      'from-emerald-400 via-teal-400 to-cyan-400',
      'from-pink-400 via-rose-400 to-red-400',
      'from-lime-400 via-green-400 to-emerald-400',
      'from-amber-400 via-yellow-400 to-orange-400',
    ],
    []
  );

  // Entity-specific gradient for expanded rows
  const entityGradient = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < entity.length; i++) {
      hash = entity.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % cardGradientColors.length;
    return cardGradientColors[idx];
  }, [entity, cardGradientColors]);

  // Merge statusFilters into the filters array for unified handling
  const mergedFilters = useMemo(() => {
    const base = filters || [];
    if (!statusFilters || statusFilters.length === 0) return base;
    const statusOpts: FilterOption[] = statusFilters.map((sf) => ({
      label: sf.label,
      value: sf.value,
      field: statusFilterKey,
    }));
    return [...base, ...statusOpts];
  }, [filters, statusFilters, statusFilterKey]);

  const handleViewModeChange = useCallback((val: 'table' | 'card') => {
    setUserViewMode(val);
    setHasManualOverride(true);
  }, []);

  const dismissMobileHint = useCallback(() => {
    setHasManualOverride(true);
  }, []);

  // Toggle expand with useCallback for performance
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Copy to clipboard handler (for expanded row fields)
  const handleCopyField = useCallback((id: string, key: string, value: string) => {
    navigator.clipboard.writeText(value).then(
      () => {
        const fieldId = `${id}:${key}`;
        setCopiedFieldKey(fieldId);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopiedFieldKey(null), 1500);
      },
      () => {
        toast.error('Failed to copy');
      }
    );
  }, []);

  // === Context Menu Handlers ===
  const handleCopyId = useCallback((item: T) => {
    navigator.clipboard.writeText(item.id).then(
      () => toast.success('ID copied to clipboard'),
      () => toast.error('Failed to copy')
    );
  }, []);

  // handleCopyRowData is defined after effectiveVisibleColumns (see below)

  // === Quick-View Mouse Handlers ===
  const handleRowMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (quickView) {
        setQuickViewPos({ x: e.clientX, y: e.clientY });
      }
    },
    [quickView]
  );

  const handleRowMouseEnter = useCallback(
    (item: T) => {
      if (!quickView) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setQuickViewItem(item);
      }, 400);
    },
    [quickView]
  );

  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setQuickViewItem(null);
  }, []);

  // Quick view fields (first 6 visible columns) - defined after effectiveVisibleColumns
  // quickViewFields is defined after effectiveVisibleColumns (see below)

  // Adjusted popover position to prevent off-screen rendering
  const quickViewAdjustedPos = useMemo(() => {
    const popoverWidth = 280;
    const popoverHeight = 260;
    return {
      x: Math.min(quickViewPos.x + 16, window.innerWidth - popoverWidth - 16),
      y: Math.min(quickViewPos.y + 16, window.innerHeight - popoverHeight - 16),
    };
  }, [quickViewPos]);

  // Inline edit handler
  const handleInlineEditChange = useCallback(
    (rowId: string, field: string, newValue: string) => {
      setEditingCell(null);
      setFlashCell({ rowId, field });
      onInlineEdit?.(rowId, field, newValue);
    },
    [onInlineEdit]
  );

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (range: { from: string; to: string } | null) => {
      setDateRange(range);
      setPage(0);
    },
    []
  );

  // Handle column sort
  const handleSort = useCallback((col: Column<T>) => {
    const key = col.sortKey || col.key;
    setSortField((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
    setPage(0);
  }, []);

  // Build filter query from active filters
  const filterQuery = useMemo(() => {
    if (mergedFilters.length === 0) return defaultFilter || '';
    const activeOpts = mergedFilters.filter((f) => activeFilters.has(f.value));
    if (activeOpts.length === 0) return defaultFilter || '';
    const fieldGroups: Record<string, string[]> = {};
    activeOpts.forEach((opt) => {
      if (!fieldGroups[opt.field]) fieldGroups[opt.field] = [];
      fieldGroups[opt.field].push(opt.value);
    });
    const orClauses = Object.entries(fieldGroups).map(([field, values]) => ({
      [field]: values.length === 1 ? values[0] : { $in: values },
    }));
    return JSON.stringify(orClauses.length === 1 ? orClauses[0] : { $or: orClauses });
  }, [activeFilters, mergedFilters, defaultFilter]);

  const buildQuery = useCallback(() => {
    if (!search && !filterQuery && !dateRange) return undefined;
    const parts: Record<string, unknown> = {};
    if (search && filterKey) {
      parts[filterKey] = { $regex: search, $options: 'i' };
    }
    if (filterQuery) {
      try {
        const extra = JSON.parse(filterQuery);
        Object.assign(parts, extra);
      } catch {
        // ignore invalid JSON
      }
    }
    if (dateRange && dateRangeKey) {
      parts[dateRangeKey] = {
        $gte: dateRange.from,
        $lte: dateRange.to,
      };
    }
    return Object.keys(parts).length > 0 ? JSON.stringify(parts) : undefined;
  }, [search, filterQuery, filterKey, dateRange, dateRangeKey]);

  const buildSortBy = useCallback(() => {
    if (!sortField) return '-created_date';
    return sortDir === 'desc' ? `-${sortField}` : sortField;
  }, [sortField, sortDir]);

  const { data, isLoading, isError, error, refetch, isFetching } = useTolsQuery<T>(entity, {
    limit,
    skip: page * limit,
    q: buildQuery(),
    sort_by: buildSortBy(),
  });

  const apiErrorMessage = error instanceof Error ? error.message : undefined;

  const items = data?.data || [];
  const hasMore = items.length === limit;
  const visibleColumns = columns.filter((c) => !c.hidden);

  const effectiveVisibleColumns = useMemo(
    () => visibleColumns.filter((c) => !hiddenColumnKeys.has(c.key)),
    [visibleColumns, hiddenColumnKeys]
  );

  // === Copy Row Data (defined after effectiveVisibleColumns) ===
  const handleCopyRowData = useCallback(
    (item: T) => {
      const keyData: Record<string, unknown> = {};
      effectiveVisibleColumns.forEach((col) => {
        keyData[col.label] = item[col.key];
      });
      navigator.clipboard.writeText(JSON.stringify(keyData, null, 2)).then(
        () => toast.success('Row data copied to clipboard'),
        () => toast.error('Failed to copy')
      );
    },
    [effectiveVisibleColumns]
  );

  // Quick view fields (first 6 visible columns)
  const quickViewFields = useMemo(
    () => effectiveVisibleColumns.slice(0, 6),
    [effectiveVisibleColumns]
  );

  // Total column count including selectable + expandable + row index + actions
  const totalColSpan = effectiveVisibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (showRowIndex ? 1 : 0) + 1;

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someSelected = items.some((item) => selectedIds.has(item.id)) && !allSelected;

  const toggleColumnVisibility = useCallback((key: string) => {
    setHiddenColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        next.clear();
      } else {
        items.forEach((item) => next.add(item.id));
      }
      onSelectionChange?.(next);
      return next;
    });
  }, [allSelected, items, onSelectionChange]);

  const toggleSelectRow = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(next);
        return next;
      });
    },
    [onSelectionChange]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  // Legacy bulk status change (direct API calls)
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (!apiKey || selectedIds.size === 0) return;
      setBulkStatusLoading(true);
      const ids = Array.from(selectedIds);
      const basePath = ENTITY_MAP[entity] || `/entities/${entity}`;
      const statusFld = statusField || statusFilterKey || 'status';

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const searchParams = new URLSearchParams();
          searchParams.set('path', `${basePath}/${id}`);
          searchParams.set('api_key', apiKey);
          const res = await fetch(`/api/tols?${searchParams.toString()}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [statusFld]: newStatus }),
          });
          if (!res.ok) throw new Error(`Failed for ${id}`);
          return res.json();
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed === 0) {
        toast.success(`Successfully updated ${succeeded} items to ${newStatus}`);
      } else {
        toast.error(`Failed to update ${failed} item${failed > 1 ? 's' : ''}`);
        if (succeeded > 0) {
          toast.success(`Successfully updated ${succeeded} items to ${newStatus}`);
        }
      }

      clearSelection();
      refetch();
      setBulkStatusLoading(false);
    },
    [apiKey, selectedIds, entity, statusField, statusFilterKey, clearSelection, refetch]
  );

  // Callback-based batch status change (new approach)
  const handleCallbackBatchStatusChange = useCallback(
    (newStatus: string) => {
      if (selectedIds.size === 0 || !onBatchStatusChange) return;
      const ids = Array.from(selectedIds);
      onBatchStatusChange(ids, newStatus);
      clearSelection();
      toast.success(`Status changed to "${newStatus}" for ${ids.length} item${ids.length > 1 ? 's' : ''}`);
    },
    [selectedIds, onBatchStatusChange, clearSelection]
  );

  const showBulkStatusChange = bulkStatusChange && !!statusFilters && statusFilters.length > 0;
  const showCallbackBatchStatusChange = !!onBatchStatusChange && !!statusOptions && statusOptions.length > 0;

  const toggleFilter = useCallback((opt: FilterOption) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(opt.value)) {
        next.delete(opt.value);
      } else {
        next.add(opt.value);
      }
      return next;
    });
    setPage(0);
  }, []);

  const displayLabel = entityLabel || entity.replace(/-/g, ' ');

  // Columns for CSV export (excludes row index)
  const exportColumns = useMemo(() => effectiveVisibleColumns.map((c) => ({ key: c.key, label: c.label })), [effectiveVisibleColumns]);

  const estimatedTotalPages = useMemo(() => {
    if (items.length < limit) return page + 1;
    return page + 2;
  }, [items.length, page, limit]);

  // Data key for animated transitions
  const dataKey = useMemo(
    () => `${entity}-${page}-${search}-${Array.from(activeFilters).sort().join(',')}-${dateRange?.from || ''}-${dateRange?.to || ''}`,
    [entity, page, search, activeFilters, dateRange]
  );

  const handleBulkExport = useCallback(() => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      toast.error('No items selected for export');
      return;
    }
    exportToCSV(
      selectedItems as unknown as Record<string, unknown>[],
      exportColumns,
      exportFilename || entity
    );
    toast.success(`Exported ${selectedItems.length} items`);
  }, [items, selectedIds, exportColumns, exportFilename, entity]);

  // Labels for active filter badges
  const activeFilterLabels = useMemo(() => {
    if (activeFilters.size === 0) return [];
    return mergedFilters
      .filter((f) => activeFilters.has(f.value))
      .map((f) => ({ label: f.label, value: f.value }));
  }, [activeFilters, mergedFilters]);

  // Go to page handler
  const handleGoToPage = useCallback(() => {
    const num = parseInt(goToPage, 10);
    if (!isNaN(num) && num > 0) {
      setPage(num - 1);
      setGoToPage('');
    }
  }, [goToPage]);

  // Helper: detect field type for smart formatting in expanded view
  const formatExpandedValue = useCallback(
    (key: string, value: unknown): React.ReactNode => {
      if (value === null || value === undefined) return '—';

      const strVal = String(value);
      const lowerKey = key.toLowerCase();

      // Date fields
      if (lowerKey.endsWith('_date') || lowerKey.endsWith('_at') || lowerKey.endsWith('_time') || lowerKey === 'created' || lowerKey === 'updated') {
        return <span className="text-muted-foreground">{formatDate(strVal)}</span>;
      }

      // Status field
      if (lowerKey === 'status') {
        return <StatusBadge status={strVal} />;
      }

      // Role field
      if (lowerKey === 'role') {
        return <span className="capitalize text-sm font-medium">{strVal}</span>;
      }

      // Currency field
      if (lowerKey === 'currency' || lowerKey === 'token') {
        return <CurrencyBadge currency={strVal} />;
      }

      // Rarity field
      if (lowerKey === 'rarity') {
        return <RarityBadge rarity={strVal} />;
      }

      // Amount/number fields
      if ((lowerKey === 'amount' || lowerKey === 'value' || lowerKey === 'balance' || lowerKey === 'price' || lowerKey === 'total' || lowerKey === 'fee') && typeof value === 'number') {
        return <span className="font-mono text-sm tabular-nums">{value.toLocaleString()}</span>;
      }

      // Address fields (hex strings longer than 30 chars)
      if (strVal.startsWith('0x') && strVal.length > 30) {
        return (
          <span className="font-mono text-xs" title={strVal}>
            {truncateAddress(strVal)}
          </span>
        );
      }

      // Boolean
      if (typeof value === 'boolean') {
        return (
          <Badge variant={value ? 'default' : 'outline'} className="text-xs">
            {value ? 'Yes' : 'No'}
          </Badge>
        );
      }

      // Object/Array
      if (typeof value === 'object') {
        return (
          <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }

      return strVal;
    },
    []
  );

  // Scroll event listener
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollTop(el.scrollTop > 200);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Flash cell auto-clear effect
  useEffect(() => {
    if (!flashCell) return;
    const timer = setTimeout(() => setFlashCell(null), 800);
    return () => clearTimeout(timer);
  }, [flashCell]);

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && page > 0) {
        e.preventDefault();
        setPage((p) => p - 1);
      } else if (e.key === 'ArrowRight' && hasMore) {
        e.preventDefault();
        setPage((p) => p + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, hasMore]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const showCardView = viewMode === 'card' && cardView;

  // Set of inline editable fields for quick lookup
  const inlineEditableSet = useMemo(
    () => new Set(inlineEditableFields || []),
    [inlineEditableFields]
  );

  // === Render Context Menu Content for a row ===
  const renderRowContextMenu = useCallback(
    (item: T) => (
      <ContextMenuContent className="w-52">
        {onView && (
          <ContextMenuItem onClick={() => onView(item)}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </ContextMenuItem>
        )}
        {onEdit && (
          <ContextMenuItem onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </ContextMenuItem>
        )}
        {onDelete && (
          <ContextMenuItem variant="destructive" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        )}
        {(onView || onEdit || onDelete) && <ContextMenuSeparator />}
        <ContextMenuItem onClick={() => handleCopyId(item)}>
          <Copy className="h-4 w-4 mr-2" />
          Copy ID
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCopyRowData(item)}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Copy Row Data
        </ContextMenuItem>
        {expandable && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => toggleExpand(item.id)}>
              <ChevronDown className={`h-4 w-4 mr-2 transition-transform duration-200 ${expandedRows.has(item.id) ? 'rotate-0' : '-rotate-90'}`} />
              {expandedRows.has(item.id) ? 'Collapse' : 'Expand'}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    ),
    [onView, onEdit, onDelete, expandable, expandedRows, handleCopyId, handleCopyRowData, toggleExpand]
  );

  // === Render Quick-View Field ===
  const renderQuickViewField = useCallback(
    (col: Column<T>, item: T) => {
      const rawVal = item[col.key];
      const strVal = rawVal != null ? String(rawVal) : '';
      const lowerKey = col.key.toLowerCase();

      if (col.render) return col.render(item);
      if (lowerKey === 'status' && strVal) return <StatusBadge status={strVal} />;
      if ((lowerKey === 'currency' || lowerKey === 'token') && strVal) return <CurrencyBadge currency={strVal} />;
      return strVal || '—';
    },
    []
  );

  return (
    <div className="space-y-4" ref={tableContainerRef}>
      {/* ===== Sticky Toolbar ===== */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-1 -mx-1 -mt-1 px-1 pt-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Status/General Filter Dropdown */}
            {mergedFilters.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 relative">
                    <Filter className={`h-4 w-4 ${activeFilters.size > 0 ? 'text-primary' : ''}`} />
                    {activeFilters.size > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                        {activeFilters.size}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Status Filters</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {mergedFilters.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.value}
                      checked={activeFilters.has(opt.value)}
                      onCheckedChange={() => toggleFilter(opt)}
                    >
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Active Filter Badges */}
            {activeFilterLabels.map((af) => (
              <Badge
                key={af.value}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => {
                  setActiveFilters((prev) => {
                    const next = new Set(prev);
                    next.delete(af.value);
                    return next;
                  });
                  setPage(0);
                }}
              >
                {af.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}

            {/* Column Visibility Toggle */}
            {visibleColumns.length > 3 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" title="Toggle columns">
                    <Columns3 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Columns</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {effectiveVisibleColumns.length}/{visibleColumns.length}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {visibleColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={!hiddenColumnKeys.has(col.key)}
                      onCheckedChange={() => toggleColumnVisibility(col.key)}
                      className="capitalize"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Date Range Picker */}
            {dateRangeKey && (
              <DateRangePicker onRangeChange={handleDateRangeChange} />
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-8"
              />
            </div>

            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>

            {/* Export Button */}
            {exportable && (
              <ExportButton
                data={items as unknown as Record<string, unknown>[]}
                columns={exportColumns}
                filename={exportFilename || entity}
              />
            )}

            {/* Card/Table View Toggle */}
            {cardView && (
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(val) => {
                  if (val) handleViewModeChange(val as 'table' | 'card');
                }}
                className="border"
              >
                <ToggleGroupItem value="table" aria-label="Table view" className="h-9 w-9 p-0">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="card" aria-label="Card view" className="h-9 w-9 p-0">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            {onCreate && (
              <Button onClick={onCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {createLabel}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Auto-Switch Indicator */}
        <AnimatePresence>
          {mobileAutoSwitched && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm mt-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Switched to card view for mobile</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    handleViewModeChange('table');
                    dismissMobileHint();
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions Toolbar */}
        <AnimatePresence>
          {selectable && selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-lg border bg-primary/5 px-4 py-2.5 mt-2">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={bulkStatusLoading}
                    className="h-8 gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  {/* Legacy bulk status change (statusFilters-based) */}
                  {showBulkStatusChange && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bulkStatusLoading}
                          className="h-8 gap-1.5"
                        >
                          {bulkStatusLoading ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          )}
                          Change Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusFilters!.map((sf) => (
                          <DropdownMenuItem
                            key={sf.value}
                            onClick={() => handleBulkStatusChange(sf.value)}
                            disabled={bulkStatusLoading}
                          >
                            {sf.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {/* Callback-based batch status change */}
                  {showCallbackBatchStatusChange && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Change Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions!.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => handleCallbackBatchStatusChange(opt.value)}
                          >
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {onBulkDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onBulkDelete(Array.from(selectedIds))}
                      disabled={bulkStatusLoading}
                      className="h-8 gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={bulkStatusLoading}
                    className="h-8"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== Card View ===== */}
      {showCardView ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`card-${dataKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Card count badge */}
            {items.length > 0 && !isLoading && !isError && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  Showing {items.length} of {hasMore ? `${page * limit + items.length}+` : page * limit + items.length}
                </Badge>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-card overflow-hidden">
                    <div className="h-[2px] bg-muted" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-5 w-3/4" style={{ animationDelay: `${i * 80}ms` }} />
                      <Skeleton className="h-4 w-full" style={{ animationDelay: `${i * 80 + 60}ms` }} />
                      <Skeleton className="h-4 w-2/3" style={{ animationDelay: `${i * 80 + 120}ms` }} />
                      <div className="flex gap-2 pt-2">
                        <Skeleton className="h-8 w-8" style={{ animationDelay: `${i * 80 + 180}ms` }} />
                        <Skeleton className="h-8 w-8" style={{ animationDelay: `${i * 80 + 200}ms` }} />
                      </div>
                    </div>
                  </div>
                ))
              ) : isError ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="font-medium text-destructive">Connection Error</p>
                  <p className="text-sm text-muted-foreground">
                    {apiErrorMessage || 'Unable to fetch data. Please check your API key and try again.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-1">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div className="col-span-full">
                  <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed bg-gradient-to-b from-muted/30 to-transparent">
                    <div className="relative mb-6">
                      <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_12s_linear_infinite]" />
                      <div className="absolute -inset-2 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
                      <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-muted to-muted/50 shadow-inner">
                        <Inbox className="h-9 w-9 text-muted-foreground/70" />
                      </div>
                    </div>
                    <div className="text-center max-w-sm">
                      {search ? (
                        <>
                          <p className="text-lg font-semibold text-foreground">No results for &lsquo;{search}&rsquo;</p>
                          <p className="text-sm text-muted-foreground mt-1.5">
                            No {displayLabel.toLowerCase()} match your search term. Try a different keyword.
                          </p>
                        </>
                      ) : activeFilters.size > 0 || dateRange ? (
                        <>
                          <p className="text-lg font-semibold text-foreground">No {displayLabel} match your filters</p>
                          <p className="text-sm text-muted-foreground mt-1.5">
                            Try removing some filters to see more results.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-semibold text-foreground">No {displayLabel} found</p>
                          <p className="text-sm text-muted-foreground mt-1.5">
                            Create a new {displayLabel.toLowerCase()} to get started, or adjust your search.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-5">
                      {(activeFilters.size > 0 || dateRange || search) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveFilters(new Set());
                            setDateRange(null);
                            setSearch('');
                            setPage(0);
                          }}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Clear all filters
                        </Button>
                      )}
                      {onCreate && (
                        <Button variant="outline" size="sm" onClick={onCreate}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          {createLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                items.map((item, index) => {
                  const firstCol = effectiveVisibleColumns[0];
                  const restCols = effectiveVisibleColumns.slice(1);
                  const gradientColor = cardGradientColors[index % cardGradientColors.length];
                  return (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className={`group rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                            selectedIds.has(item.id) ? 'ring-2 ring-primary/50 border-primary/30' : 'hover:border-primary/20'
                          }`}
                          onMouseMove={quickView ? handleRowMouseMove : undefined}
                          onMouseEnter={() => handleRowMouseEnter(item)}
                          onMouseLeave={handleRowMouseLeave}
                        >
                          <div className={`h-[2px] bg-gradient-to-r ${gradientColor}`} />
                          <div className="p-5">
                            {selectable && (
                              <div className="mb-3">
                                <Checkbox
                                  checked={selectedIds.has(item.id)}
                                  onCheckedChange={() => toggleSelectRow(item.id)}
                                />
                              </div>
                            )}
                            {firstCol && (
                              <div className="mb-3">
                                <h3 className="text-base font-semibold leading-tight">
                                  {firstCol.render
                                    ? firstCol.render(item)
                                    : String(item[firstCol.key] ?? '—')}
                                </h3>
                              </div>
                            )}
                            <div className="space-y-2">
                              {restCols.map((col) => {
                                const rawVal = item[col.key];
                                const strVal = rawVal != null ? String(rawVal) : '';
                                const targetPage = ENTITY_ID_FIELD_MAP[col.key];
                                const isEntityLink = !!targetPage && strVal.length > 0;
                                const rendered = col.render ? col.render(item) : isEntityLink ? (
                                  <button
                                    type="button"
                                    title={strVal}
                                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline hover:bg-primary/5 rounded px-1 py-0.5 transition-colors duration-150 cursor-pointer"
                                    onClick={() => {
                                      setSelectedEntityId(strVal);
                                      setCurrentPage(targetPage);
                                    }}
                                  >
                                    <span className="truncate">{strVal}</span>
                                  </button>
                                ) : String(rawVal ?? '—');
                                return (
                                  <div key={col.key} className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                                      {col.label}
                                    </span>
                                    <div className="text-right min-w-0">
                                      {rendered}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t">
                              {extraActions && extraActions(item)}
                              {onView && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity duration-200" onClick={() => onView(item)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {onEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity duration-200" onClick={() => onEdit(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity duration-200"
                                  onClick={() => onDelete(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </ContextMenuTrigger>
                      {renderRowContextMenu(item)}
                    </ContextMenu>
                  );
                })
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        /* ===== Table View ===== */
        <AnimatePresence mode="wait">
          <motion.div
            key={`table-${dataKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-lg border overflow-hidden relative"
          >
            <div className="overflow-x-auto scroll-smooth max-h-[calc(100vh-18rem)] overflow-y-auto">
              <Table>
                {/* ===== Sticky Table Header ===== */}
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <TableRow className="bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 hover:bg-gradient-to-r hover:from-muted/60 hover:via-muted/40 hover:to-muted/60 border-b after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border after:to-transparent">
                    {selectable && (
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              (el as unknown as HTMLInputElement).indeterminate = someSelected;
                            }
                          }}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                    )}
                    {expandable && (
                      <TableHead className="w-[40px]" />
                    )}
                    {/* Row Index Column */}
                    {showRowIndex && (
                      <TableHead className="w-[50px] pl-4 text-xs text-muted-foreground font-mono tabular-nums">#</TableHead>
                    )}
                    {effectiveVisibleColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        className={`whitespace-nowrap text-xs font-bold uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                        onClick={col.sortable ? () => handleSort(col) : undefined}
                      >
                        <span className="inline-flex items-center gap-1 border-b border-transparent hover:border-border/50 pb-0.5 transition-colors duration-200">
                          {col.label}
                          {col.sortable && (
                            <span className="text-muted-foreground/60">
                              {sortField === (col.sortKey || col.key) ? (
                                sortDir === 'desc' ? (
                                  <ArrowDown className="h-3 w-3" />
                                ) : (
                                  <ArrowUp className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-[70px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {selectable && (
                          <TableCell className="w-[40px] p-1 pl-4">
                            <Skeleton className="h-4 w-4" style={{ animationDelay: `${i * 60}ms` }} />
                          </TableCell>
                        )}
                        {expandable && (
                          <TableCell className="w-[40px] p-1">
                            <Skeleton className="h-5 w-5" style={{ animationDelay: `${i * 60 + 30}ms` }} />
                          </TableCell>
                        )}
                        {showRowIndex && (
                          <TableCell className="w-[50px] p-1 pl-4">
                            <Skeleton className="h-4 w-6" style={{ animationDelay: `${i * 60 + 20}ms` }} />
                          </TableCell>
                        )}
                        {effectiveVisibleColumns.map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton
                              className="h-4"
                              style={{
                                width: j === 0 ? '60%' : j === 1 ? '40%' : '70%',
                                animationDelay: `${i * 60 + j * 40}ms`,
                              }}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Skeleton className="h-8 w-16" style={{ animationDelay: `${i * 60 + 200}ms` }} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={totalColSpan} className="py-12">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-destructive">Connection Error</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {apiErrorMessage || 'Unable to fetch data. Please check your API key and try again.'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            className="mt-1"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={totalColSpan} className="py-12">
                        <div className="flex flex-col items-center justify-center py-8 px-6 rounded-2xl border border-dashed bg-gradient-to-b from-muted/30 to-transparent max-w-md mx-auto">
                          <div className="relative mb-5">
                            <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_12s_linear_infinite]" />
                            <div className="absolute -inset-2 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
                            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-muted to-muted/50 shadow-inner">
                              <Inbox className="h-9 w-9 text-muted-foreground/70" />
                            </div>
                          </div>
                          <div className="text-center max-w-sm">
                            {search ? (
                              <>
                                <p className="text-lg font-semibold text-foreground">No results for &lsquo;{search}&rsquo;</p>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  No {displayLabel.toLowerCase()} match your search term. Try a different keyword.
                                </p>
                              </>
                            ) : activeFilters.size > 0 || dateRange ? (
                              <>
                                <p className="text-lg font-semibold text-foreground">No {displayLabel} match your filters</p>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  Try removing some filters to see more results.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-lg font-semibold text-foreground">No {displayLabel} found</p>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  Create a new {displayLabel.toLowerCase()} to get started, or adjust your search.
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            {(activeFilters.size > 0 || dateRange || search) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActiveFilters(new Set());
                                  setDateRange(null);
                                  setSearch('');
                                  setPage(0);
                                }}
                                className="gap-1.5"
                              >
                                <X className="h-3.5 w-3.5" />
                                Clear all filters
                              </Button>
                            )}
                            {onCreate && (
                              <Button variant="outline" size="sm" onClick={onCreate}>
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                {createLabel}
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => {
                      const isExpanded = expandedRows.has(item.id);
                      const rowIndex = page * limit + idx + 1;
                      return (
                        <React.Fragment key={`${entity}-${item.id}-${page}`}>
                          {/* ===== Row with Context Menu ===== */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <TableRow
                                className={`group transition-all duration-200 ease-out hover:bg-muted/40 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] hover:scale-[1.002] border-l-2 ${
                                  isExpanded
                                    ? 'border-l-primary bg-muted/20'
                                    : 'border-l-transparent hover:border-l-primary'
                                } ${selectedIds.has(item.id) ? 'bg-primary/5' : ''} ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/15'}`}
                                onMouseMove={quickView ? handleRowMouseMove : undefined}
                                onMouseEnter={() => handleRowMouseEnter(item)}
                                onMouseLeave={handleRowMouseLeave}
                              >
                                {selectable && (
                                  <TableCell className="w-[40px] pl-4">
                                    <Checkbox
                                      checked={selectedIds.has(item.id)}
                                      onCheckedChange={() => toggleSelectRow(item.id)}
                                      aria-label="Select row"
                                    />
                                  </TableCell>
                                )}
                                {expandable && (
                                  <TableCell className="w-[40px] p-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => toggleExpand(item.id)}
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform duration-200 ${
                                          isExpanded ? 'rotate-0' : '-rotate-90'
                                        }`}
                                      />
                                    </Button>
                                  </TableCell>
                                )}
                                {/* Row Index Cell */}
                                {showRowIndex && (
                                  <TableCell className="w-[50px] pl-4 text-xs text-muted-foreground font-mono tabular-nums">
                                    {rowIndex}
                                  </TableCell>
                                )}
                                {effectiveVisibleColumns.map((col) => {
                                  const rawVal = item[col.key];
                                  const strVal = rawVal != null ? String(rawVal) : '';
                                  const targetPage = ENTITY_ID_FIELD_MAP[col.key];
                                  const isEntityLink = !!targetPage && strVal.length > 0;
                                  const isInlineEditable = inlineEditableSet.has(col.key) && !!onInlineEdit && !col.render;
                                  const isEditing = editingCell?.rowId === item.id && editingCell?.field === col.key;
                                  const isFlashing = flashCell?.rowId === item.id && flashCell?.field === col.key;
                                  const editOptions = col.statusOptions || statusOptions || [];

                                  return (
                                    <TableCell
                                      key={col.key}
                                      className={`whitespace-nowrap relative ${isInlineEditable ? 'cursor-pointer' : ''} ${isFlashing ? '[&_span]:animate-flash-green' : ''}`}
                                      onClick={isInlineEditable && !isEditing ? () => setEditingCell({ rowId: item.id, field: col.key }) : undefined}
                                    >
                                      {isInlineEditable && !isEditing ? (
                                        <span className="inline-flex items-center gap-1.5 group/edit border-b border-dashed border-transparent hover:border-muted-foreground/50 transition-colors duration-150">
                                          {isEntityLink ? (
                                            <button
                                              type="button"
                                              title={strVal}
                                              className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline hover:bg-primary/5 rounded px-1 py-0.5 transition-colors duration-150 cursor-pointer max-w-[180px]"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEntityId(strVal);
                                                setCurrentPage(targetPage);
                                              }}
                                            >
                                              <span className="truncate">{strVal}</span>
                                            </button>
                                          ) : (
                                            <span>{String(rawVal ?? '—')}</span>
                                          )}
                                          <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/edit:text-muted-foreground/60 transition-colors duration-150" />
                                        </span>
                                      ) : isInlineEditable && isEditing ? (
                                        <Popover open={isEditing} onOpenChange={(open) => { if (!open) setEditingCell(null); }}>
                                          <PopoverTrigger asChild>
                                            <span className="inline-flex items-center gap-1.5 border-b border-dashed border-primary/50">
                                              {String(rawVal ?? '—')}
                                              <Pencil className="h-3 w-3 text-primary/60" />
                                            </span>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-48 p-2" align="start">
                                            <div className="space-y-1">
                                              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Change {col.label}</p>
                                              <Select
                                                value={strVal}
                                                onValueChange={(val) => handleInlineEditChange(item.id, col.key, val)}
                                              >
                                                <SelectTrigger className="h-8 text-xs">
                                                  <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {editOptions.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                      {opt.label}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : col.render ? (
                                        col.render(item)
                                      ) : isEntityLink ? (
                                        <button
                                          type="button"
                                          title={strVal}
                                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline hover:bg-primary/5 rounded px-1 py-0.5 transition-colors duration-150 cursor-pointer max-w-[180px]"
                                          onClick={() => {
                                            setSelectedEntityId(strVal);
                                            setCurrentPage(targetPage);
                                          }}
                                        >
                                          <span className="truncate">{strVal}</span>
                                        </button>
                                      ) : (
                                        String(rawVal ?? '—')
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {extraActions && extraActions(item)}
                                    {onView && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity duration-200" onClick={() => onView(item)}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {onEdit && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity duration-200" onClick={() => onEdit(item)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {onDelete && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity duration-200"
                                        onClick={() => onDelete(item)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </ContextMenuTrigger>
                            {renderRowContextMenu(item)}
                          </ContextMenu>

                          {/* ===== Expandable detail row ===== */}
                          <AnimatePresence initial={false}>
                            {expandable && isExpanded && (
                              <TableRow className="bg-muted/20 hover:bg-muted/20 border-l-2 border-l-primary">
                                <TableCell colSpan={totalColSpan} className="p-0">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    {/* Gradient top border matching entity theme */}
                                    <div className={`h-[2px] bg-gradient-to-r ${entityGradient}`} />
                                    <div className="px-6 py-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                                        {Object.entries(item).map(([key, value]) => {
                                          if (key === 'id') return null;
                                          const targetPage = ENTITY_ID_FIELD_MAP[key];
                                          const isEntityLink = !!targetPage && typeof value === 'string' && value.trim().length > 0;
                                          const isStringCopyable = typeof value === 'string' && value.trim().length > 0 && value.length < 200;
                                          const fieldId = `${item.id}:${key}`;
                                          const isCopied = copiedFieldKey === fieldId;

                                          return (
                                            <div key={key} className="flex flex-col gap-0.5 group/field">
                                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                {key.replace(/_/g, ' ')}
                                              </span>
                                              <div className="flex items-start gap-1.5 min-w-0">
                                                {isEntityLink ? (
                                                  <button
                                                    type="button"
                                                    title={String(value)}
                                                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline hover:bg-primary/5 rounded px-1 py-0.5 transition-colors duration-150 cursor-pointer self-start"
                                                    onClick={() => {
                                                      setSelectedEntityId(String(value));
                                                      setCurrentPage(targetPage);
                                                    }}
                                                  >
                                                    <span className="truncate">{String(value)}</span>
                                                  </button>
                                                ) : (
                                                  <span className="text-sm break-all min-w-0">
                                                    {formatExpandedValue(key, value)}
                                                  </span>
                                                )}
                                                {isStringCopyable && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleCopyField(item.id, key, String(value))}
                                                    className="shrink-0 mt-0.5 opacity-0 group-hover/field:opacity-100 transition-opacity duration-150 p-0.5 rounded hover:bg-muted"
                                                    title="Copy value"
                                                  >
                                                    {isCopied ? (
                                                      <Check className="h-3 w-3 text-emerald-500" />
                                                    ) : (
                                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </motion.div>
                                </TableCell>
                              </TableRow>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ===== Quick-View Popover ===== */}
      <AnimatePresence>
        {quickViewItem && quickView && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 w-[280px] rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5"
            style={{
              left: quickViewAdjustedPos.x,
              top: quickViewAdjustedPos.y,
              pointerEvents: 'none',
            }}
            onMouseEnter={() => {
              // Keep popover when mouse enters it
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            }}
            onMouseLeave={() => {
              setQuickViewItem(null);
            }}
          >
            {/* Mini preview of key fields */}
            <div className="px-4 py-3 space-y-2.5">
              {quickViewFields.map((col) => {
                const rawVal = quickViewItem[col.key];
                const strVal = rawVal != null ? String(rawVal) : '';
                const isStatusCol = col.key.toLowerCase() === 'status';
                const isCurrencyCol = col.key.toLowerCase() === 'currency' || col.key.toLowerCase() === 'token';

                return (
                  <div key={col.key} className="flex items-start justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground shrink-0 pt-px">
                      {col.label}
                    </span>
                    <span className="text-sm font-medium text-right min-w-0 truncate">
                      {col.render
                        ? col.render(quickViewItem)
                        : isStatusCol && strVal
                          ? <StatusBadge status={strVal} />
                          : isCurrencyCol && strVal
                            ? <CurrencyBadge currency={strVal} />
                            : strVal || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Footer link */}
            {onView && (
              <div className="border-t px-4 py-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    setQuickViewItem(null);
                    onView(quickViewItem);
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  Click to view full details
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Pagination ===== */}
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">{page * limit + 1}</span>
            {' '}to{' '}
            <span className="font-medium text-foreground">{page * limit + items.length}</span>
            {hasMore && (
              <>
                {' '}·{' '}
                <span className="text-muted-foreground/60">more available</span>
              </>
            )}
          </p>
          <span className="text-sm text-muted-foreground/70">
            Page {page + 1} of ~{estimatedTotalPages}
          </span>
          <span className="hidden sm:inline-flex text-xs text-muted-foreground/50 items-center gap-1">
            <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-0.5 text-[10px] font-mono">←</kbd>
            <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-0.5 text-[10px] font-mono">→</kbd>
            {' '}to navigate
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            {page + 1}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l">
            <label htmlFor="goto-page" className="text-xs text-muted-foreground whitespace-nowrap">
              Go to
            </label>
            <Input
              id="goto-page"
              type="number"
              min={1}
              value={goToPage}
              onChange={(e) => setGoToPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGoToPage();
              }}
              className="h-7 w-14 text-xs text-center focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all duration-200"
              placeholder="#"
            />
          </div>
        </div>
        <AnimatePresence>
          {showScrollTop && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="absolute -top-10 right-0"
            >
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-sm"
                onClick={() => {
                  tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== CSS Animations ===== */}
      <style>{`
        @keyframes flashGreen {
          0% { background-color: rgba(34, 197, 94, 0.3); }
          100% { background-color: transparent; }
        }
        .animate-flash-green {
          animation: flashGreen 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
