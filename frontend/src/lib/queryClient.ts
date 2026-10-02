import { QueryClient } from '@tanstack/react-query';

/**
 * Factory to create a configured QueryClient instance.
 * Useful for SSR, testing suites, or isolated instances.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes default
        gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Client-side singleton instance to prevent duplicate clients or memory leaks
let clientQueryClientSingleton: QueryClient | undefined = undefined;

/**
 * Retrieve the singleton QueryClient in the browser, or create a fresh one during SSR / test.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server-side rendering (SSR): always return a new query client per request
    return createQueryClient();
  }
  // Browser (CSR): create singleton once and reuse
  if (!clientQueryClientSingleton) {
    clientQueryClientSingleton = createQueryClient();
  }
  return clientQueryClientSingleton;
}

export const queryClient = getQueryClient();
