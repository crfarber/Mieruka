import { describe, expect, it, vi } from 'vitest';
import { createFakeScheduler } from '@/test/fakes';
import { noopHaptics } from '@/shared/platform/ports';
import { createToastQueue } from './toast-queue';

describe('createToastQueue', () => {
  it('shows one toast and dismisses it after the duration', async () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const queue = createToastQueue({ scheduler, haptics, durationMs: 1000 });

    queue.show({ tone: 'success', message: 'Opgeslagen' });
    expect(queue.store.getState().current?.message).toBe('Opgeslagen');
    expect(haptics.notify).toHaveBeenCalledWith('success');

    await scheduler.fireNext();
    expect(queue.store.getState().current).toBeNull();
  });

  it('replaces a previous toast when a different message arrives', () => {
    const scheduler = createFakeScheduler();
    const queue = createToastQueue({ scheduler, haptics: noopHaptics, durationMs: 1000 });

    queue.show({ tone: 'success', message: 'Eerste' });
    queue.show({ tone: 'info', message: 'Tweede' });

    expect(queue.store.getState().current?.message).toBe('Tweede');
    expect(scheduler.pending()).toHaveLength(1);
  });

  it('ignores an identical toast while the same one is still visible', () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const queue = createToastQueue({ scheduler, haptics, durationMs: 1000 });

    queue.show({ tone: 'error', message: 'Fout' });
    queue.show({ tone: 'error', message: 'Fout' });

    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(queue.store.getState().current?.id).toBe(1);
  });

  it('does not vibrate for an info toast', () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const queue = createToastQueue({ scheduler, haptics });

    queue.show({ tone: 'info', message: 'In de wachtrij' });
    expect(haptics.notify).not.toHaveBeenCalled();
  });

  it('dismiss cancels the auto-dismiss timer', async () => {
    const scheduler = createFakeScheduler();
    const queue = createToastQueue({ scheduler, haptics: noopHaptics, durationMs: 1000 });

    queue.show({ tone: 'success', message: 'Ok' });
    queue.dismiss();
    expect(queue.store.getState().current).toBeNull();
    expect(scheduler.pending()).toHaveLength(0);
  });
});
