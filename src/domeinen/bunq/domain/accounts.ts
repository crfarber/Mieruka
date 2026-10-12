import type { Money } from '@/shared/money';

/** One bunq account (bank, savings or joint), with what the app shows of it. */
export type MonetaryAccount = {
  readonly id: number;
  /** The name the user gave the account in bunq. */
  readonly description: string;
  readonly iban: string | null;
  /** What is available to spend, as bunq reports it. */
  readonly balance: Money;
  /** bunq's status: `ACTIVE`, `BLOCKED`, `CANCELLED` or `PENDING_REOPEN`. */
  readonly status: string;
};

/** Only an active account can be the one the budget is about; closed and blocked ones are left out. */
export function selectableAccounts(accounts: readonly MonetaryAccount[]): MonetaryAccount[] {
  return accounts.filter((account) => account.status === 'ACTIVE');
}

/** The chosen account, or null when none is chosen or it is no longer there. */
export function findAccount(
  accounts: readonly MonetaryAccount[],
  id: number | null,
): MonetaryAccount | null {
  if (id === null) {
    return null;
  }
  return accounts.find((account) => account.id === id) ?? null;
}
