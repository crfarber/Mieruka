import { authorize, refresh } from 'react-native-app-auth';
import { fetch as expoFetch } from 'expo/fetch';
import type { Authenticator } from '@/domeinen/auth';
import { createAzureAdAuthenticator } from '@/domeinen/auth/ui';
import { createRnLogShare } from '@/domeinen/support/ui';
import { createDeviceKeyValueStore } from '@/shared/platform/rn/key-value-store';
import { createExpoHaptics } from '@/shared/platform/rn/expo-haptics';
import { createDeviceSecretStore } from '@/shared/platform/rn/secure-store';
import { consoleSink } from '@/shared/platform/rn/console-sink';
import type { RuntimeConfig } from '@/shared/config/runtime-config';
import type { Language } from '@/shared/i18n/resources';
import { createContainer, type Container } from './container';
import { readRuntimeConfig } from './env';

/** Dutch when the phone is set to Dutch, English otherwise. */
function detectLanguage(): Language {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith('nl') ? 'nl' : 'en';
}

/** The sign-in that needs the device. Null for the demo sign-in (see `createContainer`). */
function buildDeviceAuthenticator(config: RuntimeConfig): Authenticator | null {
  switch (config.auth.provider) {
    case 'demo':
      return null;
    case 'azure-ad':
      return createAzureAdAuthenticator({
        config: config.auth.azureAd,
        client: { authorize, refresh },
      });
  }
}

/** The container with the real device parts. Created once, when the app starts. */
export function createNativeContainer(): Container {
  const config = readRuntimeConfig();
  return createContainer({
    config,
    secretStore: createDeviceSecretStore(),
    keyValueStore: createDeviceKeyValueStore(),
    language: detectLanguage(),
    deviceAuthenticator: buildDeviceAuthenticator(config),
    logShare: createRnLogShare(),
    haptics: createExpoHaptics(),
    logSink: consoleSink,
    fetch: expoFetch,
  });
}
