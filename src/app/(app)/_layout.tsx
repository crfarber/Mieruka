import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { SettingsHeaderButton } from '@/domeinen/settings/ui';
import { defaultStackHeaderOptions } from '@/shared/ui/navigation';

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <>
      {/* Light icons on the brand-colored header. */}
      <StatusBar style="light" />
      <Stack screenOptions={defaultStackHeaderOptions}>
        <Stack.Screen
          name="index"
          options={{ title: t('home.title'), headerRight: () => <SettingsHeaderButton /> }}
        />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="language" options={{ title: t('settings.language.title') }} />
        <Stack.Screen name="support" options={{ title: t('support.title') }} />
        <Stack.Screen name="debug" options={{ title: t('debug.title') }} />
      </Stack>
    </>
  );
}
