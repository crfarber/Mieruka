import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthService, useSession } from '@/domeinen/auth/ui';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { useStatusOverlay } from '@/shared/ui/status-overlay-host';
import { colors, spacing } from '@/shared/ui/theme';
import { SettingsMenuRow } from '../components/settings-menu-row';

const appVersion = Constants.expoConfig?.version ?? '';

type MenuItem = {
  key: string;
  labelKey: 'settings.language.title' | 'support.open' | 'debug.open';
  route: '/language' | '/support' | '/debug';
  icon: keyof typeof Ionicons.glyphMap;
  devOnly?: boolean;
};

const MENU_ITEMS: readonly MenuItem[] = [
  {
    key: 'language',
    labelKey: 'settings.language.title',
    route: '/language',
    icon: 'globe-outline',
  },
  { key: 'support', labelKey: 'support.open', route: '/support', icon: 'document-text-outline' },
  { key: 'debug', labelKey: 'debug.open', route: '/debug', icon: 'bug-outline', devOnly: true },
];

/** A general menu (language, support, debug in dev builds) and the app version above sign-out. */
export function SettingsScreen() {
  const { t } = useTranslation();
  const authService = useAuthService();
  const statusOverlay = useStatusOverlay();
  const method = useSession((state) => state.method);
  const [signingOut, setSigningOut] = useState(false);

  const visibleItems = MENU_ITEMS.filter((item) => item.devOnly !== true || __DEV__);

  const signOut = async (): Promise<void> => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await statusOverlay.run(t('feedback.processing.signOut'), async () => {
        await authService.signOut();
        return { tone: 'none' };
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button
          label={t('common.signOut')}
          variant="danger"
          onPress={() => void signOut()}
          loading={signingOut}
        />
      }
    >
      <Text style={styles.section}>{t('settings.section.general')}</Text>
      <View style={styles.list}>
        {visibleItems.map((item, index) => (
          <SettingsMenuRow
            key={item.key}
            label={t(item.labelKey)}
            icon={<Ionicons name={item.icon} size={20} color={colors.text} />}
            onPress={() => router.push(item.route)}
            showDivider={index < visibleItems.length - 1}
          />
        ))}
      </View>
      <View style={styles.versionWrap}>
        <Text style={styles.version}>
          {method === null
            ? appVersion
            : t('settings.version', { version: appVersion, method: t(`login.method.${method}`) })}
        </Text>
      </View>
    </Screen>
  );
}

/** Cog in the stack header; opens the settings screen. */
export function SettingsHeaderButton() {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings.open')}
      onPress={() => router.push('/settings')}
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
      hitSlop={spacing.sm}
    >
      <Ionicons name="cog-outline" size={24} color={colors.onBrand} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, gap: 0 },
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  list: { backgroundColor: colors.background },
  versionWrap: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  version: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  headerButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerButtonPressed: { opacity: 0.6 },
});
