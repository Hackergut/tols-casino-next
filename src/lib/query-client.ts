import { QueryClient } from "@tanstack/react-query";

/**
 * Shared React Query client configuration.
 * Singleton pattern ensures one client per browser tab / SSR request.
 *
 * Defaults:
 * - staleTime: 30s — avoids refetching on every mount for frequently-visited pages.
 * - gcTime: 5 min — keeps cached data available for back-navigations.
 * - retry: 1 — single retry on transient network failures (won't hammer the server).
 * - refetchOnWindowFocus: true — silently updates stale data when the user tabs back.
 */

let browserClient: QueryClient | undefined;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Returns the singleton QueryClient.
 * On the server (SSR) a new client is created per request.
 * On the client the same instance is reused across renders.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always make a new QueryClient
    return makeQueryClient();
  }
  // Browser: reuse the same client
  if (!browserClient) {
    browserClient = makeQueryClient();
  }
  return browserClient;
}
