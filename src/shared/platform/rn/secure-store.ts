import * as SecureStore from 'expo-secure-store';
import { createChunkedSecretStore } from '../chunked-store';
import type { SecretStore } from '../ports';

/**
 * Keychain (iOS) / Keystore (Android) storage. The device adapter of the `SecretStore` port.
 * Values are spread over several entries because of the size limit of secure storage.
 * Keys may only contain letters, digits, `.`, `-` and `_`.
 */
export function createDeviceSecretStore(): SecretStore {
  return createChunkedSecretStore({
    secure: true,
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  });
}
