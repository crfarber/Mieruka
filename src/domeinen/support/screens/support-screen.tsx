import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { colors } from '@/shared/ui/theme';
import { SUPPORT_LOG_HEADER } from '../domain/export';
import { useSupportLog } from '../hooks/support-context';

/** The last day of log lines, already redacted, for the user to send to support. */
export function SupportScreen() {
  const { t } = useTranslation();
  const log = useSupportLog();
  const [text] = useState(() => log.text());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const share = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await log.share();
    } catch {
      setMessage(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.hint}>{t('support.hint')}</Text>
      <Button label={t('support.share')} onPress={() => void share()} loading={busy} />
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
      <Text selectable style={styles.log}>
        {text.trim() === SUPPORT_LOG_HEADER ? t('support.empty') : text}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 15, color: colors.textMuted },
  error: { fontSize: 14, color: colors.danger },
  log: { fontSize: 13, color: colors.text },
});
