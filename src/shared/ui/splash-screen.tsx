import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from './theme';

type SplashScreenViewProps = {
  /** Called once the view has a size, so the native splash can hide without a blank frame. */
  onLayout?: () => void;
};

/**
 * Shown while the session is being restored. Same color as the native splash
 * (`expo-splash-screen` in `app.config.ts`), so the hand-over is invisible. Replace it with the
 * project's own launch view when it needs more than a color.
 */
export function SplashScreenView({ onLayout }: SplashScreenViewProps) {
  return (
    <View style={styles.root} onLayout={onLayout}>
      <ActivityIndicator color={colors.onBrand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
});
