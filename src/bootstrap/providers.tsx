import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { AppState } from 'react-native';
import { AuthProvider } from '@/domeinen/auth/ui';
import { SettingsProvider } from '@/domeinen/settings/ui';
import { SupportProvider } from '@/domeinen/support/ui';
import { StatusOverlayProvider } from '@/shared/ui/status-overlay-host';
import { FeedbackProvider } from '@/shared/ui/toast-host';
import { SchedulerProvider } from '@/shared/ui/scheduler-context';
import type { Container } from './container';
import { copyAccessTokenToClipboard } from './dev/copy-access-token';
import { DevToolsProvider } from './dev/dev-tools-context';

/** Tells the session when the app returns to the foreground, so an expired token is renewed at once. */
function useForegroundRefresh(container: Container): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void container.lifecycle.onForeground();
      }
    });
    return () => subscription.remove();
  }, [container]);
}

/** Hands the parts of the container to the React tree. This is the only place that does so. */
export function AppProviders({
  container,
  children,
}: {
  container: Container;
  children: ReactNode;
}) {
  useForegroundRefresh(container);

  const auth = useMemo(
    () => ({ authService: container.authService, sessionStore: container.sessionStore }),
    [container],
  );
  const devTools = useMemo(
    () => ({
      loadDebugSnapshot: () => container.loadDebugSnapshot(),
      copyAccessToken: () =>
        copyAccessTokenToClipboard({
          tokenProvider: container.tokenProvider,
          clipboard: Clipboard,
        }),
    }),
    [container],
  );
  const settings = useMemo(() => ({ languageSettings: container.languageSettings }), [container]);

  return (
    <QueryClientProvider client={container.queryClient}>
      <I18nextProvider i18n={container.i18n}>
        <FeedbackProvider value={container.feedback}>
          <StatusOverlayProvider value={container.statusOverlay}>
            <SchedulerProvider value={container.scheduler}>
              <AuthProvider value={auth}>
                <DevToolsProvider value={devTools}>
                  <SettingsProvider value={settings}>
                    <SupportProvider value={container.supportLog}>{children}</SupportProvider>
                  </SettingsProvider>
                </DevToolsProvider>
              </AuthProvider>
            </SchedulerProvider>
          </StatusOverlayProvider>
        </FeedbackProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
