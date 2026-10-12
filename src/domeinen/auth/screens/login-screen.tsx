import { useState } from 'react';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/button';
import { colors, radius, spacing, type } from '@/shared/ui/theme';
import { describeLoginFailure } from '../domain/login-failures';
import { useAuthService, useSession } from '../hooks/auth-context';

const appName = Constants.expoConfig?.name ?? '';
const appVersion = Constants.expoConfig?.version;

/** One button that signs in with the method of this build. The navigation follows the session. */
export function LoginScreen() {
  const { t } = useTranslation();
  const authService = useAuthService();
  const sessionExpired = useSession((state) => state.signedOutReason === 'expired');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setMessage(null);
    const result = await authService.signIn();
    setBusy(false);
    if (!result.ok) {
      const key = describeLoginFailure(result.error);
      setMessage(key === null ? null : t(key));
    }
    // On success the session changes and the navigation moves on by itself.
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{appName}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
      </View>
      <View style={styles.actions}>
        {sessionExpired ? (
          <View style={styles.noticeBox}>
            <Text style={styles.notice}>{t('login.sessionExpired')}</Text>
          </View>
        ) : null}
        {message ? (
          <View style={styles.noticeBox}>
            <Text accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          </View>
        ) : null}
        {authService.method === 'demo' ? (
          <Text style={styles.hint}>{t('login.demoHint')}</Text>
        ) : null}
        <Button label={t('login.signIn')} onPress={() => void signIn()} loading={busy} />
        {appVersion ? (
          <Text style={styles.version}>{t('login.version', { version: appVersion })}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  header: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  title: { ...type.large, color: colors.text, textAlign: 'center' },
  subtitle: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  actions: { gap: spacing.md },
  noticeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notice: { ...type.body, color: colors.text, textAlign: 'center' },
  error: { ...type.body, color: colors.danger, textAlign: 'center' },
  hint: { ...type.small, color: colors.textMuted, textAlign: 'center' },
  version: { ...type.small, color: colors.textMuted, textAlign: 'center' },
});
