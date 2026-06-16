/**
 * SigninScreen tests
 *
 * Verifies:
 * - Happy path: login() called with correct creds, store login called, navigate Home
 * - 401 error: invalid-credentials Farsi message shown, no navigation
 * - Network error: network Farsi message shown
 * - Loading state: no double-submit while request in-flight
 * - Navigation link: no-account link navigates to Signup
 *
 * Note: RNTL v14 fireEvent is async — all fireEvent calls must be awaited.
 */

import React from 'react';
import { render, fireEvent, waitFor, act as rnAct } from '@testing-library/react-native';

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
import SigninScreen from '../screens/auth/SigninScreen';

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockLogin = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockNavigate.mockClear();
  mockLogin.mockClear();
  mockAuthApi.login.mockReset();
  useAuthStore.setState({ login: mockLogin, isAuthenticated: false, token: null, email: null });
});

describe('SigninScreen – happy path', () => {
  test('calls login(), store login(), and navigates Home on success', async () => {
    mockAuthApi.login.mockResolvedValueOnce({ access_token: 'tok', token_type: 'bearer' });

    const { getByPlaceholderText, getByTestId } = await render(<SigninScreen />);

    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'secret123');
    await fireEvent.press(getByTestId('signin-submit'));

    await waitFor(() => {
      expect(mockAuthApi.login).toHaveBeenCalledWith('user@example.com', 'secret123');
      expect(mockLogin).toHaveBeenCalledWith('tok', 'user@example.com');
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });
});

describe('SigninScreen – 401 error', () => {
  test('shows invalid-credentials Farsi message and does not navigate', async () => {
    const err = Object.assign(new Error('Unauthorized'), {
      isAxiosError: true,
      response: { status: 401 },
    });
    mockAuthApi.login.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SigninScreen />);

    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'wrongpass');
    await fireEvent.press(getByTestId('signin-submit'));

    await waitFor(() => {
      expect(getByText('ایمیل یا رمز عبور اشتباه است')).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SigninScreen – network error', () => {
  test('shows network error Farsi message on no response', async () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
    });
    mockAuthApi.login.mockRejectedValueOnce(err);

    const { getByPlaceholderText, getByTestId, getByText } = await render(<SigninScreen />);

    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'pass');
    await fireEvent.press(getByTestId('signin-submit'));

    await waitFor(() => {
      expect(getByText('خطای شبکه. دوباره تلاش کنید')).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SigninScreen – loading state', () => {
  test('does not double-submit while request is in flight', async () => {
    // loginCalled counts how many times the API is invoked.
    // The promise never resolves during the assertion window so the
    // handler stays in-flight, letting us verify the ref guard blocks re-entry.
    let resolveLogin!: (val: { access_token: string; token_type: 'bearer' }) => void;
    mockAuthApi.login.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );

    const { getByPlaceholderText, getByTestId } = await render(<SigninScreen />);

    await fireEvent.changeText(getByPlaceholderText('ایمیل'), 'user@example.com');
    await fireEvent.changeText(getByPlaceholderText('رمز عبور'), 'pass');

    // Wrap everything in a single act() so all async work drains before the
    // test ends, preventing contamination of the next test.
    await rnAct(async () => {
      // Press once — starts the request (inFlightRef = true synchronously).
      // Press again — ref guard rejects it before any await.
      // Neither is awaited here; the outer act() will drain them.
      fireEvent.press(getByTestId('signin-submit'));
      fireEvent.press(getByTestId('signin-submit'));

      // Tick so handleSubmit runs up to the apiLogin call.
      await Promise.resolve();

      expect(mockAuthApi.login).toHaveBeenCalledTimes(1);

      // Resolve so the component can finish cleanly.
      resolveLogin({ access_token: 'tok', token_type: 'bearer' });
    });

    // After act() drains, navigate should have been called.
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });
});

describe('SigninScreen – navigation link', () => {
  test('pressing the no-account link navigates to Signup', async () => {
    const { getByText } = await render(<SigninScreen />);
    await fireEvent.press(getByText('حساب ندارید؟ ثبت‌نام کنید'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });
});
