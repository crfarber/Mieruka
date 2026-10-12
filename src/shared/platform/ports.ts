/**
 * Ports: the only way domain and service code touches the outside world.
 * Production adapters live in `platform/rn/` and are wired in `src/bootstrap/`.
 * Tests use the fakes in `src/test/fakes.ts`.
 */

export type Clock = { now(): number };

export const systemClock: Clock = { now: () => Date.now() };

export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Timer port. `schedule` returns a function that cancels the timer. */
export type Scheduler = {
  schedule(callback: () => void, delayMs: number): () => void;
};

export type HapticTone = 'success' | 'warning' | 'error';

/** Short vibration on success, warning or error. A noop on devices without haptics. */
export type Haptics = {
  notify(tone: HapticTone): void;
};

export const noopHaptics: Haptics = {
  notify() {
    // No vibration in tests or when the device adapter is not wired.
  },
};

/** Asynchronous string key-value storage. */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Same shape, but backed by Keychain/Keystore. A separate type so the two cannot be swapped by accident. */
export type SecretStore = KeyValueStore & { readonly secure: true };

export type MultipartUploadFile = {
  appendTo(body: FormData, fieldName: string): void;
  remove(): Promise<void>;
};

export type MultipartUploadFiles = {
  prepare(
    bytes: Uint8Array,
    metadata: { name: string; type: string },
  ): Promise<MultipartUploadFile>;
};
