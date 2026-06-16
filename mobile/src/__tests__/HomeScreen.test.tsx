/**
 * HomeScreen tests
 *
 * Verifies:
 * - Logo renders (via testID)
 * - App name renders in Farsi
 * - Guest state: button shows "ورود / ثبت‌نام" and navigates to Signin on press
 * - Auth state: button shows "پروفایل"
 *
 * expo-secure-store is mocked to prevent native module access (authStore calls
 * hydrate() at module load which hits SecureStore).
 * Navigation is mocked so we can assert navigate() calls without a real Navigator.
 * i18n is imported to initialise the i18n instance before rendering.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Must come before authStore is imported — authStore calls hydrate() at module
// load which calls expo-secure-store synchronously.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import '../i18n';
import { useAuthStore } from '../store/authStore';
import HomeScreen from '../screens/HomeScreen';

beforeEach(() => {
  mockNavigate.mockClear();
  // Reset to guest state before each test.
  useAuthStore.setState({ isAuthenticated: false, token: null, email: null });
});

describe('HomeScreen – guest state', () => {
  test('renders the logo image', async () => {
    await render(<HomeScreen />);
    expect(screen.getByTestId('home-logo')).toBeTruthy();
  });

  test('renders the app name in Farsi', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('پت‌کر')).toBeTruthy();
  });

  test('shows the sign-in/sign-up button label', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('ورود / ثبت‌نام')).toBeTruthy();
  });

  test('pressing the button navigates to Signin', async () => {
    await render(<HomeScreen />);
    fireEvent.press(screen.getByText('ورود / ثبت‌نام'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Signin');
  });
});

describe('HomeScreen – authenticated state', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, token: 'x', email: 'a@b.c' });
  });

  test('shows the profile button label', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('پروفایل')).toBeTruthy();
  });

  test('does NOT show the sign-in/sign-up label when authenticated', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText('ورود / ثبت‌نام')).toBeNull();
  });

  test('pressing the profile button does not navigate (stub, no action yet)', async () => {
    await render(<HomeScreen />);
    fireEvent.press(screen.getByText('پروفایل'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
