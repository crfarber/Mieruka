import type { Logger } from '@/shared/logging/logger';
import type { KeyValueStore } from '@/shared/platform/ports';

export const ACCOUNT_CHOICE_KEY = 'bunq.account';

/**
 * Which account the budget is about. Not a secret, so plain storage; but it belongs to the user,
 * so it goes when they disconnect or sign out.
 */
export type AccountChoice = {
  /** Applies the remembered choice, if any. Call once at start. */
  restore(): Promise<void>;
  choose(accountId: number): Promise<void>;
  forget(): Promise<void>;
};

export type AccountChoiceDeps = {
  store: KeyValueStore;
  /** Shows the choice in the UI (the bunq store). */
  apply: (accountId: number | null) => void;
  logger?: Logger;
};

export function createAccountChoice(deps: AccountChoiceDeps): AccountChoice {
  const { store, apply, logger } = deps;

  return {
    async restore() {
      let stored: string | null;
      try {
        stored = await store.getItem(ACCOUNT_CHOICE_KEY);
      } catch (error) {
        logger?.warn('bunq', 'Could not read the chosen account', { error });
        return;
      }
      const accountId = Number(stored);
      if (stored !== null && Number.isSafeInteger(accountId) && accountId > 0) {
        apply(accountId);
      }
    },

    async choose(accountId) {
      apply(accountId);
      try {
        await store.setItem(ACCOUNT_CHOICE_KEY, String(accountId));
      } catch (error) {
        // The choice still holds until the app restarts.
        logger?.warn('bunq', 'Could not save the chosen account', { error });
      }
    },

    async forget() {
      apply(null);
      await store.removeItem(ACCOUNT_CHOICE_KEY);
    },
  };
}
