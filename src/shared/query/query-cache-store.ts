import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import type { KeyValueStore } from '@/shared/platform/ports';

/** Successful queries only. Mutations and errors do not belong in the offline cache. */
export const QUERY_CACHE_KEY = 'query.cache';

function isDehydratedState(value: unknown): value is DehydratedState {
  return typeof value === 'object' && value !== null && 'queries' in value;
}

export async function saveQueryCache(client: QueryClient, store: KeyValueStore): Promise<void> {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  });
  await store.setItem(QUERY_CACHE_KEY, JSON.stringify(state));
}

export async function loadQueryCache(client: QueryClient, store: KeyValueStore): Promise<void> {
  const raw = await store.getItem(QUERY_CACHE_KEY);
  if (raw === null || raw === '') {
    return;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDehydratedState(parsed)) {
      throw new Error('Query cache is not a dehydrated state');
    }
    hydrate(client, parsed);
  } catch {
    await store.removeItem(QUERY_CACHE_KEY);
  }
}

export async function clearQueryCache(store: KeyValueStore): Promise<void> {
  await store.removeItem(QUERY_CACHE_KEY);
}
