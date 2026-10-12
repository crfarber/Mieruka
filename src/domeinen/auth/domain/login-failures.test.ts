import { describe, expect, it } from 'vitest';
import { classifyAppAuthError, describeLoginFailure } from './login-failures';

describe('describeLoginFailure', () => {
  it('says nothing when the user cancelled', () => {
    expect(describeLoginFailure({ kind: 'cancelled' })).toBeNull();
  });

  it('explains that signing in is unavailable in this build', () => {
    expect(describeLoginFailure({ kind: 'unavailable' })).toBe('login.errors.unavailable');
  });

  it('reports a failure', () => {
    expect(describeLoginFailure({ kind: 'failed' })).toBe('login.errors.failed');
  });
});

describe('classifyAppAuthError', () => {
  it('treats a declined consent as a cancel', () => {
    expect(classifyAppAuthError({ code: 'access_denied' })).toEqual({ kind: 'cancelled' });
  });

  it("treats AppAuth-Android's stable cancel code as a cancel", () => {
    expect(classifyAppAuthError({ code: 'user_cancelled_authorization' })).toEqual({
      kind: 'cancelled',
    });
  });

  it('treats the iOS generic fallback as a cancel, whatever the message says (confirmed on a device: declining the system prompt gives this code with a message that does not mention "cancel")', () => {
    expect(
      classifyAppAuthError({
        code: 'authentication_failed',
        message: "The operation couldn't be completed.",
      }),
    ).toEqual({ kind: 'cancelled' });
    expect(classifyAppAuthError({ code: 'authentication_failed' })).toEqual({
      kind: 'cancelled',
    });
  });

  it('treats the Android onActivityResult fallback as a cancel, for the same reason', () => {
    expect(classifyAppAuthError({ code: 'authentication_error', message: 'boom' })).toEqual({
      kind: 'cancelled',
    });
    expect(classifyAppAuthError({ code: 'authentication_error' })).toEqual({
      kind: 'cancelled',
    });
  });

  it('treats an unknown code as a failure', () => {
    expect(classifyAppAuthError({ code: 'server_error', message: 'boom' })).toEqual({
      kind: 'failed',
    });
  });

  it('treats a plain error with no code as a failure', () => {
    expect(classifyAppAuthError({})).toEqual({ kind: 'failed' });
  });
});
