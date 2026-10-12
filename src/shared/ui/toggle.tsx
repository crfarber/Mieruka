import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, type } from './theme';

type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Toggle({
  value,
  onValueChange,
  label,
  accessibilityLabel,
  disabled = false,
  style,
}: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.row,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {label ? <Text style={[type.label, styles.label]}>{label}</Text> : null}
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const TRACK_W = 40;
const TRACK_H = 24;
const THUMB = 18;
const PAD = 3;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  label: { flex: 1, color: colors.text },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: PAD,
  },
  trackOn: { backgroundColor: colors.text }, // ink
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.background,
    alignSelf: 'flex-start',
  },
  thumbOn: {
    backgroundColor: colors.brand,
    alignSelf: 'flex-end',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
