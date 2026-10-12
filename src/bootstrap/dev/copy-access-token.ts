type AccessTokenProvider = {
  getAccessToken(): Promise<string | null>;
};

type ClipboardWriter = {
  setStringAsync(value: string): Promise<boolean | void>;
};

export async function copyAccessTokenToClipboard(deps: {
  tokenProvider: AccessTokenProvider;
  clipboard: ClipboardWriter;
}): Promise<boolean> {
  const accessToken = await deps.tokenProvider.getAccessToken();
  if (accessToken === null) {
    return false;
  }

  const copied = await deps.clipboard.setStringAsync(accessToken);
  return copied !== false;
}
