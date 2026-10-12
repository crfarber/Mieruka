import { describe, expect, it } from 'vitest';
import { findAccount, selectableAccounts, type MonetaryAccount } from './accounts';

const account = (id: number, status = 'ACTIVE'): MonetaryAccount => ({
  id,
  description: `Account ${id}`,
  iban: null,
  balance: { cents: 100, currency: 'EUR' },
  status,
});

describe('selectableAccounts', () => {
  it('offers only active accounts, in the order bunq gives them', () => {
    const accounts = [account(3), account(1, 'CANCELLED'), account(2, 'BLOCKED'), account(4)];

    expect(selectableAccounts(accounts).map((candidate) => candidate.id)).toEqual([3, 4]);
  });
});

describe('findAccount', () => {
  it('finds the chosen account', () => {
    expect(findAccount([account(1), account(2)], 2)?.id).toBe(2);
  });

  it('is empty when nothing is chosen', () => {
    expect(findAccount([account(1)], null)).toBeNull();
  });

  it('is empty when the chosen account is gone', () => {
    expect(findAccount([account(1)], 9)).toBeNull();
  });
});
