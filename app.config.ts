import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Project identity. A new project changes these values (and the colors in `src/shared/ui/theme.ts`
 * plus the images in `assets/images/`). Every variant derives its name, id and scheme from here.
 */
const APP = {
  name: 'Expo Boilerplate',
  slug: 'expo-boilerplate',
  /** Reverse-DNS base for the iOS bundle identifier and the Android package. */
  id: 'com.example.expoboilerplate',
  scheme: 'expo-boilerplate',
  version: '1.0.0',
  /** Same as `colors.brand` in the theme, so the native splash and the JS splash match. */
  brandColor: '#1F6FEB',
} as const;

/**
 * Custom URL scheme for the OAuth redirect (Azure AD sign-in, docs/decisions/0012). It identifies
 * the redirect, not the variant, so it is the same in every environment. Register it in the App
 * Registration; EXPO_PUBLIC_AZURE_AD_REDIRECT_URL must match it.
 */
const AUTH_REDIRECT_URL = `${APP.id}.auth://login/`;

/**
 * One codebase, three variants (internal, acceptance, production) that can be installed side by
 * side. The variant comes from APP_VARIANT, set per build profile in eas.json. That means no native
 * flavors, no react-native-config and no custom plugin (docs/decisions/0009).
 */
type Variant = 'internal' | 'acceptance' | 'production';

const VARIANTS: Record<Variant, { name: string; id: string; scheme: string }> = {
  internal: {
    name: `${APP.name} Intern`,
    id: `${APP.id}.internal`,
    scheme: `${APP.scheme}-internal`,
  },
  acceptance: {
    name: `${APP.name} Acceptatie`,
    id: `${APP.id}.acceptance`,
    scheme: `${APP.scheme}-acceptance`,
  },
  production: { name: APP.name, id: APP.id, scheme: APP.scheme },
};

function resolveVariant(value: string | undefined): Variant {
  return value === 'acceptance' || value === 'production' ? value : 'internal';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant(process.env.APP_VARIANT);
  const { name, id, scheme } = VARIANTS[variant];
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  return {
    ...config,
    name,
    slug: APP.slug,
    version: APP.version,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme,
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: id,
      supportsTablet: false,
    },
    android: {
      package: id,
      adaptiveIcon: {
        backgroundColor: APP.brandColor,
        foregroundImage: './assets/images/adaptive-icon.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-sqlite',
      // Registers the native URL scheme for the OAuth redirect (docs/decisions/0012).
      ['react-native-app-auth', { redirectUrls: [AUTH_REDIRECT_URL] }],
      // Xcode 27 builds crash on iOS 27 unless the app adopts the UIScene life cycle, which SDK 57
      // only does on request. SDK 58 has it in the template: remove this then (docs/decisions/0011).
      // Must run AFTER react-native-app-auth: its own AppDelegate patch only recognizes the
      // pristine template class line, and each plugin's mod runs in the opposite of this array's
      // order.
      ['expo-build-properties', { ios: { enableSceneSupport: true } }],
      [
        'expo-splash-screen',
        {
          backgroundColor: APP.brandColor,
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      variant,
      // Written by `eas init`. Not a secret. Only needed for EAS Build/Update.
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
