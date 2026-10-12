import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardOverlap, sheetSizeAboveKeyboard, type SheetSize } from './sheet-keyboard';
import { colors, radius, spacing } from './theme';

/**
 * Top of the keyboard while this sheet is open. `undefined` until the first observation,
 * `null` once the keyboard is known to be hidden.
 */
function useKeyboardScreenY(visible: boolean): number | null {
  const [screenY, setScreenY] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillShow', 'keyboardDidShow'] as const)
        : (['keyboardDidShow'] as const);
    const hideEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillHide', 'keyboardDidHide'] as const)
        : (['keyboardDidHide'] as const);
    const show = showEvents.map((eventName) =>
      Keyboard.addListener(eventName, (event: KeyboardEvent) => {
        Keyboard.scheduleLayoutAnimation(event);
        setScreenY(event.endCoordinates.screenY);
      }),
    );
    const hide = hideEvents.map((eventName) =>
      Keyboard.addListener(eventName, (event: KeyboardEvent) => {
        Keyboard.scheduleLayoutAnimation(event);
        setScreenY(null);
      }),
    );

    return () => {
      for (const subscription of [...show, ...hide]) {
        subscription.remove();
      }
      setScreenY(undefined);
    };
  }, [visible]);

  if (!visible) {
    return null;
  }
  if (screenY !== undefined) {
    return screenY;
  }
  return Keyboard.metrics()?.screenY ?? null;
}

/**
 * Generic bottom sheet: dimmed backdrop, sliding panel, title and a close control.
 * Domain sheets (select, service decline) compose on top of this.
 * The panel lifts above the keyboard so a search field does not cover the choices.
 */
export function BottomSheet({
  visible,
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
  footer,
  height,
}: {
  visible: boolean;
  title: string;
  /** Optional line(s) under the title, e.g. last-updated timestamps. */
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  height?: SheetSize;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardScreenY = useKeyboardScreenY(visible);
  const keyboardInset = keyboardOverlap(windowHeight, keyboardScreenY);
  const aboveKeyboard = keyboardInset > 0;
  const limit = sheetSizeAboveKeyboard({
    windowHeight,
    keyboardInset,
    topInset: insets.top,
    requested: height,
  });
  const sized = height !== undefined;
  const fill = sized || aboveKeyboard;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <SafeAreaView
          style={[
            styles.sheet,
            aboveKeyboard ? { marginBottom: keyboardInset, overflow: 'hidden' } : null,
            fill ? { height: limit, maxHeight: limit } : styles.maxHeight,
          ]}
          edges={aboveKeyboard ? [] : ['bottom']}
        >
          <View style={fill ? styles.sheetColumn : undefined}>
            <View style={styles.sheetHeader}>
              <View style={styles.titleBlock}>
                <Text style={styles.sheetTitle}>{title}</Text>
                {subtitle !== undefined && subtitle !== null ? (
                  typeof subtitle === 'string' || typeof subtitle === 'number' ? (
                    <Text style={styles.sheetSubtitle}>{subtitle}</Text>
                  ) : (
                    subtitle
                  )
                ) : null}
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={spacing.md}>
                <Text style={styles.closeLabel}>{closeLabel}</Text>
              </Pressable>
            </View>
            <View style={[styles.body, fill && styles.bodySized]}>{children}</View>
            {footer !== undefined ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
    width: '100%',
  },
  sheetColumn: { flex: 1 },
  maxHeight: { maxHeight: '80%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  titleBlock: { flex: 1, gap: spacing.xs },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  closeLabel: { color: colors.textMuted, fontSize: 16, fontWeight: '600', marginTop: 2 },
  body: { flexShrink: 1, minHeight: 0 },
  bodySized: { flex: 1, minHeight: 0 },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
});
