import { describe, expect, it } from 'vitest';
import { defaultStackHeaderOptions, goBackOrReplace } from './navigation';
import { colors } from './theme';

function createNavigation(hasHistory: boolean) {
  const calls: string[] = [];
  return {
    calls,
    canGoBack: () => hasHistory,
    back: () => {
      calls.push('back');
    },
    replace: (route: string) => {
      calls.push(route);
    },
  };
}

describe('default stack header options', () => {
  it('uses a compact back button on the brand header', () => {
    expect(defaultStackHeaderOptions).toMatchObject({
      headerStyle: { backgroundColor: colors.brand },
      headerBackButtonDisplayMode: 'minimal',
      headerTintColor: colors.onBrand,
      headerTitleAlign: 'center',
    });
  });
});

describe('back navigation', () => {
  it('returns to the previous screen without opening another dashboard', () => {
    const navigation = createNavigation(true);

    goBackOrReplace(navigation, '/');

    expect(navigation.calls).toEqual(['back']);
  });

  it('returns to the actual previous screen rather than the settings fallback', () => {
    const navigation = createNavigation(true);

    goBackOrReplace(navigation, '/settings');

    expect(navigation.calls).toEqual(['back']);
  });

  it.each(['/', '/settings'])('replaces the route with %s only without history', (route) => {
    const navigation = createNavigation(false);

    goBackOrReplace(navigation, route);

    expect(navigation.calls).toEqual([route]);
  });
});
