import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { AuthService } from '../service/auth-service';
import type { SessionState, SessionStore } from '../store/session-store';

export type AuthContextValue = {
  authService: AuthService;
  sessionStore: SessionStore;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Supplied by `bootstrap/providers.tsx`. The domain never creates its own dependencies. */
export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

export const useAuthService = (): AuthService => useAuthContext().authService;

/** Reads a part of the session state. Never contains tokens. */
export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useAuthContext().sessionStore, selector);
}
