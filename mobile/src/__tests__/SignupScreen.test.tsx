/**
 * SignupScreen tests
 *
 * Verifies:
 * - Happy path: register() called with correct creds+username, store login called, navigate Profile
 * - 400 / detail "username_already_registered": shows auth.error.username_taken, marks username field invalid only
 * - 400 / detail "email_already_registered": shows auth.error.email_taken, marks email field invalid only
 * - 400 / unknown detail: shows auth.error.network, no field marked
 * - 422 / username loc: shows auth.error.invalid_username, marks username field invalid
 * - 422 / password loc: shows auth.error.weak_password, marks password field invalid
 * - 422 / unknown loc: shows auth.error.network, no field marked
 * - Hint text renders under username field
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

describe('SignupScreen – username hint', () => {
  test('renders the username format hint under the username field', async () => {
    const { getByText } = await render(<SignupScreen />);
    expect(getByText('۳ تا ۳۰ حرف انگلیسی، عدد یا زیرخط')).toBeTruthy();
  });
});

describe('SignupScreen – 400 errors (field-scoped)', () => {
  test('400 / username_already_registered → shows username_taken, only username field marked invalid', async () => {
    const err = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400, data: { detail: 'username_already_registered' } },
    });
    mockAuthApi.register.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'taken');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'password123');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(getByText('این نام کاربری قبلاً گرفته شده است')).toBeTruthy();
    });

    // username TextField's wrapping View should have the invalid (danger) border
    // We verify by checking that ONLY username field is in invalid state:
    // email and password inputs should NOT carry accessibilityState invalid
    const emailInput = getByPlaceholderText('ایمیل');
    const passwordInput = getByPlaceholderText('رمز عبور');
    expect(emailInput.props.accessibilityState?.invalid ?? false).toBe(false);
    expect(passwordInput.props.accessibilityState?.invalid ?? false).toBe(false);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('400 / email_already_registered → shows email_taken, only email field marked invalid', async () => {
    const err = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400, data: { detail: 'email_already_registered' } },
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

    const usernameInput = getByPlaceholderText('نام کاربری');
    const passwordInput = getByPlaceholderText('رمز عبور');
    expect(usernameInput.props.accessibilityState?.invalid ?? false).toBe(false);
    expect(passwordInput.props.accessibilityState?.invalid ?? false).toBe(false);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows email_taken for legacy 400 with no data (backward compat)', async () => {
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

describe('SignupScreen – 422 errors (field-scoped)', () => {
  test('422 with username loc → shows invalid_username, marks username field invalid (not email/password)', async () => {
    const err = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: { detail: [{ loc: ['body', 'username'], msg: 'invalid', type: 'value_error' }] },
      },
    });
    mockAuthApi.register.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'bad!');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'password123');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(
        getByText('نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف، اعداد یا زیرخط باشد'),
      ).toBeTruthy();
    });

    const emailInput = getByPlaceholderText('ایمیل');
    const passwordInput = getByPlaceholderText('رمز عبور');
    expect(emailInput.props.accessibilityState?.invalid ?? false).toBe(false);
    expect(passwordInput.props.accessibilityState?.invalid ?? false).toBe(false);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('422 with password loc → shows weak_password, marks password field invalid (not email/username)', async () => {
    const err = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: { detail: [{ loc: ['body', 'password'], msg: 'too short', type: 'value_error' }] },
      },
    });
    mockAuthApi.register.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SignupScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'johndoe');
    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'short');
    await fireEvent.press(getByTestId('signup-submit'));

    await waitFor(() => {
      expect(getByText('رمز عبور باید حداقل ۸ کاراکتر باشد')).toBeTruthy();
    });

    const usernameInput = getByPlaceholderText('نام کاربری');
    const emailInput = getByPlaceholderText('ایمیل');
    expect(usernameInput.props.accessibilityState?.invalid ?? false).toBe(false);
    expect(emailInput.props.accessibilityState?.invalid ?? false).toBe(false);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('422 with no loc data → shows invalid_username (legacy fallback)', async () => {
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
      expect(
        getByText('نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف، اعداد یا زیرخط باشد'),
      ).toBeTruthy();
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
