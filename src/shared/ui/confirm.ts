import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Marks the confirm button as destructive (red on iOS). */
  destructive?: boolean;
};

/**
 * One yes/no decision. Resolves `true` on confirm, `false` on cancel or Android back/dismiss.
 * Prefer this over calling `Alert.alert` directly so hooks stay promise-based.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        {
          text: options.cancelLabel,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirmLabel,
          style: options.destructive === true ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export type ChooseOption<T extends string> = {
  id: T;
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
};

export type ChooseOptions<T extends string> = {
  title: string;
  message?: string;
  options: readonly ChooseOption<T>[];
};

/**
 * Three-or-more button choice. Resolves the option id, or `null` when the sheet is dismissed
 * without a pick (Android back). Use for "Save draft / Discard / Cancel".
 */
export function choose<T extends string>(options: ChooseOptions<T>): Promise<T | null> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      options.options.map((option) => ({
        text: option.label,
        style: option.style ?? 'default',
        onPress: () => resolve(option.id),
      })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
