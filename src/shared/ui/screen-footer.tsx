import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';

/** Sticky action bar at the bottom of a screen. It owns the bottom safe area. */
export function ScreenFooter({
  children,
  backgroundColor = colors.background,
}: {
  children: ReactNode;
  backgroundColor?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { backgroundColor, paddingBottom: spacing.md + insets.bottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
