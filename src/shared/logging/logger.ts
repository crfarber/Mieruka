import type { Clock } from '@/shared/platform/ports';
import { redact } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'app'
  | 'auth'
  | 'http'
  | 'sync'
  | 'notifications'
  | 'location'
  | 'photos'
  | 'navigation'
  | 'serviceForm';

export type LogEntry = {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly category: LogCategory;
  readonly message: string;
  readonly data?: unknown;
};

export type LogSink = (entry: LogEntry) => void;

export type Logger = {
  debug(category: LogCategory, message: string, data?: unknown): void;
  info(category: LogCategory, message: string, data?: unknown): void;
  warn(category: LogCategory, message: string, data?: unknown): void;
  error(category: LogCategory, message: string, data?: unknown): void;
  entries(): readonly LogEntry[];
  clear(): void;
};

export type LoggerOptions = {
  clock: Clock;
  /** Maximum number of entries kept in memory. Oldest entries are dropped first. */
  capacity?: number;
  /** Optional side channel (console in development, remote reporting later). */
  sink?: LogSink;
};

const DEFAULT_CAPACITY = 1000;

export function createLogger(options: LoggerOptions): Logger {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const buffer: LogEntry[] = [];

  const write = (level: LogLevel, category: LogCategory, message: string, data?: unknown): void => {
    const entry: LogEntry = {
      timestamp: new Date(options.clock.now()).toISOString(),
      level,
      category,
      message,
      ...(data === undefined ? {} : { data: redact(data) }),
    };
    buffer.push(entry);
    if (buffer.length > capacity) {
      buffer.shift();
    }
    options.sink?.(entry);
  };

  return {
    debug: (category, message, data) => write('debug', category, message, data),
    info: (category, message, data) => write('info', category, message, data),
    warn: (category, message, data) => write('warn', category, message, data),
    error: (category, message, data) => write('error', category, message, data),
    entries: () => [...buffer],
    clear: () => {
      buffer.length = 0;
    },
  };
}

export type LogExportOptions = {
  now: number;
  /** Only entries from the last `sinceMs` milliseconds. */
  sinceMs?: number;
  category?: LogCategory;
  maxEntries?: number;
  header?: string;
};

/** Formats entries newest first, for sharing with support. */
export function formatLogExport(entries: readonly LogEntry[], options: LogExportOptions): string {
  const cutoff = options.sinceMs === undefined ? null : options.now - options.sinceMs;

  const selected = entries
    .filter((entry) => options.category === undefined || entry.category === options.category)
    .filter((entry) => cutoff === null || Date.parse(entry.timestamp) >= cutoff)
    .reverse()
    .slice(0, options.maxEntries ?? entries.length);

  const lines = selected.map((entry) => {
    const head = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category.toUpperCase()}] ${entry.message}`;
    return entry.data === undefined ? head : `${head}\nData: ${JSON.stringify(entry.data)}`;
  });

  const header = options.header === undefined ? '' : `${options.header}\n\n`;
  return `${header}${lines.join('\n\n')}`;
}
