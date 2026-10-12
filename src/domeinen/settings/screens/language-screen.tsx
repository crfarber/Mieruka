import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { LANGUAGES } from '@/shared/i18n/resources';
import { Screen } from '@/shared/ui/screen';
import { colors, spacing } from '@/shared/ui/theme';
import { LanguageToggle } from '../components/language-toggle';
import { useLanguageSettings } from '../hooks/settings-context';

/** Pick NL or EN; the choice applies immediately and is stored. */
export function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const languageSettings = useLanguageSettings();
  const language = LANGUAGES.find((candidate) => candidate === i18n.resolvedLanguage) ?? 'nl';

  return (
    <Screen>
      <Text style={styles.hint}>{t('settings.language.hint')}</Text>
      <LanguageToggle value={language} onChange={(next) => void languageSettings.choose(next)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm },
});
