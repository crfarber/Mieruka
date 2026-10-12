import type { LogEntry } from '@/shared/logging/logger';
import { formatLogExport } from '@/shared/logging/logger';

/** One day of log lines, newest first. Entries were already passed through `redact`. */
const SUPPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** First line of the export. A text that is only this line has no entries. */
export const SUPPORT_LOG_HEADER = 'Supportlog';

export function supportLogText(entries: readonly LogEntry[], now: number): string {
  return formatLogExport(entries, {
    now,
    sinceMs: SUPPORT_WINDOW_MS,
    maxEntries: 200,
    header: SUPPORT_LOG_HEADER,
  });
}
