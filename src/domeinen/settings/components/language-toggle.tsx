import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGES, type Language } from '@/shared/i18n/resources';
import { colors, radius, spacing } from '@/shared/ui/theme';

const NAME_KEY = {
  nl: 'settings.language.nl',
  en: 'settings.language.en',
} as const;

/** Two segments, NL and EN. The selected one is filled; a tap switches at once. */
export function LanguageToggle({
  value,
  onChange,
}: {
  value: Language;
  onChange: (language: Language) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{t('settings.language.title')}</Text>
      <View accessibilityRole="radiogroup" style={styles.track}>
        {LANGUAGES.map((language) => {
          const selected = language === value;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityLabel={t(NAME_KEY[language])}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (!selected) {
                  onChange(language);
                }
              }}
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.segment,
                selected && styles.segmentSelected,
                pressed && !selected && styles.segmentPressed,
              ]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {language.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    minWidth: 56,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.brand },
  segmentPressed: { opacity: 0.6 },
  label: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.onBrand },
});
