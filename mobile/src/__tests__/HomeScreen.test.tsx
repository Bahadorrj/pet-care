/**
 * HomeScreen tests
 *
 * Verifies:
 * - Logo renders (via testID)
 * - App name renders in Farsi
 * - No auth/profile button is present on the screen
 *
 * expo-secure-store is mocked to prevent native module access (authStore calls
 * hydrate() at module load which hits SecureStore).
 * i18n is imported to initialise the i18n instance before rendering.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Must come before authStore is imported — authStore calls hydrate() at module
// load which calls expo-secure-store synchronously.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import '../i18n';
import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen – brand-only', () => {
  test('renders the logo image', async () => {
    await render(<HomeScreen />);
    expect(screen.getByTestId('home-logo')).toBeTruthy();
  });

  test('renders the app name in Farsi', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('پت‌کر')).toBeTruthy();
  });

  test('does not render the sign-in/sign-up button', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText('ورود / ثبت‌نام')).toBeNull();
  });

  test('does not render the profile button', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText('پروفایل')).toBeNull();
  });
});
