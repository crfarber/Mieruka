import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeContainer } from '@/bootstrap/native';
import { AppProviders } from '@/bootstrap/providers';
import { useSession } from '@/domeinen/auth/ui';
import { SplashScreenView } from '@/shared/ui/splash-screen';
import { StatusOverlayHost } from '@/shared/ui/status-overlay-host';
import { colors } from '@/shared/ui/theme';
import { ToastHost } from '@/shared/ui/toast-host';

void SplashScreen.preventAutoHideAsync();

// Built once, when the app loads. A wrong configuration fails here, with a readable message.
const container = createNativeContainer();

// Screens must stay opaque: a transparent screen shows the previous one during the push animation.
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.surface },
};

/** Shows the login or the app, depending on the session. Stack.Protected does the navigating. */
function Navigator() {
  const status = useSession((state) => state.status);

  useEffect(() => {
    if (status !== 'unknown') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'unknown') {
    // Hide the native splash once this view is laid out, so there is no blank frame while the
    // session is still being restored.
    return (
      <SplashScreenView
        onLayout={() => {
          void SplashScreen.hideAsync();
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signed-in'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void container.start();
    return () => container.stop();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* No dark theme yet: dark icons on the light login screen; (app) switches to light. */}
      <StatusBar style="dark" />
      <AppProviders container={container}>
        <ThemeProvider value={navigationTheme}>
          <Navigator />
        </ThemeProvider>
        <ToastHost />
        <StatusOverlayHost />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
