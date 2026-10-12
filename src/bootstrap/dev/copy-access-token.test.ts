import { describe, expect, it, vi } from 'vitest';
import { copyAccessTokenToClipboard } from './copy-access-token';

describe('copyAccessTokenToClipboard', () => {
  it('does not write to the clipboard when there is no access token', async () => {
    const tokenProvider = {
      getAccessToken: vi.fn<() => Promise<string | null>>(async () => null),
    };
    const clipboard = { setStringAsync: vi.fn(async (_value: string) => undefined) };

    await expect(copyAccessTokenToClipboard({ tokenProvider, clipboard })).resolves.toBe(false);
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('copies the current access token only when explicitly requested', async () => {
    const accessToken = 'header.payload.signature';
    const tokenProvider = {
      getAccessToken: vi.fn<() => Promise<string | null>>(async () => accessToken),
    };
    const clipboard = { setStringAsync: vi.fn(async (_value: string) => undefined) };

    await expect(copyAccessTokenToClipboard({ tokenProvider, clipboard })).resolves.toBe(true);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(accessToken);
  });
});
