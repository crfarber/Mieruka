import type { QueryClient } from '@tanstack/react-query';
import type { i18n as I18n } from 'i18next';
import {
  bindSessionStore,
  createAuthService,
  createDemoAuthenticator,
  createRefresher,
  createSessionLifecycle,
  createSessionRepository,
  createSessionStore,
  createTokenProvider,
  type AuthService,
  type Authenticator,
  type Scheduler,
  type SessionLifecycle,
  type SessionStore,
  type TokenProvider,
} from '@/domeinen/auth';
import { createLanguageSettings, type LanguageSettings } from '@/domeinen/settings';
import { supportLogText, type LogShare, type SupportLog } from '@/domeinen/support';
import { createHttpClient, type HttpClient } from '@/shared/api/http-client';
import type { RuntimeConfig } from '@/shared/config/runtime-config';
import { createI18n } from '@/shared/i18n/i18n';
import type { Language } from '@/shared/i18n/resources';
import { createLogger, type Logger, type LogSink } from '@/shared/logging/logger';
import { createStatusOverlay, type StatusOverlay } from '@/shared/feedback/status-overlay';
import { createToastQueue, type ToastQueue } from '@/shared/feedback/toast-queue';
import {
  noopHaptics,
  realSleep,
  systemClock,
  type Clock,
  type Haptics,
  type KeyValueStore,
  type SecretStore,
  type Sleep,
} from '@/shared/platform/ports';
import { createQueryClient } from '@/shared/query/create-query-client';
import { clearQueryCache, loadQueryCache, saveQueryCache } from '@/shared/query/query-cache-store';
import { collectDebugSnapshot, type DebugSnapshot } from './dev/collect-debug-snapshot';

/** What the device provides. Everything else is built from it. */
export type ContainerInput = {
  config: RuntimeConfig;
  secretStore: SecretStore;
  /** Non-secret preferences. */
  keyValueStore: KeyValueStore;
  /** The phone's language. A choice made in the settings overrides it at start. */
  language: Language;
  /**
   * The sign-in of this build when it needs the device (a browser sheet). Null for the demo
   * sign-in, which the container builds itself.
   */
  deviceAuthenticator: Authenticator | null;
  /** System share sheet for the redacted support log. */
  logShare: LogShare;
  fetch?: typeof fetch;
  clock?: Clock;
  sleep?: Sleep;
  scheduler?: Scheduler;
  /** Short vibration on toast tones. Defaults to a noop. */
  haptics?: Haptics;
  logSink?: LogSink;
};

export type Container = {
  config: RuntimeConfig;
  logger: Logger;
  i18n: I18n;
  http: HttpClient;
  queryClient: QueryClient;
  tokenProvider: TokenProvider;
  sessionStore: SessionStore;
  authService: AuthService;
  lifecycle: SessionLifecycle;
  supportLog: SupportLog;
  clock: Clock;
  /** Non-blocking result feedback (toasts). */
  feedback: ToastQueue;
  /** Blocking full-screen status for send actions (processing / success / queued / error). */
  statusOverlay: StatusOverlay;
  /** Shared timer port — used by toasts and the status overlay. */
  scheduler: Scheduler;
  languageSettings: LanguageSettings;
  /**
   * Storage, session UI state and query cache for the __DEV__ debug screen.
   * Does not expose SecretStore on the container — only this snapshot.
   */
  loadDebugSnapshot(): Promise<DebugSnapshot>;
  /** Restores the session and starts keeping it fresh. Call once, at app start. */
  start(): Promise<void>;
  stop(): void;
};

const timerScheduler: Scheduler = {
  schedule(callback, delayMs) {
    const id = setTimeout(callback, delayMs);
    return () => clearTimeout(id);
  },
};

/**
 * The authenticator the configuration asks for. A device authenticator must match it; a mismatch
 * is a wiring mistake in `native.ts` and fails at start, not at the first sign-in.
 */
function selectAuthenticator(
  config: RuntimeConfig,
  deviceAuthenticator: Authenticator | null,
  clock: Clock,
): Authenticator {
  if (config.auth.provider === 'demo') {
    return createDemoAuthenticator(clock);
  }
  if (deviceAuthenticator?.method !== config.auth.provider) {
    throw new Error(`No device authenticator for ${config.auth.provider} sign-in`);
  }
  return deviceAuthenticator;
}

/** The app starts without a backend. The first real call says which variable is missing. */
function unconfiguredHttpClient(): HttpClient {
  const fail = (): Promise<never> =>
    Promise.reject(new Error('No API base URL configured. Set EXPO_PUBLIC_API_BASE_URL.'));
  return { request: fail, requestJson: fail };
}

