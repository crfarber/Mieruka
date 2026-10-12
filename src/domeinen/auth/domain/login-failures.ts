/** The ways signing in can fail in an expected manner, and the text that belongs to each. */

export type LoginFailure =
  /** The user closed the sign-in sheet or declined consent. Nothing to explain. */
  | { kind: 'cancelled' }
  /** This build has no working sign-in method (for example a missing configuration). */
  | { kind: 'unavailable' }
  | { kind: 'failed' };

/** Translation keys (see `shared/i18n/resources.ts`). */
export type LoginMessageKey = 'login.errors.unavailable' | 'login.errors.failed';

/** Null when nothing needs to be said, for example after the user cancelled. */
export function describeLoginFailure(failure: LoginFailure): LoginMessageKey | null {
  switch (failure.kind) {
    case 'cancelled':
      return null;
    case 'unavailable':
      return 'login.errors.unavailable';
    case 'failed':
      return 'login.errors.failed';
  }
}

/** What `react-native-app-auth`'s `authorize()` throws when the sign-in sheet does not succeed. */
export type AppAuthFailure = { code?: string; message?: string };

/**
 * Codes `authorize()` throws for a cancel. Gathered from the library's own native source
 * (`node_modules/react-native-app-auth`) and confirmed on a device (iOS simulator): declining the
 * system prompt "___ wants to use login.microsoftonline.com to sign in" produced
 * `authentication_failed` with a message that does **not** mention "cancel" — Foundation's generic
 * description for the underlying `NSError`, not a string AppAuth wrote itself. Message-sniffing is
 * therefore not reliable; the code alone decides.
 *
 * - `access_denied`: the user declined consent at the identity provider's own screen.
 * - `user_cancelled_authorization`: AppAuth-Android's own stable string for a dismissed sheet.
 * - `authentication_failed`: AppAuth-iOS's fallback for anything outside the three OAuth error
 *   domains, confirmed above to include a cancel. `browser_not_found` and
 *   `service_configuration_fetch_error` are separate codes for the other distinct failures
 *   `authorize()` can have, so what is left here is overwhelmingly a cancel; on the rare genuine
 *   failure that also lands here, the user sees nothing and can just try again.
 * - `authentication_error`: AppAuth-Android's analogous fallback in `onActivityResult`, for the
 *   same reason.
 */
const CANCELLED_CODES = new Set([
  'access_denied',
  'user_cancelled_authorization',
  'authentication_failed',
  'authentication_error',
]);

/** Turns an `authorize()` failure into what the login screen shows. */
export function classifyAppAuthError(failure: AppAuthFailure): LoginFailure {
  return failure.code !== undefined && CANCELLED_CODES.has(failure.code)
    ? { kind: 'cancelled' }
    : { kind: 'failed' };
}
