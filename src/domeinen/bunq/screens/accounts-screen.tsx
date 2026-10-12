import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '@/shared/money';
import { AlertBanner } from '@/shared/ui/alert-banner';
import { Button } from '@/shared/ui/button';
import { confirm } from '@/shared/ui/confirm';
import { goBackOrReplace } from '@/shared/ui/navigation';
import { Screen } from '@/shared/ui/screen';
import { useStatusOverlay } from '@/shared/ui/status-overlay-host';
import { colors, spacing, type } from '@/shared/ui/theme';
import { AccountRow } from '../components/account-row';
import { selectableAccounts } from '../domain/accounts';
import {
  useAccountChoice,
  useBunq,
  useBunqConnection,
  useMonetaryAccounts,
} from '../hooks/bunq-context';

/** Pick the account the budget is about. Also the place to disconnect from bunq. */
export function BunqAccountsScreen() {
  const { t, i18n } = useTranslation();
  const accounts = useMonetaryAccounts();
  const selectedId = useBunq((state) => state.selectedAccountId);
  const accountChoice = useAccountChoice();
  const connection = useBunqConnection();
  const statusOverlay = useStatusOverlay();
  const [disconnecting, setDisconnecting] = useState(false);

  const language = i18n.resolvedLanguage ?? 'nl';
  const choices = selectableAccounts(accounts.data ?? []);

  const choose = (accountId: number): void => {
    void accountChoice.choose(accountId);
    goBackOrReplace(router, '/');
  };

  const disconnect = async (): Promise<void> => {
    const sure = await confirm({
      title: t('bunq.accounts.disconnectTitle'),
      message: t('bunq.accounts.disconnectMessage'),
      confirmLabel: t('bunq.accounts.disconnect'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!sure) {
      return;
    }
    setDisconnecting(true);
    try {
      await statusOverlay.run(t('bunq.accounts.disconnecting'), async () => {
        await connection.disconnect();
        return { tone: 'none' };
      });
      goBackOrReplace(router, '/');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button
          label={t('bunq.accounts.disconnect')}
          variant="secondary"
          onPress={() => void disconnect()}
          loading={disconnecting}
        />
      }
    >
      <Text style={styles.hint}>{t('bunq.accounts.hint')}</Text>
      {accounts.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {accounts.isError && accounts.data === undefined ? (
        <View style={styles.padded}>
          <AlertBanner message={t('bunq.accounts.loadFailed')} />
          <Button
            label={t('common.retry')}
            variant="secondary"
            onPress={() => void accounts.refetch()}
            loading={accounts.isFetching}
          />
        </View>
      ) : null}
      {accounts.isSuccess && choices.length === 0 ? (
        <Text style={[styles.hint, styles.padded]}>{t('bunq.accounts.empty')}</Text>
      ) : null}
      {choices.length > 0 ? (
        <View style={styles.list}>
          {choices.map((account, index) => (
            <AccountRow
              key={account.id}
              name={account.description}
              iban={account.iban}
              balance={formatMoney(account.balance, language)}
              selected={account.id === selectedId}
              onPress={() => choose(account.id)}
              showDivider={index < choices.length - 1}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0 },
  hint: { ...type.body, color: colors.textMuted, paddingHorizontal: spacing.md },
  padded: { paddingHorizontal: spacing.md, gap: spacing.md },
  list: { backgroundColor: colors.background },
});
