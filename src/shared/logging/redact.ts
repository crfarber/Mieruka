/**
 * Log data must never leak secrets or personal data. Everything that goes into the logger
 * passes through `redact`: phone numbers, complete message payloads and request bodies do not
 * belong in a log that is shared with support.
 */

const SECRET_KEY = /(token|authorization|password|secret|jwt|cookie|smscode|verificationcode|otp)/i;
const PERSONAL_KEY = /(phone|email|username|iban)/i;

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 5;

export function maskValue(value: string): string {
  return value.length <= 3 ? '***' : `***${value.slice(-3)}`;
}

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[+${value.length - MAX_STRING_LENGTH}]`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return '[function]';
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (depth >= MAX_DEPTH) {
    return '[max depth]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      result[key] = '[redacted]';
    } else if (PERSONAL_KEY.test(key) && typeof entry === 'string') {
      result[key] = maskValue(entry);
    } else {
      result[key] = redact(entry, depth + 1);
    }
  }
  return result;
}
