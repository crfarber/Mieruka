import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenFooter } from './screen-footer';
import { colors, spacing } from './theme';

/**
 * A screen with a scrollable body. An optional footer sticks to the bottom and
 * owns the bottom safe area; without one, the SafeAreaView keeps that inset.
 * Top inset is skipped: the stack header already covers the status bar.
 * Set `scroll={false}` when a child owns scrolling (e.g. sticky search + list).
 */
export function Screen({
  children,
  footer,
  contentStyle,
  backgroundColor = colors.surface,
  scroll = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  /** Merged onto the default padded content container (e.g. full-bleed lists). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Page background. Keep it opaque: a transparent screen shows the previous one while pushing. */
  backgroundColor?: string;
  /** When false, the body fills the screen and does not scroll. */
  scroll?: boolean;
}) {
  const [footerHeight, setFooterHeight] = useState(0);
  const bodyStyle = [
    styles.content,
    contentStyle,
    footer ? { paddingBottom: footerHeight + spacing.md } : null,
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={footer ? [] : ['bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={bodyStyle}
          scrollIndicatorInsets={{ bottom: footer ? footerHeight : 0 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[bodyStyle, styles.fill]}>{children}</View>
      )}
      {footer ? (
        <View
          style={styles.footerOverlay}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <ScreenFooter>{footer}</ScreenFooter>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  fill: { flex: 1, minHeight: 0 },
  footerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
