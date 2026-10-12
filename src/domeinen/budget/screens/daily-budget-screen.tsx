import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { findAccount } from '@/domeinen/bunq';
import { useBunq, useMonetaryAccounts } from '@/domeinen/bunq/ui';
import { formatMoney } from '@/shared/money';
import { AlertBanner } from '@/shared/ui/alert-banner';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { colors, radius, spacing, type } from '@/shared/ui/theme';
import { dailyBudget } from '../domain/daily-budget';
import { useToday } from '../hooks/budget-context';

/**
 * The start screen: the balance of the chosen bunq account divided by the days left in the month.
 * Without a connection or a chosen account it says what to do first.
 */
export function DailyBudgetScreen() {
  const { t, i18n } = useTranslation();
  const status = useBunq((state) => state.status);
  const disconnectedReason = useBunq((state) => state.disconnectedReason);
  const selectedId = useBunq((state) => state.selectedAccountId);
  const accounts = useMonetaryAccounts();
  const today = useToday();
  const language = i18n.resolvedLanguage ?? 'nl';

  if (status === 'unknown') {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  if (status === 'disconnected') {
    return (
      <Screen>
        <Text style={styles.title}>{t('budget.connect.title')}</Text>
        <Text style={styles.body}>{t('budget.connect.body')}</Text>
        {disconnectedReason === 'refused' ? (
          <AlertBanner message={t('budget.connect.refused')} tone="warning" />
        ) : null}
        <Button label={t('budget.connect.action')} onPress={() => router.push('/bunq-connect')} />
      </Screen>
    );
  }

  const chooseAccount = (
    <Button
      label={t('budget.choose.action')}
      variant="secondary"
      onPress={() => router.push('/bunq-accounts')}
    />
  );

  if (selectedId === null) {
    return (
      <Screen>
        <Text style={styles.body}>{t('budget.choose.body')}</Text>
        {chooseAccount}
      </Screen>
    );
  }

  if (accounts.data === undefined) {
    return (
      <Screen>
        {accounts.isError ? (
          <>
            <AlertBanner message={t('budget.loadFailed')} />
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void accounts.refetch()}
              loading={accounts.isFetching}
            />
          </>
        ) : (
          <ActivityIndicator color={colors.brand} />
        )}
      </Screen>
    );
  }

  const account = findAccount(accounts.data, selectedId);
  if (account === null) {
    return (
      <Screen>
        <Text style={styles.body}>{t('budget.choose.missing')}</Text>
        {chooseAccount}
      </Screen>
    );
  }

  const budget = dailyBudget(account.balance, today);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={accounts.isRefetching}
          onRefresh={() => void accounts.refetch()}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      {accounts.isError ? <AlertBanner message={t('budget.loadFailed')} tone="warning" /> : null}
      <View style={styles.card}>
        {budget.kind === 'per-day' ? (
          <>
            <Text style={styles.label}>{t('budget.perDay')}</Text>
            <Text style={styles.amount} accessibilityRole="header">
              {formatMoney(budget.perDay, language)}
            </Text>
          </>
        ) : (
          <Text style={styles.body}>{t('budget.nothingLeft')}</Text>
        )}
        <Text style={styles.body}>
          {budget.daysLeft === 1
            ? t('budget.lastDay')
            : t('budget.daysLeft', { count: budget.daysLeft })}
        </Text>
      </View>
      <Text style={styles.balance}>
        {t('budget.balance', {
          amount: formatMoney(account.balance, language),
          account: account.description,
        })}
      </Text>
      {chooseAccount}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.header, color: colors.text },
  body: { ...type.body, color: colors.text },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  label: { ...type.label, color: colors.textMuted },
  amount: { fontSize: 44, lineHeight: 52, fontWeight: '700', color: colors.text },
  balance: { ...type.body, color: colors.textMuted, textAlign: 'center' },
});
