import Storage from 'expo-sqlite/kv-store';
import type { KeyValueStore } from '../ports';

/**
 * Plain (non-secret) device storage, backed by SQLite. The device adapter of the `KeyValueStore`
 * port. Unlike `SecretStore` there is no size limit worth chunking for: this is for preferences and
 * cached reference data, not tokens (docs/decisions/0006-opslag.md).
 */
export function createDeviceKeyValueStore(): KeyValueStore {
  return {
    getItem: (key) => Storage.getItem(key),
    setItem: (key, value) => Storage.setItem(key, value),
    removeItem: (key) => Storage.removeItem(key),
  };
}
