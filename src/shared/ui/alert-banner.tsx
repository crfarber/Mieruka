import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from './theme';

const tones = {
  danger: { accent: colors.danger, surface: colors.dangerSurface, icon: 'alert-circle' },
  warning: { accent: colors.danger, surface: colors.warningSurface, icon: 'warning' },
} as const;

type AlertTone = keyof typeof tones;

/** A message the user must not miss: an error after submitting, or why an action is blocked. */
export function AlertBanner({ message, tone = 'danger' }: { message: string; tone?: AlertTone }) {
  const { accent, surface, icon } = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.banner, { backgroundColor: surface, borderLeftColor: accent }]}
    >
      <Ionicons name={icon} size={28} color={accent} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  text: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
});
