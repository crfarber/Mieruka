/**
 * Design tokens. Screens use these, never loose colors or sizes. A new project changes the values
 * here (and the splash/icon colors in `app.config.ts`); the names say what a color is FOR, so the
 * components keep working: `onX` is text or an icon on top of `X`.
 */
export const colors = {
  /** Primary color: header, primary button, active toggle. */
  brand: '#1F6FEB',
  onBrand: '#FFFFFF',
  /** Links, text buttons and the "processing" state. */
  action: '#1F6FEB',
  onAction: '#FFFFFF',
  /** Dark surfaces, for example an info toast. */
  inverseSurface: '#24292F',
  onInverseSurface: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F6F8FA',
  buttonLight: '#FFFFFF',
  inputFill: '#EFF2F5',
  text: '#1F2328',
  textMuted: '#656D76',
  border: '#D0D7DE',
  danger: '#CF222E',
  dangerSurface: '#FFEBE9',
  warning: '#D4A72C',
  onWarning: '#1F2328',
  warningSurface: '#FFF8C5',
  success: '#1A7F37',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, xxl: 24 } as const;

/** iOS Dynamic Type at the default Large size. Sizes are points. */
export const type = {
  small: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  header: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  large: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
} as const;
