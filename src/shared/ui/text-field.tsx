import type { Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from './theme';

type TextFieldProps = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'keyboardType'
  | 'autoComplete'
  | 'textContentType'
  | 'maxLength'
  | 'editable'
  | 'placeholder'
  | 'accessibilityLabel'
  | 'multiline'
  | 'onFocus'
  | 'onBlur'
  | 'autoCapitalize'
> & {
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  inputRef?: Ref<TextInput>;
};

export function TextField({
  label,
  error,
  containerStyle,
  accessibilityLabel,
  inputRef,
  ...input
}: TextFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel ?? label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          input.multiline ? styles.multiline : null,
          error ? styles.inputError : null,
        ]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 14 },
});
