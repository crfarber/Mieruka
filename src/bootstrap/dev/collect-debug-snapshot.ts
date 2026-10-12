import type { QueryClient } from '@tanstack/react-query';
import {
  SESSION_KEY,
  type AuthMethod,
  type SessionState,
  type SessionStatus,
  type TokenProvider,
} from '@/domeinen/auth';
import { LANGUAGE_KEY } from '@/domeinen/settings';
import type { KeyValueStore, SecretStore } from '@/shared/platform/ports';

/** Keys that persist something. expo-secure-store has no getAllKeys, so the list is explicit. */
const STORAGE_KEYS = [SESSION_KEY, LANGUAGE_KEY] as const;

/** Cap query `data` so a large list does not freeze the debug screen. */
const MAX_QUERY_DATA_CHARS = 8_000;

export type DebugQueryEntry = {
  queryKey: readonly unknown[];
  status: string;
  dataUpdatedAt: number;
  data: unknown;
};

export type DebugSnapshot = {
  storage: Record<string, unknown>;
  sessionStore: SessionState;
  tokenProvider: {
    status: SessionStatus;
    method: AuthMethod | null;
    expiresAt: number | null;
  };
  queryCache: DebugQueryEntry[];
};

export type CollectDebugSnapshotInput = {
  secretStore: SecretStore;
  keyValueStore: KeyValueStore;
  sessionStore: { getState(): SessionState };
  tokenProvider: Pick<TokenProvider, 'getStatus' | 'getMethod' | 'getExpiresAt'>;
  queryClient: QueryClient;
};

function parseStoredValue(raw: string | null): unknown {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function truncateQueryData(data: unknown): unknown {
  if (data === undefined) {
    return undefined;
  }
  const serialized = JSON.stringify(data);
  if (serialized === undefined) {
    return data;
  }
  if (serialized.length <= MAX_QUERY_DATA_CHARS) {
    return data;
  }
  return {
    truncated: true,
    length: serialized.length,
    preview: `${serialized.slice(0, MAX_QUERY_DATA_CHARS)}…`,
  };
}

/**
 * Gathers storage, session UI state and the query cache for the __DEV__ debug screen.
 * Reads tokens from disk only — never calls getAccessToken (that would refresh).
 */
export async function collectDebugSnapshot(
  input: CollectDebugSnapshotInput,
): Promise<DebugSnapshot> {
  const storage: Record<string, unknown> = {};
  for (const key of STORAGE_KEYS) {
    // The session lives in the SecretStore; preferences in the KeyValueStore (ADR 0006).
    const raw =
      key === SESSION_KEY
        ? await input.secretStore.getItem(key)
        : await input.keyValueStore.getItem(key);
    storage[key] = parseStoredValue(raw);
  }

  return {
    storage,
    sessionStore: input.sessionStore.getState(),
    tokenProvider: {
      status: input.tokenProvider.getStatus(),
      method: input.tokenProvider.getMethod(),
      expiresAt: input.tokenProvider.getExpiresAt(),
    },
    queryCache: input.queryClient
      .getQueryCache()
      .getAll()
      .map((query) => ({
        queryKey: query.queryKey,
        status: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        data: truncateQueryData(query.state.data),
      })),
  };
}
