import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  BunqConnectionEvent,
  BunqConnectionService,
  BunqConnectionStatus,
  DisconnectReason,
} from '../service/bunq-connection';

/**
 * What the UI needs to know about bunq: is there a connection, why did it end, and which account
 * the budget is about. NEVER the API key or tokens; those stay inside the connection service.
 */
export type BunqState = {
  status: BunqConnectionStatus;
  /** Set when the connection ended, so a screen can explain why. */
  disconnectedReason: DisconnectReason | null;
  selectedAccountId: number | null;
};

export type BunqStore = StoreApi<BunqState>;

export function createBunqStore(): BunqStore {
  return createStore<BunqState>()(() => ({
    status: 'unknown',
    disconnectedReason: null,
    selectedAccountId: null,
  }));
}

/** Copies the events of the connection into the store. Returns the unsubscribe function. */
export function bindBunqStore(connection: BunqConnectionService, store: BunqStore): () => void {
  const apply = (event: BunqConnectionEvent): void => {
    switch (event.type) {
      case 'restored':
        store.setState({ status: event.connected ? 'connected' : 'disconnected' });
        break;
      case 'connected':
        store.setState({ status: 'connected', disconnectedReason: null });
        break;
      case 'disconnected':
        store.setState({ status: 'disconnected', disconnectedReason: event.reason });
        break;
    }
  };

  // The connection may have been restored before we subscribed.
  store.setState({ status: connection.getStatus() });
  return connection.subscribe(apply);
}
