import { describe, expect, it, vi } from 'vitest';
import { createFakeClock } from '@/test/fakes';
import { createLogger, formatLogExport, type LogEntry } from './logger';

describe('createLogger', () => {
  it('records entries with timestamp, level and category', () => {
    const clock = createFakeClock(Date.UTC(2026, 8, 21, 12, 0, 0));
    const logger = createLogger({ clock });

    logger.info('auth', 'Signed in');
    clock.advance(1000);
    logger.error('http', 'Request failed', { status: 500 });

    expect(logger.entries()).toEqual([
      {
        timestamp: '2026-09-21T12:00:00.000Z',
        level: 'info',
        category: 'auth',
        message: 'Signed in',
      },
      {
        timestamp: '2026-09-21T12:00:01.000Z',
        level: 'error',
        category: 'http',
        message: 'Request failed',
        data: { status: 500 },
      },
    ]);
  });

  it('redacts data before storing it', () => {
    const logger = createLogger({ clock: createFakeClock() });

    logger.info('auth', 'Login', { accessToken: 'secret', phoneNumber: '+31612345678' });

    expect(logger.entries()[0]?.data).toEqual({
      accessToken: '[redacted]',
      phoneNumber: '***678',
    });
  });

  it('drops the oldest entries beyond capacity', () => {
    const logger = createLogger({ clock: createFakeClock(), capacity: 3 });

    for (let index = 1; index <= 5; index += 1) {
      logger.debug('app', `message ${index}`);
    }

    expect(logger.entries().map((entry) => entry.message)).toEqual([
      'message 3',
      'message 4',
      'message 5',
    ]);
  });

  it('forwards every entry to the sink', () => {
    const sink = vi.fn<(entry: LogEntry) => void>();
    const logger = createLogger({ clock: createFakeClock(), sink });

    logger.warn('sync', 'Slow sync');

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]).toMatchObject({ level: 'warn', category: 'sync' });
  });

  it('clears the buffer', () => {
    const logger = createLogger({ clock: createFakeClock() });
    logger.info('app', 'x');
    logger.clear();
    expect(logger.entries()).toEqual([]);
  });

  it('returns a copy, so callers cannot mutate the buffer', () => {
    const logger = createLogger({ clock: createFakeClock() });
    logger.info('app', 'x');
    const copy = logger.entries() as LogEntry[];
    copy.length = 0;
    expect(logger.entries()).toHaveLength(1);
  });
});

describe('formatLogExport', () => {
  const clock = createFakeClock(Date.UTC(2026, 8, 21, 12, 0, 0));
  const logger = createLogger({ clock });
  logger.info('auth', 'first');
  clock.advance(60_000);
  logger.warn('http', 'second', { status: 500 });
  clock.advance(60_000);
  logger.error('auth', 'third');
  const entries = logger.entries();
  const now = clock.now();

  it('lists newest first with a header', () => {
    const text = formatLogExport(entries, { now, header: 'Support export' });
    const lines = text.split('\n\n');

    expect(lines[0]).toBe('Support export');
    expect(lines[1]).toContain('[ERROR] [AUTH] third');
    expect(lines[2]).toContain('[WARN] [HTTP] second');
    expect(lines[2]).toContain('Data: {"status":500}');
    expect(lines[3]).toContain('[INFO] [AUTH] first');
  });

  it('filters by category', () => {
    const text = formatLogExport(entries, { now, category: 'auth' });
    expect(text).toContain('first');
    expect(text).toContain('third');
    expect(text).not.toContain('second');
  });

  it('filters by age', () => {
    const text = formatLogExport(entries, { now, sinceMs: 90_000 });
    expect(text).toContain('second');
    expect(text).toContain('third');
    expect(text).not.toContain('first');
  });

  it('limits the number of entries', () => {
    const text = formatLogExport(entries, { now, maxEntries: 1 });
    expect(text).toContain('third');
    expect(text).not.toContain('second');
  });

  it('returns an empty string when nothing matches and there is no header', () => {
    expect(formatLogExport([], { now })).toBe('');
  });
});
