/**
 * An amount in the smallest unit of its currency (cents), so adding and dividing stay exact.
 * `currency` is an ISO 4217 code such as `EUR`.
 */
export type Money = { readonly cents: number; readonly currency: string };

const DECIMAL_AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Reads an amount written as a decimal string ("12.30", "-0.5", "7") as cents. Null for anything
 * else, so a malformed amount is caught where it enters the app instead of showing up as NaN.
 */
export function parseDecimalAmount(value: string): number | null {
  const match = DECIMAL_AMOUNT.exec(value.trim());
  if (match === null) {
    return null;
  }
  const [, sign, whole = '0', fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) {
    return null;
  }
  return sign === '-' && cents !== 0 ? -cents : cents;
}

/** Formats an amount the way the given language writes it: `€ 12,30` in Dutch, `€12.30` in English. */
export function formatMoney(money: Money, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: money.currency }).format(
    money.cents / 100,
  );
}
