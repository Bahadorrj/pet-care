/**
 * ChangeUsernameScreen tests
 *
 * Verifies:
 * - Renders pre-filled with current username from store
 * - Submits new username to changeUsername API
 * - On success: calls setUsername and navigates back
 * - On 409: shows auth.error.username_taken error
 * - On 422: shows auth.error.invalid_username error
 * - On network error: shows auth.error.network error
 *
 * authStore.setUsername is tested separately in authStore tests.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../api/auth');

import '../i18n';
import * as authApi from '../api/auth';
import { useAuthStore } from '../store/authStore';
import ChangeUsernameScreen from '../screens/ChangeUsernameScreen';

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockSetUsername = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockGoBack.mockClear();
  mockSetUsername.mockClear();
  mockAuthApi.changeUsername?.mockReset();
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'tok',
    email: 'user@example.com',
    username: 'johndoe',
    setUsername: mockSetUsername,
  });
});

describe('ChangeUsernameScreen – rendering', () => {
  test('renders a text field pre-filled with current username', async () => {
    const { getByDisplayValue } = await render(<ChangeUsernameScreen />);
    expect(getByDisplayValue('johndoe')).toBeTruthy();
  });

  test('renders the submit button', async () => {
    const { getByTestId } = await render(<ChangeUsernameScreen />);
    expect(getByTestId('change-username-submit')).toBeTruthy();
  });
});

describe('ChangeUsernameScreen – happy path', () => {
  test('calls changeUsername with new value, setUsername with server value, and navigates back', async () => {
    mockAuthApi.changeUsername.mockResolvedValueOnce({
      id: '1',
      email: 'user@example.com',
      username: 'newname',
    });

    const { getByDisplayValue, getByTestId } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByDisplayValue('johndoe'), 'newname');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(mockAuthApi.changeUsername).toHaveBeenCalledWith('newname');
      expect(mockSetUsername).toHaveBeenCalledWith('newname');
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ChangeUsernameScreen – 409 error', () => {
  test('shows username_taken Farsi message and does not navigate', async () => {
    const err = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409 },
    });
    mockAuthApi.changeUsername.mockRejectedValueOnce(err);

    const { getByDisplayValue, getByTestId, getByText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByDisplayValue('johndoe'), 'taken');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      // The i18n key auth.error.username_taken maps to a Persian string we will add
      expect(getByText('این نام کاربری قبلاً گرفته شده است')).toBeTruthy();
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('ChangeUsernameScreen – 422 error', () => {
  test('shows invalid_username Farsi message on 422', async () => {
    const err = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422 },
    });
    mockAuthApi.changeUsername.mockRejectedValueOnce(err);

    const { getByDisplayValue, getByTestId, getByText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByDisplayValue('johndoe'), 'bad!');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(
        getByText('نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف، اعداد یا زیرخط باشد'),
      ).toBeTruthy();
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('ChangeUsernameScreen – network error', () => {
  test('shows network error message for unknown errors', async () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
    });
    mockAuthApi.changeUsername.mockRejectedValueOnce(err);

    const { getByDisplayValue, getByTestId, getByText } = await render(<ChangeUsernameScreen />);

    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(getByText('خطای شبکه. دوباره تلاش کنید')).toBeTruthy();
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
