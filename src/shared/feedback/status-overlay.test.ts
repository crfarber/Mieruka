import { describe, expect, it, vi } from 'vitest';
import { noopHaptics } from '@/shared/platform/ports';
import { createFakeScheduler, deferred } from '@/test/fakes';
import { createStatusOverlay } from './status-overlay';

describe('createStatusOverlay', () => {
  it('shows processing while the task runs, then success', async () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const overlay = createStatusOverlay({
      scheduler,
      haptics,
      successMs: 1500,
    });
    const task = deferred<{ tone: 'success'; message: string }>();

    const done = overlay.run('Opslaan…', () => task.promise);
    expect(overlay.store.getState().current).toEqual({
      phase: 'processing',
      message: 'Opslaan…',
      slow: false,
    });

    task.resolve({ tone: 'success', message: 'Opgeslagen' });
    await done;

    expect(overlay.store.getState().current).toEqual({
      phase: 'success',
      message: 'Opgeslagen',
    });
    expect(haptics.notify).toHaveBeenCalledWith('success');

    await scheduler.fireNext();
    expect(overlay.store.getState().current).toBeNull();
  });

  it('marks processing as slow after the threshold', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({
      scheduler,
      haptics: noopHaptics,
      slowMs: 10_000,
    });
    const task = deferred<{ tone: 'none' }>();

    void overlay.run('Bezig…', () => task.promise);
    const beforeSlow = overlay.store.getState().current;
    expect(beforeSlow?.phase).toBe('processing');
    if (beforeSlow?.phase === 'processing') {
      expect(beforeSlow.slow).toBe(false);
    }

    await scheduler.fireNext();
    expect(overlay.store.getState().current).toEqual({
      phase: 'processing',
      message: 'Bezig…',
      slow: true,
    });

    task.resolve({ tone: 'none' });
  });

  it('keeps a queued screen until its duration elapses', async () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const overlay = createStatusOverlay({
      scheduler,
      haptics,
      queuedMs: 2500,
      slowMs: 10_000,
    });

    await overlay.run('Bezig…', async () => ({
      tone: 'queued',
      message: 'Wordt later verstuurd',
    }));

    expect(overlay.store.getState().current).toEqual({
      phase: 'queued',
      message: 'Wordt later verstuurd',
    });
    expect(haptics.notify).toHaveBeenCalledWith('warning');

    // Cancel the unused slow timer first, then fire the dismiss timer.
    const pending = scheduler.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.delayMs).toBe(2500);
    await scheduler.fireNext();
    expect(overlay.store.getState().current).toBeNull();
  });

  it('keeps an error screen until dismiss', async () => {
    const scheduler = createFakeScheduler();
    const haptics = { notify: vi.fn() };
    const retry = vi.fn();
    const overlay = createStatusOverlay({ scheduler, haptics, slowMs: 10_000 });

    await overlay.run('Bezig…', async () => ({
      tone: 'error',
      message: 'Er is iets misgegaan.',
      retry,
    }));

    const current = overlay.store.getState().current;
    expect(current?.phase).toBe('error');
    if (current?.phase === 'error') {
      expect(current.message).toBe('Er is iets misgegaan.');
      expect(current.retry).toBe(retry);
    }
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(scheduler.pending()).toHaveLength(0);

    overlay.dismiss();
    expect(overlay.store.getState().current).toBeNull();
  });

  it('ignores a second run while one is active (double-tap guard)', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({ scheduler, haptics: noopHaptics });
    const first = deferred<{ tone: 'success'; message: string }>();
    const secondTask = vi.fn(async () => ({ tone: 'success' as const, message: 'Tweede' }));

    const firstDone = overlay.run('Eerste…', () => first.promise);
    await overlay.run('Tweede…', secondTask);

    expect(secondTask).not.toHaveBeenCalled();
    expect(overlay.store.getState().current).toMatchObject({
      phase: 'processing',
      message: 'Eerste…',
    });

    first.resolve({ tone: 'success', message: 'Gelukt' });
    await firstDone;
  });

  it('closes and rethrows when the task throws', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({ scheduler, haptics: noopHaptics });

    await expect(
      overlay.run('Bezig…', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(overlay.store.getState().current).toBeNull();
  });

  it('closes immediately on tone none so a dialog can follow', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({ scheduler, haptics: noopHaptics });

    await overlay.run('Bezig…', async () => ({ tone: 'none' }));
    expect(overlay.store.getState().current).toBeNull();
  });

  it('dismiss cancels the auto-dismiss timer', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({
      scheduler,
      haptics: noopHaptics,
      successMs: 1500,
      slowMs: 10_000,
    });

    await overlay.run('Bezig…', async () => ({ tone: 'success', message: 'Ok' }));
    expect(overlay.store.getState().current?.phase).toBe('success');
    overlay.dismiss();
    expect(overlay.store.getState().current).toBeNull();
    expect(scheduler.pending()).toHaveLength(0);
  });

  it('never closes between task settle and success', async () => {
    const scheduler = createFakeScheduler();
    const overlay = createStatusOverlay({
      scheduler,
      haptics: noopHaptics,
      successMs: 1500,
      slowMs: 10_000,
    });
    const snapshots: Array<string | null> = [];
    const unsubscribe = overlay.store.subscribe((state) => {
      snapshots.push(state.current?.phase ?? null);
    });

    const task = deferred<{ tone: 'success'; message: string }>();
    const done = overlay.run('Accepteren…', async () => {
      // Simulate invalidateQueries / navigation work still inside the task.
      await task.promise;
      return { tone: 'success', message: 'Geaccepteerd' };
    });

    expect(overlay.store.getState().current?.phase).toBe('processing');
    task.resolve({ tone: 'success', message: 'Geaccepteerd' });
    await done;

    unsubscribe();
    expect(snapshots).toEqual(['processing', 'success']);
    expect(overlay.store.getState().current?.phase).toBe('success');
  });
});
