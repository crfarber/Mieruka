import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Haptics, HapticTone, Scheduler } from '@/shared/platform/ports';

export type ToastTone = HapticTone | 'info';

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

export type ToastState = {
  current: Toast | null;
};

export type ToastQueue = {
  store: StoreApi<ToastState>;
  show(input: { tone: ToastTone; message: string }): void;
  dismiss(): void;
};

export type ToastQueueDeps = {
  scheduler: Scheduler;
  haptics: Haptics;
  /** How long a toast stays visible. Default 3 s. */
  durationMs?: number;
};

const HAPTIC_TONES: ReadonlySet<HapticTone> = new Set(['success', 'warning', 'error']);

/**
 * One toast at a time. A new show replaces the previous; an identical message while that toast
 * is still visible is ignored (no flicker, no double haptic). Auto-dismiss via the Scheduler
 * so tests can drive the clock.
 */
export function createToastQueue(deps: ToastQueueDeps): ToastQueue {
  const { scheduler, haptics } = deps;
  const durationMs = deps.durationMs ?? 3000;
  const store = createStore<ToastState>()(() => ({ current: null }));

  let nextId = 1;
  let cancelDismiss: (() => void) | null = null;

  const clearTimer = (): void => {
    cancelDismiss?.();
    cancelDismiss = null;
  };

  const dismiss = (): void => {
    clearTimer();
    store.setState({ current: null });
  };

  const show = (input: { tone: ToastTone; message: string }): void => {
    const current = store.getState().current;
    if (current !== null && current.message === input.message && current.tone === input.tone) {
      return;
    }

    clearTimer();
    const toast: Toast = { id: nextId, tone: input.tone, message: input.message };
    nextId += 1;
    store.setState({ current: toast });

    if (HAPTIC_TONES.has(input.tone as HapticTone)) {
      haptics.notify(input.tone as HapticTone);
    }

    cancelDismiss = scheduler.schedule(dismiss, durationMs);
  };

  return { store, show, dismiss };
}
