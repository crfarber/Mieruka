import { createContext, useContext, type ReactNode } from 'react';
import type { DebugSnapshot } from './collect-debug-snapshot';

export type DevToolsValue = {
  loadDebugSnapshot(): Promise<DebugSnapshot>;
  copyAccessToken(): Promise<boolean>;
};

const DevToolsContext = createContext<DevToolsValue | null>(null);

/** Hands explicit debug actions to the React tree — never the whole container. */
export function DevToolsProvider({
  value,
  children,
}: {
  value: DevToolsValue;
  children: ReactNode;
}) {
  return <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>;
}

export function useDevTools(): DevToolsValue {
  const value = useContext(DevToolsContext);
  if (value === null) {
    throw new Error('useDevTools must be used inside <DevToolsProvider>');
  }
  return value;
}
