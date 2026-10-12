import * as ExpoHaptics from 'expo-haptics';
import type { Haptics, HapticTone } from '../ports';

const STYLE: Record<HapticTone, ExpoHaptics.NotificationFeedbackType> = {
  success: ExpoHaptics.NotificationFeedbackType.Success,
  warning: ExpoHaptics.NotificationFeedbackType.Warning,
  error: ExpoHaptics.NotificationFeedbackType.Error,
};

/** Short vibration via Expo. Failures are ignored — haptics must never break a flow. */
export function createExpoHaptics(): Haptics {
  return {
    notify(tone) {
      void ExpoHaptics.notificationAsync(STYLE[tone]).catch(() => {
        // Device without a motor, or the call failed — nothing to do.
      });
    },
  };
}
