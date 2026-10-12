import type { SecretStore } from '@/shared/platform/ports';
import { parseStoredConnection, type BunqConnection } from '../domain/connection';

export const CONNECTION_KEY = 'bunq.connection';

export type ConnectionRepository = {
  /** The stored connection, or null when there is none or it is damaged. */
  load(): Promise<BunqConnection | null>;
  save(connection: BunqConnection): Promise<void>;
  clear(): Promise<void>;
};

/** Keeps the connection in secure storage, as one JSON value. The API key never goes anywhere else. */
export function createConnectionRepository(store: SecretStore): ConnectionRepository {
  return {
    async load() {
      const connection = parseStoredConnection(await store.getItem(CONNECTION_KEY));
      if (connection === null) {
        // Damaged or incomplete data is worse than none: remove it so it cannot cause trouble again.
        await store.removeItem(CONNECTION_KEY);
      }
      return connection;
    },

    async save(connection) {
      await store.setItem(CONNECTION_KEY, JSON.stringify(connection));
    },

    async clear() {
      await store.removeItem(CONNECTION_KEY);
    },
  };
}
