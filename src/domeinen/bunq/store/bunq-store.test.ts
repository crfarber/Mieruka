import { describe, expect, it } from 'vitest';
import type { BunqConnectionEvent, BunqConnectionService } from '../service/bunq-connection';
import { bindBunqStore, createBunqStore } from './bunq-store';

function fakeConnection(status: 'unknown' | 'connected' | 'disconnected') {
  let listener: ((event: BunqConnectionEvent) => void) | null = null;
  const connection: BunqConnectionService = {
    restore: async () => undefined,
    connect: async () => ({ ok: true, value: undefined }),
    disconnect: async () => undefined,
    withSession: () => Promise.reject(new Error('not used')),
    getStatus: () => status,
    subscribe(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  return { connection, emit: (event: BunqConnectionEvent) => listener?.(event) };
}

describe('bunq store', () => {
  it('starts with what the connection already knows', () => {
    const store = createBunqStore();

    bindBunqStore(fakeConnection('connected').connection, store);

    expect(store.getState().status).toBe('connected');
  });

  it('follows the connection and remembers why it ended', () => {
    const store = createBunqStore();
    const { connection, emit } = fakeConnection('unknown');
    bindBunqStore(connection, store);

    emit({ type: 'restored', connected: false });
    expect(store.getState().status).toBe('disconnected');

    emit({ type: 'restored', connected: true });
    emit({ type: 'disconnected', reason: 'refused' });
    expect(store.getState()).toMatchObject({
      status: 'disconnected',
      disconnectedReason: 'refused',
    });

    emit({ type: 'connected' });
    expect(store.getState()).toMatchObject({ status: 'connected', disconnectedReason: null });
  });

  it('keeps the chosen account when the connection changes', () => {
    const store = createBunqStore();
    const { connection, emit } = fakeConnection('connected');
    bindBunqStore(connection, store);
    store.setState({ selectedAccountId: 11 });

    emit({ type: 'connected' });

    expect(store.getState().selectedAccountId).toBe(11);
  });

  it('stops following after unbinding', () => {
    const store = createBunqStore();
    const { connection, emit } = fakeConnection('connected');
    const unbind = bindBunqStore(connection, store);

    unbind();
    emit({ type: 'disconnected', reason: 'user' });

    expect(store.getState().status).toBe('connected');
  });
});
