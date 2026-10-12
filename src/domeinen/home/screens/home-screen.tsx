import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/shared/ui/screen';
import { colors, type } from '@/shared/ui/theme';

/** The first screen after signing in. Replace it with the project's own start screen. */
export function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={styles.body}>{t('home.body')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.header, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
});
