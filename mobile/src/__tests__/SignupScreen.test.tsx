/**
 * SignupScreen tests
 *
 * Verifies:
 * - Happy path: register() called with correct creds+username, store login called, navigate Profile
 * - 400 error: email-taken Farsi message shown, no navigation
 * - 422 error: invalid-username Farsi message shown (422 covers both invalid username and weak password)
 * - Username field: rendered and submitted
 * - Link: pressing has_account link navigates to Signin
 *
 * Note: RNTL v14 fireEvent is async — all fireEvent calls must be awaited.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Must come before authStore import — hydrate() fires at module load.
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

jest.mock('../api/auth');

import '../i18n';
import * as authApi from '../api/auth';
import { useAuthStore } from '../store/authStore';
import SignupScreen from '../screens/auth/SignupScreen';

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockLogin = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockNavigate.mockClear();
  mockLogin.mockClear();
  mockAuthApi.register.mockReset();
  useAuthStore.setState({ login: mockLogin, isAuthenticated: false, token: null, email: null, username: null });
});

describe('SignupScreen – happy path', () => {
  test('renders username field', async () => {
    const { getByPlaceholderText } = await render(<SignupScreen />);
    // The username field should be present (placeholder is the Farsi label)
    expect(getByPlaceholderText('نام کاربری')).toBeTruthy();
  });

  test('calls register() with username, store login() with username, and navigates Profile on success', async () => {
    mockAuthApi.register.mockResolvedValueOnce({
      access_token: 'tok2',
      token_type: 'bearer',
      username: 'johndoe',
      email: 'new@example.com',
    });

    const { getByPlaceholderText, getByTestId } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'johndoe');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'new@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'password123');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(mockAuthApi.register).toHaveBeenCalledWith('new@example.com', 'password123', 'johndoe');
      expect(mockLogin).toHaveBeenCalledWith('tok2', 'new@example.com', 'johndoe');
      expect(mockNavigate).toHaveBeenCalledWith('ProfileMain');
    });
  });
});

describe('SignupScreen – 400 error', () => {
  test('shows email-taken Farsi message and does not navigate', async () => {
    const err = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400 },
    });
    mockAuthApi.register.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'johndoe');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'taken@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'password123');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(getByText('این ایمیل قبلاً ثبت شده است')).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SignupScreen – 422 error', () => {
  test('shows invalid-username Farsi message on 422', async () => {
    const err = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422 },
    });
    mockAuthApi.register.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'bad!');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'short');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(getByText('نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف، اعداد یا زیرخط باشد')).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SignupScreen – navigation link', () => {
  test('pressing the has-account link navigates to Signin', async () => {
    const { getByText } = await render(<SignupScreen />);
    await fireEvent.press(getByText('قبلاً ثبت‌نام کرده‌اید؟ وارد شوید'));
    expect(mockNavigate).toHaveBeenCalledWith('Signin');
  });
});
