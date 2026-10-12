import { describe, expect, it } from 'vitest';
import { createLogger } from '@/shared/logging/logger';
import { createFakeClock, createInMemoryStore } from '@/test/fakes';
import { ACCOUNT_CHOICE_KEY, createAccountChoice } from './account-choice';

function setup(initial: Record<string, string> = {}) {
  const store = createInMemoryStore(initial);
  const applied: (number | null)[] = [];
  const logger = createLogger({ clock: createFakeClock() });
  const choice = createAccountChoice({ store, apply: (id) => applied.push(id), logger });
  return { store, applied, logger, choice };
}

describe('account choice', () => {
  it('remembers the chosen account for the next start', async () => {
    const first = setup();
    await first.choice.choose(11);

    const second = setup(first.store.dump());
    await second.choice.restore();

    expect(first.applied).toEqual([11]);
    expect(second.applied).toEqual([11]);
  });

  it('applies nothing when no account was chosen', async () => {
    const { choice, applied } = setup();

    await choice.restore();

    expect(applied).toEqual([]);
  });

  it.each(['abc', '0', '-3', '1.5', ''])('ignores a stored value of %j', async (value) => {
    const { choice, applied } = setup({ [ACCOUNT_CHOICE_KEY]: value });

    await choice.restore();

    expect(applied).toEqual([]);
  });

  it('forgets the choice', async () => {
    const { choice, applied, store } = setup({ [ACCOUNT_CHOICE_KEY]: '11' });

    await choice.forget();

    expect(applied).toEqual([null]);
    expect(store.dump()).toEqual({});
  });

  it('keeps the choice for now when it cannot be saved', async () => {
    const { choice, applied, store, logger } = setup();
    store.setItem = () => Promise.reject(new Error('disk full'));

    await choice.choose(11);

    expect(applied).toEqual([11]);
    expect(logger.entries().some((entry) => entry.level === 'warn')).toBe(true);
  });

  it('starts without a choice when storage cannot be read', async () => {
    const { choice, applied, store } = setup();
    store.getItem = () => Promise.reject(new Error('locked'));

    await choice.restore();

    expect(applied).toEqual([]);
  });
});
