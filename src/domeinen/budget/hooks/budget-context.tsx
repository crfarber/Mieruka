import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { CalendarDate } from '../domain/daily-budget';

export type BudgetContextValue = {
  /** Today's date in the time zone of the phone (container: clock plus time zone). */
  today: () => CalendarDate;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

/** Supplied by `bootstrap/providers.tsx`. The domain never creates its own dependencies. */
export function BudgetProvider({
  value,
  children,
}: {
  value: BudgetContextValue;
  children: ReactNode;
}) {
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

const sameDate = (a: CalendarDate, b: CalendarDate): boolean =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/**
 * Today's date, as state rather than read during render, so it is looked up again whenever the
 * app comes back to the foreground (the usual way a new day starts for an open app).
 */
export function useToday(): CalendarDate {
  const value = useContext(BudgetContext);
  if (value === null) {
    throw new Error('useToday must be used inside <BudgetProvider>');
  }
  const { today } = value;
  const [date, setDate] = useState(today);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const next = today();
        setDate((current) => (sameDate(current, next) ? current : next));
      }
    });
    return () => subscription.remove();
  }, [today]);

  return date;
}
