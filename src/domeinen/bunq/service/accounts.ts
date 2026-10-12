import type { HttpClient } from '@/shared/api/http-client';
import type { Logger } from '@/shared/logging/logger';
import { listMonetaryAccounts } from '../api/bunq-api';
import type { MonetaryAccount } from '../domain/accounts';
import type { BunqConnectionService } from './bunq-connection';

/** TanStack Query keys of this domain. Everything under `bunq` goes when the connection ends. */
export const BUNQ_QUERY_KEY = ['bunq'] as const;
export const BUNQ_ACCOUNTS_QUERY_KEY = [...BUNQ_QUERY_KEY, 'accounts'] as const;

export type AccountsReader = {
  /** All accounts of the connected user, with their current balance. */
  list(): Promise<MonetaryAccount[]>;
};

export function createAccountsReader(deps: {
  connection: BunqConnectionService;
  http: HttpClient;
  logger?: Logger;
}): AccountsReader {
  return {
    list: () =>
      deps.connection.withSession((session) =>
        listMonetaryAccounts(deps.http, session, deps.logger),
      ),
  };
}
