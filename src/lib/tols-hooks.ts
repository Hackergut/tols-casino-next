import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENTITY_MAP, type QueryParams, type ApiResponse } from '@/types/tols';
import { useAdminStore } from '@/stores/admin';
import { logAction } from '@/lib/action-logger';
import { toast } from 'sonner';

// --- API Timing Tracking ---
export interface ApiTimingEntry {
  entity: string;
  duration: number;
  status: number;
  timestamp: number;
}

const MAX_TIMINGS = 50;
const apiTimings: ApiTimingEntry[] = [];
const timingListeners = new Set<() => void>();

export function getApiTimings(): ApiTimingEntry[] {
  return apiTimings.slice();
}

export function clearApiTimings(): void {
  apiTimings.length = 0;
  timingListeners.forEach((fn) => fn());
}

export function subscribeToTimings(fn: () => void): () => void {
  timingListeners.add(fn);
  return () => { timingListeners.delete(fn); };
}

function recordTiming(entity: string, duration: number, status: number): void {
  apiTimings.push({ entity, duration, status, timestamp: Date.now() });
  if (apiTimings.length > MAX_TIMINGS) apiTimings.splice(0, apiTimings.length - MAX_TIMINGS);
  timingListeners.forEach((fn) => fn());
}

// --- Build search params with both keys ---
function buildSearchParams(path: string, apiKey: string, appKey: string, params?: QueryParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set('path', path);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.skip) searchParams.set('skip', String(params.skip));
  if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params?.q) searchParams.set('q', params.q);
  if (apiKey) searchParams.set('api_key', apiKey);
  if (appKey) searchParams.set('app_key', appKey);
  return searchParams;
}

// --- Hooks ---

export function useTolsQuery<T>(entity: string, params?: QueryParams) {
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useQuery<ApiResponse<T[]>>({
    queryKey: [entity, params],
    queryFn: async () => {
      const start = performance.now();
      const path = ENTITY_MAP[entity] || `/entities/${entity}`;
      const searchParams = buildSearchParams(path, apiKey, appKey, params);

      const res = await fetch(`/api/tols?${searchParams.toString()}`);
      const duration = Math.round(performance.now() - start);
      recordTiming(entity, duration, res.status);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || errBody?.body || `API Error: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!apiKey,
    staleTime: 30000,
  });
}

export function useTolsGet<T>(entity: string, id: string | null) {
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useQuery<ApiResponse<T>>({
    queryKey: [entity, id],
    queryFn: async () => {
      const start = performance.now();
      const path = `${ENTITY_MAP[entity] || `/entities/${entity}`}/${id}`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`);
      const duration = Math.round(performance.now() - start);
      recordTiming(entity, duration, res.status);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || errBody?.body || `API Error: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!id && !!apiKey,
  });
}

export function useTolsCreate<T extends { id?: string }>(entity: string) {
  const queryClient = useQueryClient();
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useMutation<ApiResponse<T>, Error, Record<string, unknown>>({
    mutationFn: async (body) => {
      const start = performance.now();
      const path = ENTITY_MAP[entity] || `/entities/${entity}`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();
      recordTiming(entity, duration, res.status);
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success('Created successfully');
      const entityId = data?.data?.id;
      logAction({ action: 'create', entity, entityId: entityId ?? undefined, status: 'success' });
    },
    onError: (err) => {
      toast.error(err.message);
      logAction({ action: 'create', entity, details: `Failed to create ${entity}: ${err.message}`, status: 'error' });
    },
  });
}

export function useTolsUpdate<T>(entity: string, id: string) {
  const queryClient = useQueryClient();
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useMutation<ApiResponse<T>, Error, Record<string, unknown>>({
    mutationFn: async (body) => {
      const start = performance.now();
      const path = `${ENTITY_MAP[entity] || `/entities/${entity}`}/${id}`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();
      recordTiming(entity, duration, res.status);
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success('Updated successfully');
      logAction({ action: 'update', entity, entityId: id, status: 'success' });
    },
    onError: (err) => {
      toast.error(err.message);
      logAction({ action: 'update', entity, entityId: id, details: `Failed to update ${entity}: ${err.message}`, status: 'error' });
    },
  });
}

export function useTolsDelete(entity: string) {
  const queryClient = useQueryClient();
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (id) => {
      const start = performance.now();
      const path = `${ENTITY_MAP[entity] || `/entities/${entity}`}/${id}`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`, {
        method: 'DELETE',
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();
      recordTiming(entity, duration, res.status);
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success('Deleted successfully');
      logAction({ action: 'delete', entity, entityId: id, status: 'success' });
    },
    onError: (err, id) => {
      toast.error(err.message);
      logAction({ action: 'delete', entity, entityId: id, details: `Failed to delete ${entity}: ${err.message}`, status: 'error' });
    },
  });
}

// --- Bulk Operations ---

export function useTolsBulkCreate<T extends { id?: string }>(entity: string) {
  const queryClient = useQueryClient();
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useMutation<ApiResponse<T[]>, Error, Record<string, unknown>[]>({
    mutationFn: async (items) => {
      const start = performance.now();
      const path = `${ENTITY_MAP[entity] || `/entities/${entity}`}/bulk`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();
      recordTiming(entity + '_bulk', duration, res.status);
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success('Bulk create successful');
      logAction({ action: 'create', entity: entity + ' (bulk)', status: 'success' });
    },
    onError: (err) => {
      toast.error(err.message);
      logAction({ action: 'create', entity: entity + ' (bulk)', details: `Bulk create failed: ${err.message}`, status: 'error' });
    },
  });
}

export function useTolsBulkUpdate<T>(entity: string) {
  const queryClient = useQueryClient();
  const apiKey = useAdminStore((s) => s.apiKey);
  const appKey = useAdminStore((s) => s.appKey);

  return useMutation<ApiResponse<T[]>, Error, Record<string, unknown>[]>({
    mutationFn: async (items) => {
      const start = performance.now();
      const path = `${ENTITY_MAP[entity] || `/entities/${entity}`}/bulk`;
      const searchParams = buildSearchParams(path, apiKey, appKey);

      const res = await fetch(`/api/tols?${searchParams.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();
      recordTiming(entity + '_bulk', duration, res.status);
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success('Bulk update successful');
      logAction({ action: 'update', entity: entity + ' (bulk)', status: 'success' });
    },
    onError: (err) => {
      toast.error(err.message);
      logAction({ action: 'update', entity: entity + ' (bulk)', details: `Bulk update failed: ${err.message}`, status: 'error' });
    },
  });
}

