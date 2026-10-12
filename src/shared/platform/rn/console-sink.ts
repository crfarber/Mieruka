import type { LogEntry } from '@/shared/logging/logger';

/** Mirrors log entries to the developer console. Off in production builds. */
export function consoleSink(entry: LogEntry): void {
  if (!__DEV__) {
    return;
  }
  const line = `[${entry.category}] ${entry.message}`;
  const args = entry.data === undefined ? [line] : [line, entry.data];
  switch (entry.level) {
    case 'error':
      console.error(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    default:
      console.log(...args);
  }
}
