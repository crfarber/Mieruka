import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { AlertBanner } from '@/shared/ui/alert-banner';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { useScheduler } from '@/shared/ui/scheduler-context';
import { useStatusOverlay } from '@/shared/ui/status-overlay-host';
import { TextField } from '@/shared/ui/text-field';
import { colors, type } from '@/shared/ui/theme';
import { describeConnectFailure } from '../domain/connection';
import { useBunqConnection } from '../hooks/bunq-context';

/** Long enough for the status screen to be on screen before key generation blocks the JS thread. */
const PAINT_DELAY_MS = 100;

/** Asks for an API key from the bunq app and connects with it. Then the user picks an account. */
export function BunqConnectScreen() {
  const { t } = useTranslation();
  const connection = useBunqConnection();
  const statusOverlay = useStatusOverlay();
  const scheduler = useScheduler();
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await statusOverlay.run(t('bunq.connect.processing'), async () => {
        await new Promise<void>((resolve) => {
          scheduler.schedule(resolve, PAINT_DELAY_MS);
        });
        const result = await connection.connect(apiKey);
        if (result.ok) {
          setApiKey('');
          router.replace('/bunq-accounts');
          return { tone: 'success', message: t('bunq.connect.connected') };
        }
        const key = describeConnectFailure(result.error);
        const reason = result.error.kind === 'refused' ? result.error.reason : null;
        setMessage(
          key === null
            ? null
            : [t(key), reason === null ? null : t('bunq.connect.errors.bunqSays', { reason })]
                .filter((line) => line !== null)
                .join('\n'),
        );
        return { tone: 'none' };
      });
    } catch {
      setMessage(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button label={t('bunq.connect.submit')} onPress={() => void connect()} loading={busy} />
      }
    >
      <Text style={styles.body}>{t('bunq.connect.intro')}</Text>
      <Text style={styles.body}>{t('bunq.connect.howTo')}</Text>
      <TextField
        label={t('bunq.connect.apiKey')}
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        editable={!busy}
      />
      {message ? <AlertBanner message={message} /> : null}
      <Text style={styles.hint}>{t('bunq.connect.warning')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.text },
  hint: { ...type.small, color: colors.textMuted },
});
