import { useStore } from 'zustand';
import { createContext, useContext, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ToastQueue, ToastTone } from '@/shared/feedback/toast-queue';
import { colors, radius, spacing } from './theme';

const FeedbackContext = createContext<ToastQueue | null>(null);

export function FeedbackProvider({ value, children }: { value: ToastQueue; children: ReactNode }) {
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): ToastQueue {
  const queue = useContext(FeedbackContext);
  if (queue === null) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return queue;
}

const TONE_STYLE: Record<ToastTone, { background: string; text: string }> = {
  success: { background: colors.success, text: colors.background },
  warning: { background: colors.warning, text: colors.onWarning },
  error: { background: colors.danger, text: colors.background },
  info: { background: colors.inverseSurface, text: colors.onInverseSurface },
};

/**
 * Renders the current toast at the top of the screen. Lives in the root layout so it survives
 * navigation (e.g. after submit → exit). Tap dismisses early.
 */
export function ToastHost() {
  const queue = useFeedback();
  const toast = useStore(queue.store, (state) => state.current);
  const insets = useSafeAreaInsets();

  if (toast === null) {
    return null;
  }

  const tone = TONE_STYLE[toast.tone];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + spacing.sm }]}
      onLayout={() => {
        AccessibilityInfo.announceForAccessibility(toast.message);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toast.message}
        onPress={() => queue.dismiss()}
        style={[styles.toast, { backgroundColor: tone.background }]}
      >
        <Text style={[styles.message, { color: tone.text }]}>{toast.message}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  toast: {
    minHeight: 48,
    maxWidth: 480,
    width: '100%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  message: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
