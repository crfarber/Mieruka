import { createContext, useContext, type ReactNode } from 'react';
import type { LanguageSettings } from '../index';

type SettingsContextValue = {
  languageSettings: LanguageSettings;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  value,
  children,
}: {
  value: SettingsContextValue;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error('SettingsProvider is missing');
  }
  return value;
}

export function useLanguageSettings(): LanguageSettings {
  return useSettings().languageSettings;
}
