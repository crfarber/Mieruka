import { QueryCache, QueryClient } from '@tanstack/react-query';
import { AuthExpiredError, isRetryable } from '@/shared/api/errors';
import type { Logger } from '@/shared/logging/logger';

/** Up to three tries in total for a request that failed for a temporary reason. */
export const MAX_QUERY_ATTEMPTS = 3;

/** Retry only what could succeed the next time. A 404 or a broken payload will not. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof AuthExpiredError) {
    return false;
  }
  return failureCount < MAX_QUERY_ATTEMPTS - 1 && isRetryable(error);
}

/** Pause before retry number `failureCount` (counting from 0): 1 s, 2 s, 4 s, never more than 10 s. */
export function queryRetryDelay(failureCount: number): number {
  return Math.min(1_000 * 2 ** failureCount, 10_000);
}

export function createQueryClient(logger?: Logger): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger?.warn('sync', 'Query failed', { key: query.queryKey, error });
      },
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        staleTime: 30_000,
        // Data must survive a screen closing, and a long enough time offline.
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