/**
 * The composition root: the only place that knows every part and connects them. Nothing else
 * builds services, and nothing reaches for a global. Tests build a container with fakes.
 */
export function createContainer(input: ContainerInput): Container {
  const { config } = input;
  const clock = input.clock ?? systemClock;
  const sleep = input.sleep ?? realSleep;
  const scheduler = input.scheduler ?? timerScheduler;
  const haptics = input.haptics ?? noopHaptics;
  const fetchImpl = input.fetch ?? fetch;
  const feedback = createToastQueue({ scheduler, haptics });
  const statusOverlay = createStatusOverlay({ scheduler, haptics });

  const logger = createLogger({ clock, sink: input.logSink });
  const queryClient = createQueryClient(logger);

  let cacheSaveGeneration = 0;
  let cancelCacheSave: (() => void) | null = null;

  function cancelPendingCacheSave(): void {
    cacheSaveGeneration += 1;
    cancelCacheSave?.();
    cancelCacheSave = null;
  }

  function scheduleCacheSave(): void {
    cancelCacheSave?.();
    const generation = cacheSaveGeneration;
    cancelCacheSave = scheduler.schedule(() => {
      cancelCacheSave = null;
      if (generation !== cacheSaveGeneration) {
        return;
      }
      void saveQueryCache(queryClient, input.keyValueStore);
    }, 500);
  }

  const unsubscribeQueryCache = queryClient.getQueryCache().subscribe(() => {
    scheduleCacheSave();
  });

  const authenticator = selectAuthenticator(config, input.deviceAuthenticator, clock);

  const tokenProvider = createTokenProvider({
    repository: createSessionRepository(input.secretStore),
    refresh: createRefresher(authenticator),
    clock,
    sleep,
    logger,
  });

  const http =
    config.apiBaseUrl === null
      ? unconfiguredHttpClient()
      : createHttpClient({
          baseUrl: config.apiBaseUrl,
          fetch: fetchImpl,
          getAccessToken: () => tokenProvider.getAccessToken(),
          refreshAccessToken: () => tokenProvider.refreshNow(),
          logger,
        });

  const sessionStore = createSessionStore();
  const unbindSessionStore = bindSessionStore(tokenProvider, sessionStore);

  const supportLog: SupportLog = {
    text: () => supportLogText(logger.entries(), clock.now()),
    share: () => input.logShare.share(supportLogText(logger.entries(), clock.now())),
  };

  /** Data of the previous user must not be visible to the next one. Preferences survive. */
  async function clearUserData(): Promise<void> {
    cancelPendingCacheSave();
    queryClient.clear();
    await clearQueryCache(input.keyValueStore);
  }

  const authService = createAuthService({
    provider: tokenProvider,
    authenticator,
    onSignedOut: clearUserData,
    logger,
  });

  // A session that ends by itself (refresh token refused) also clears user data.
  const unsubscribeSessionEvents = tokenProvider.subscribe((event) => {
    if (event.type === 'signed-out' && event.reason === 'expired') {
      clearUserData().catch((error: unknown) => {
        logger.warn('auth', 'Could not clear user data after the session expired', { error });
      });
    }
  });

  const lifecycle = createSessionLifecycle({
    provider: tokenProvider,
    scheduler,
    clock,
    logger,
  });

  const i18n = createI18n(input.language);
  const languageSettings = createLanguageSettings({
    store: input.keyValueStore,
    apply: (language) => i18n.changeLanguage(language),
    logger,
  });

  return {
    config,
    logger,
    i18n,
    http,
    queryClient,
    tokenProvider,
    sessionStore,
    authService,
    lifecycle,
    supportLog,
    clock,
    feedback,
    statusOverlay,
    scheduler,
    languageSettings,

    loadDebugSnapshot: () =>
      collectDebugSnapshot({
        secretStore: input.secretStore,
        keyValueStore: input.keyValueStore,
        sessionStore,
        tokenProvider,
        queryClient,
      }),

    async start() {
      // Before the session is known, so the first screen after the splash is already right.
      await languageSettings.restore();
      lifecycle.start();
      try {
        await tokenProvider.restore();
      } catch (error) {
        // Secure storage could not be read. Do not leave the app on a blank screen: show login.
        logger.error('auth', 'Could not restore the session', { error });
        sessionStore.setState({
          status: 'signed-out',
          method: null,
          signedOutReason: null,
        });
      }
      if (tokenProvider.getStatus() === 'signed-in') {
        await loadQueryCache(queryClient, input.keyValueStore);
      }
    },

    stop() {
      lifecycle.stop();
      cancelPendingCacheSave();
      unbindSessionStore();
      unsubscribeSessionEvents();
      unsubscribeQueryCache();
    },
  };
}
