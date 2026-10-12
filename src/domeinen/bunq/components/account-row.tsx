import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/shared/ui/theme';

/** One account to choose: radio, name and IBAN, balance. */
export function AccountRow({
  name,
  iban,
  balance,
  selected,
  onPress,
  showDivider,
}: {
  name: string;
  iban: string | null;
  balance: string;
  selected: boolean;
  onPress: () => void;
  showDivider: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${name}, ${balance}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <View style={styles.texts}>
          <Text style={styles.name}>{name}</Text>
          {iban ? <Text style={styles.iban}>{iban}</Text> : null}
        </View>
        <Text style={styles.balance}>{balance}</Text>
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.7 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.text },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
  texts: { flex: 1, gap: spacing.xs },
  name: { ...type.label, color: colors.text },
  iban: { ...type.small, color: colors.textMuted },
  balance: { ...type.label, color: colors.text },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
});
