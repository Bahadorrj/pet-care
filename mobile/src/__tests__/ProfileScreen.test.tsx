/**
 * ProfileScreen tests
 *
 * Verifies:
 * - Logged out: renders profile.signin_prompt + sign-in button; pressing it navigates to 'Signin'.
 * - Logged in: renders email + logout button; pressing it calls logout().
 * - Logged in: @username handle renders (RTL×LTR fix — value present, writingDirection handled in impl).
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
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import '../i18n';
import { useAuthStore } from '../store/authStore';
import ProfileScreen from '../screens/ProfileScreen';

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  // Reset to guest state before each test.
  useAuthStore.setState({ isAuthenticated: false, token: null, email: null, username: null });
});

describe('ProfileScreen – logged out', () => {
  test('renders the signin prompt', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('برای ذخیره و همگام‌سازی وارد شوید')).toBeTruthy();
  });

  test('renders the sign-in/sign-up button', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('ورود / ثبت‌نام')).toBeTruthy();
  });

  test('pressing the sign-in button navigates to Signin', async () => {
    await render(<ProfileScreen />);
    fireEvent.press(screen.getByText('ورود / ثبت‌نام'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Signin');
  });
});

describe('ProfileScreen – logged in', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, token: 'tok', email: 'user@example.com', username: 'johndoe' });
  });

  test('renders @username handle (includes username value with LRM prefix)', async () => {
    await render(<ProfileScreen />);
    // The handle text contains LRM + '@' + username; query by a substring match
    const handle = screen.getByTestId('profile-username-handle');
    expect(handle).toBeTruthy();
    expect(handle.props.children).toContain('johndoe');
  });

  test('handle Text has writingDirection ltr to prevent bidi reordering', async () => {
    await render(<ProfileScreen />);
    const handle = screen.getByTestId('profile-username-handle');
    const style = Array.isArray(handle.props.style)
      ? Object.assign({}, ...handle.props.style)
      : handle.props.style ?? {};
    expect(style.writingDirection).toBe('ltr');
  });

  test('renders the user email', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('user@example.com')).toBeTruthy();
  });

  test('renders the logout button', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('خروج')).toBeTruthy();
  });

  test('pressing the logout button calls store logout()', async () => {
    const mockLogout = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ isAuthenticated: true, token: 'tok', email: 'user@example.com', username: 'johndoe', logout: mockLogout });

    await render(<ProfileScreen />);
    fireEvent.press(screen.getByText('خروج'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test('renders the change username button', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('تغییر نام کاربری')).toBeTruthy();
  });

  test('pressing the change username button navigates to ChangeUsername', async () => {
    await render(<ProfileScreen />);
    fireEvent.press(screen.getByText('تغییر نام کاربری'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangeUsername');
  });
});
