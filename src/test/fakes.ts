import type { Clock, KeyValueStore, SecretStore, Sleep } from '@/shared/platform/ports';

export type FakeClock = Clock & { advance(ms: number): void; set(value: number): void };

export function createFakeClock(start = Date.UTC(2026, 8, 21, 12, 0, 0)): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (value) => {
      current = value;
    },
  };
}

export type InMemoryStore = KeyValueStore & { dump(): Record<string, string> };

export function createInMemoryStore(initial: Record<string, string> = {}): InMemoryStore {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}

export function createInMemorySecretStore(
  initial: Record<string, string> = {},
): SecretStore & { dump(): Record<string, string> } {
  return { ...createInMemoryStore(initial), secure: true };
}

/** A sleep that resolves immediately and records the requested delays. */
export function createRecordingSleep(): { sleep: Sleep; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms) => {
      delays.push(ms);
    },
  };
}

export function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function problemResponse(status: number, problem: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ status, ...problem }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

/** Lets promise chains that are already resolvable run to completion. */
export const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

export type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

/** A promise that the test settles by hand, to control the order in which things finish. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export type FakeTimer = {
  callback: () => void;
  delayMs: number;
  cancelled: boolean;
  fired: boolean;
};

/** A timer port that only fires when the test says so. */
export function createFakeScheduler() {
  const timers: FakeTimer[] = [];
  const pending = () => timers.filter((timer) => !timer.cancelled && !timer.fired);

  return {
    timers,
    pending,
    schedule(callback: () => void, delayMs: number): () => void {
      const timer: FakeTimer = { callback, delayMs, cancelled: false, fired: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    /** Fires the oldest timer that is still waiting and lets the work it starts finish. */
    async fireNext(): Promise<void> {
      const timer = pending()[0];
      if (!timer) {
        throw new Error('No timer is waiting');
      }
      timer.fired = true;
      timer.callback();
      await flushPromises();
    },
  };
}
