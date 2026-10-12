import { createContext, useContext, type ReactNode } from 'react';
import type { SupportLog } from '../index';

const SupportContext = createContext<SupportLog | null>(null);

export function SupportProvider({ value, children }: { value: SupportLog; children: ReactNode }) {
  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupportLog(): SupportLog {
  const value = useContext(SupportContext);
  if (value === null) {
    throw new Error('SupportProvider is missing');
  }
  return value;
}
