import { createContext, useContext, type ReactNode } from 'react';
import type { Scheduler } from '@/shared/platform/ports';

const SchedulerContext = createContext<Scheduler | null>(null);

export function SchedulerProvider({ value, children }: { value: Scheduler; children: ReactNode }) {
  return <SchedulerContext.Provider value={value}>{children}</SchedulerContext.Provider>;
}

export function useScheduler(): Scheduler {
  const scheduler = useContext(SchedulerContext);
  if (scheduler === null) {
    throw new Error('useScheduler must be used within a SchedulerProvider');
  }
  return scheduler;
}
