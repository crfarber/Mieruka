import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@/shared/logging/logger';
import { SUPPORT_LOG_HEADER, supportLogText } from './export';

const NOW = Date.parse('2026-09-22T12:00:00.000Z');

function entry(partial: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-09-22T11:00:00.000Z',
    level: 'info',
    category: 'app',
    message: 'Saved',
    ...partial,
  };
}

describe('supportLogText', () => {
  it('puts a header on the redacted lines and keeps the newest first', () => {
    const text = supportLogText(
      [
        entry({ timestamp: '2026-09-22T10:00:00.000Z', message: 'Older' }),
        entry({
          timestamp: '2026-09-22T11:30:00.000Z',
          message: 'Newer',
          data: { accessToken: '[redacted]' },
        }),
      ],
      NOW,
    );

    expect(text.startsWith(SUPPORT_LOG_HEADER)).toBe(true);
    expect(text.indexOf('Newer')).toBeLessThan(text.indexOf('Older'));
    expect(text).toContain('[redacted]');
    expect(text).not.toContain('secret-token');
  });

  it('drops lines older than a day', () => {
    const text = supportLogText(
      [entry({ timestamp: '2026-09-20T11:00:00.000Z', message: 'Stale' })],
      NOW,
    );

    expect(text).not.toContain('Stale');
  });
});
