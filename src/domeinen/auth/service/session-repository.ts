import type { SecretStore } from '@/shared/platform/ports';
import { parseStoredSession, type Session } from '../domain/session';

export const SESSION_KEY = 'auth.session';

export type SessionRepository = {
  /** The stored session, or null when there is none or it is damaged. */
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
};

/** Persists the session in secure storage, as one JSON value. Tokens never go anywhere else. */
export function createSessionRepository(store: SecretStore): SessionRepository {
  return {
    async load() {
      const session = parseStoredSession(await store.getItem(SESSION_KEY));
      if (session === null) {
        // Damaged or incomplete data is worse than none: remove it so it cannot cause trouble again.
        await store.removeItem(SESSION_KEY);
      }
      return session;
    },

    async save(session) {
      await store.setItem(SESSION_KEY, JSON.stringify(session));
    },

    async clear() {
      await store.removeItem(SESSION_KEY);
    },
  };
}
