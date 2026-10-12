import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors, spacing } from './theme';

type RadioButtonProps = {
  selected: boolean;
  label?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function RadioButton({
  selected,
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
  labelStyle,
}: RadioButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, style, pressed && !disabled && styles.pressed]}
    >
      <View
        style={[styles.outer, selected && styles.outerSelected, disabled && styles.outerDisabled]}
      >
        {selected ? <View style={styles.inner} /> : null}
      </View>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  outer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  outerSelected: {
    borderColor: colors.text,
  },
  outerDisabled: {
    opacity: 0.5,
  },
  inner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
