/**
 * RootNavigator tests
 *
 * Verifies:
 * - Both tab labels render in Farsi ("خانه" and "پروفایل").
 * - Home tab is the default/active tab on first render (home-logo testID visible).
 *
 * expo-secure-store is mocked to prevent native module access (authStore calls
 * hydrate() at module load which hits SecureStore).
 * i18n is imported to initialise the i18n instance before rendering.
 * NavigationContainer wraps RootNavigator as in App.tsx.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Minimal insets so SafeAreaProvider renders children without waiting for the
// native onInsetsChange callback (which never fires in the jest environment).
const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, bottom: 0, right: 0 },
};

// Must come before authStore is imported — authStore calls hydrate() at module
// load which calls expo-secure-store synchronously.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import '../i18n';
import { useAuthStore } from '../store/authStore';
import RootNavigator from '../navigation/RootNavigator';

beforeEach(() => {
  // Reset to guest state before each test.
  useAuthStore.setState({ isAuthenticated: false, token: null, email: null });
});

function renderNavigator() {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

describe('RootNavigator', () => {
  test('renders the Home tab label in Farsi', async () => {
    renderNavigator();
    await waitFor(() => expect(screen.getByText('خانه')).toBeTruthy());
  });

  test('renders the Profile tab label in Farsi', async () => {
    renderNavigator();
    await waitFor(() => expect(screen.getByText('پروفایل')).toBeTruthy());
  });

  test('Home tab is active by default (home-logo testID is present)', async () => {
    renderNavigator();
    await waitFor(() => expect(screen.getByTestId('home-logo')).toBeTruthy());
  });
});
