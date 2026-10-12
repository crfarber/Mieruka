export type QueryValue = string | number | boolean | null | undefined;

/**
 * Builds a request URL by hand. React Native's URL/URLSearchParams support is partial,
 * so we do not depend on it. `+` in phone numbers is encoded as %2B, as the backend expects.
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;

  const pairs = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];
      return value !== undefined && value !== null;
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  if (pairs.length === 0) {
    return `${base}${suffix}`;
  }
  const separator = suffix.includes('?') ? '&' : '?';
  return `${base}${suffix}${separator}${pairs.join('&')}`;
}

/** application/x-www-form-urlencoded body. */
export function encodeForm(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}
