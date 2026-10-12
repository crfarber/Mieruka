import type { SecretStore } from './ports';

/**
 * Secure storage (Keychain / Keystore) has a small value size limit: Expo SecureStore advises 2048
 * bytes, and an Azure AD access token alone can be larger. This wrapper spreads one value over
 * several entries. `key` holds the number of chunks; `key.0`, `key.1`, ... hold the pieces.
 */
export function createChunkedSecretStore(inner: SecretStore, chunkSize = 1800): SecretStore {
  const chunkKey = (key: string, index: number) => `${key}.${index}`;

  async function removeChunks(key: string): Promise<void> {
    const count = Number.parseInt((await inner.getItem(key)) ?? '', 10);
    if (Number.isFinite(count)) {
      for (let index = 0; index < count; index += 1) {
        await inner.removeItem(chunkKey(key, index));
      }
    }
  }

  return {
    secure: true,

    async getItem(key) {
      const count = Number.parseInt((await inner.getItem(key)) ?? '', 10);
      if (!Number.isFinite(count) || count < 0) {
        return null;
      }
      let value = '';
      for (let index = 0; index < count; index += 1) {
        const chunk = await inner.getItem(chunkKey(key, index));
        if (chunk === null) {
          return null; // a piece is missing: the value is unusable, treat it as absent
        }
        value += chunk;
      }
      return value;
    },

    async setItem(key, value) {
      await removeChunks(key);
      const chunks: string[] = [];
      for (let start = 0; start < value.length; start += chunkSize) {
        chunks.push(value.slice(start, start + chunkSize));
      }
      // Pieces first, the count last: a value only becomes visible once it is complete.
      for (const [index, chunk] of chunks.entries()) {
        await inner.setItem(chunkKey(key, index), chunk);
      }
      await inner.setItem(key, String(chunks.length));
    },

    async removeItem(key) {
      await removeChunks(key);
      await inner.removeItem(key);
    },
  };
}
