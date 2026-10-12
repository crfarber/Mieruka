/** The React Native side of the auth domain. Only routes and bootstrap import this file. */
export { AuthProvider, useAuthService, useSession } from './hooks/auth-context';
export type { AuthContextValue } from './hooks/auth-context';
export { createAzureAdAuthenticator } from './platform/rn/azure-ad-authenticator';
export type { AppAuthClient } from './platform/rn/azure-ad-authenticator';
export { LoginScreen } from './screens/login-screen';
