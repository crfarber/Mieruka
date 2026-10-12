import { Ionicons } from '@expo/vector-icons';
import { useStore } from 'zustand';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StatusOverlay, StatusView } from '@/shared/feedback/status-overlay';
import { Button } from './button';
import { colors, spacing } from './theme';

const StatusOverlayContext = createContext<StatusOverlay | null>(null);

export function StatusOverlayProvider({
  value,
  children,
}: {
  value: StatusOverlay;
  children: ReactNode;
}) {
  return <StatusOverlayContext.Provider value={value}>{children}</StatusOverlayContext.Provider>;
}

export function useStatusOverlay(): StatusOverlay {
  const overlay = useContext(StatusOverlayContext);
  if (overlay === null) {
    throw new Error('useStatusOverlay must be used within a StatusOverlayProvider');
  }
  return overlay;
}

const PHASE_BACKGROUND: Record<StatusView['phase'], string> = {
  processing: colors.action,
  success: colors.success,
  queued: colors.warning,
  error: colors.danger,
};

/**
 * Full-screen blocking status. Lives in the root layout so it survives navigation (e.g. submit
 * then exit). Tap dismisses success/queued early; error stays until close or retry.
 */
export function StatusOverlayHost() {
  const overlay = useStatusOverlay();
  const current = useStore(overlay.store, (state) => state.current);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useEffect(() => {
    if (current === null) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [current]);

  if (current === null) {
    return null;
  }

  const background = PHASE_BACKGROUND[current.phase];
  const announce =
    current.phase === 'processing' && current.slow
      ? `${current.message}. ${t('feedback.takingLonger')}`
      : current.message;

  return (
    <View
      accessibilityViewIsModal
      pointerEvents="auto"
      style={[
        styles.host,
        {
          backgroundColor: background,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
      onLayout={() => {
        AccessibilityInfo.announceForAccessibility(announce);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={announce}
        disabled={current.phase === 'processing' || current.phase === 'error'}
        onPress={() => {
          if (current.phase === 'success' || current.phase === 'queued') {
            overlay.dismiss();
          }
        }}
        style={styles.content}
      >
        {current.phase === 'processing' ? (
          <ActivityIndicator color={colors.background} size="large" />
        ) : null}
        {current.phase === 'success' ? (
          <Ionicons name="checkmark-circle" size={72} color={colors.background} />
        ) : null}
        {current.phase === 'queued' ? (
          <Ionicons name="cloud-offline" size={72} color={colors.onWarning} />
        ) : null}
        {current.phase === 'error' ? (
          <Ionicons name="alert-circle" size={72} color={colors.background} />
        ) : null}
        <Text
          style={[
            styles.message,
            current.phase === 'queued' ? styles.messageOnWarning : styles.messageOnDark,
          ]}
        >
          {current.message}
        </Text>
        {current.phase === 'processing' && current.slow ? (
          <Text style={[styles.slow, styles.messageOnDark]}>{t('feedback.takingLonger')}</Text>
        ) : null}
      </Pressable>
      {current.phase === 'error' ? (
        <View style={styles.actions}>
          {current.retry !== undefined ? (
            <Button
              label={t('common.retry')}
              onPress={() => {
                const retry = current.retry;
                overlay.dismiss();
                retry?.();
              }}
            />
          ) : null}
          <Button label={t('common.close')} variant="secondary" onPress={() => overlay.dismiss()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 20000,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  message: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageOnDark: { color: colors.background },
  messageOnWarning: { color: colors.onWarning },
  slow: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  actions: { gap: spacing.sm },
});
