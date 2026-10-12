import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { MonetaryAccount } from '../domain/accounts';
import type { AccountChoice } from '../service/account-choice';
import { BUNQ_ACCOUNTS_QUERY_KEY, type AccountsReader } from '../service/accounts';
import type { BunqConnectionService } from '../service/bunq-connection';
import type { BunqState, BunqStore } from '../store/bunq-store';

export type BunqContextValue = {
  connection: BunqConnectionService;
  accounts: AccountsReader;
  accountChoice: AccountChoice;
  store: BunqStore;
};

const BunqContext = createContext<BunqContextValue | null>(null);

/** Supplied by `bootstrap/providers.tsx`. The domain never creates its own dependencies. */
export function BunqProvider({
  value,
  children,
}: {
  value: BunqContextValue;
  children: ReactNode;
}) {
  return <BunqContext.Provider value={value}>{children}</BunqContext.Provider>;
}

function useBunqContext(): BunqContextValue {
  const value = useContext(BunqContext);
  if (value === null) {
    throw new Error('useBunq must be used inside <BunqProvider>');
  }
  return value;
}

export const useBunqConnection = (): BunqConnectionService => useBunqContext().connection;

export const useAccountChoice = (): AccountChoice => useBunqContext().accountChoice;

/** Reads a part of the bunq state. Never contains the API key or tokens. */
export function useBunq<T>(selector: (state: BunqState) => T): T {
  return useStore(useBunqContext().store, selector);
}

/** All accounts with their balance. Waits until there is a connection. */
export function useMonetaryAccounts(): UseQueryResult<MonetaryAccount[]> {
  const { accounts, store } = useBunqContext();
  const connected = useStore(store, (state) => state.status === 'connected');
  return useQuery({
    queryKey: BUNQ_ACCOUNTS_QUERY_KEY,
    queryFn: () => accounts.list(),
    enabled: connected,
  });
}
