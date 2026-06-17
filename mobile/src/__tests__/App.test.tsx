/**
 * App entry-point smoke test.
 *
 * Regression guard: App.tsx shipped as the untouched Expo scaffold, leaving the
 * navigator, i18n init, and hydration gate as dead code never reached at runtime.
 * This asserts the live entry point actually renders the branded HomeScreen.
 *
 * expo-secure-store is mocked (authStore.hydrate() hits it at module load); a
 * null token resolves hydration to the guest state.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Must precede the App import — App transitively imports authStore, which calls
// hydrate() at module load and touches SecureStore synchronously.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// SafeAreaProvider gates its children on an onLayout event that never fires in
// jest, leaving the tree empty. Pass insets through so the navigator renders.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import App from '../../App';

test('renders the branded HomeScreen after hydration, not the scaffold', async () => {
  // render must be awaited for screen to bind under this RNTL/jest-expo setup.
  await render(<App />);
  // App name appears once hydration completes and the navigator mounts Home.
  expect(await screen.findByText('پت‌کر')).toBeTruthy();
  expect(screen.queryByText(/Open up App\.tsx/)).toBeNull();
});
