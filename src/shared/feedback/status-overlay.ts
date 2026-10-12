import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Haptics, Scheduler } from '@/shared/platform/ports';

export type StatusOutcome =
  | { tone: 'success' | 'queued'; message: string }
  | { tone: 'error'; message: string; retry?: () => void }
  | { tone: 'none' };

export type StatusView =
  | { phase: 'processing'; message: string; slow: boolean }
  | { phase: 'success'; message: string }
  | { phase: 'queued'; message: string }
  | { phase: 'error'; message: string; retry?: () => void };

export type StatusOverlayState = {
  current: StatusView | null;
};

export type StatusOverlay = {
  store: StoreApi<StatusOverlayState>;
  run(message: string, task: () => Promise<StatusOutcome>): Promise<void>;
  dismiss(): void;
};

export type StatusOverlayDeps = {
  scheduler: Scheduler;
  haptics: Haptics;
  /** When "taking longer" appears during processing. Default 10 s. */
  slowMs?: number;
  /** How long a success screen stays visible. Default 1.5 s. */
  successMs?: number;
  /** How long a queued screen stays visible. Default 2.5 s. */
  queuedMs?: number;
};

/**
 * One blocking status screen at a time. `run` owns the full lifecycle so the screen never
 * closes between "done" and "success". A second `run` while one is active
 * is ignored — that is the double-tap guard.
 */
export function createStatusOverlay(deps: StatusOverlayDeps): StatusOverlay {
  const { scheduler, haptics } = deps;
  const slowMs = deps.slowMs ?? 10_000;
  const successMs = deps.successMs ?? 1_500;
  const queuedMs = deps.queuedMs ?? 2_500;
  const store = createStore<StatusOverlayState>()(() => ({ current: null }));

  let running = false;
  let cancelSlow: (() => void) | null = null;
  let cancelDismiss: (() => void) | null = null;

  const clearTimers = (): void => {
    cancelSlow?.();
    cancelSlow = null;
    cancelDismiss?.();
    cancelDismiss = null;
  };

  const dismiss = (): void => {
    clearTimers();
    running = false;
    store.setState({ current: null });
  };

  const applyOutcome = (outcome: StatusOutcome): void => {
    clearTimers();
    switch (outcome.tone) {
      case 'none':
        running = false;
        store.setState({ current: null });
        return;
      case 'success':
        haptics.notify('success');
        store.setState({ current: { phase: 'success', message: outcome.message } });
        cancelDismiss = scheduler.schedule(dismiss, successMs);
        return;
      case 'queued':
        haptics.notify('warning');
        store.setState({ current: { phase: 'queued', message: outcome.message } });
        cancelDismiss = scheduler.schedule(dismiss, queuedMs);
        return;
      case 'error':
        haptics.notify('error');
        store.setState({
          current: { phase: 'error', message: outcome.message, retry: outcome.retry },
        });
        return;
    }
  };

  const run = async (message: string, task: () => Promise<StatusOutcome>): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    clearTimers();
    store.setState({ current: { phase: 'processing', message, slow: false } });
    cancelSlow = scheduler.schedule(() => {
      const current = store.getState().current;
      if (current?.phase === 'processing') {
        store.setState({ current: { ...current, slow: true } });
      }
    }, slowMs);

    try {
      const outcome = await task();
      applyOutcome(outcome);
    } catch (error) {
      dismiss();
      throw error;
    }
  };

  return { store, run, dismiss };
}
