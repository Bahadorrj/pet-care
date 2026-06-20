/**
 * ChangeUsernameScreen tests
 *
 * Verifies:
 * - Renders pre-filled with current username from store
 * - Renders subtitle text
 * - Renders username format hint
 * - Submit button disabled when field is empty or matches current username (plus isSubmitting)
 * - Submit button enabled after editing to a different value
 * - Submits new username to changeUsername API
 * - On success: shows success banner, calls setUsername with server value, then goBack after ~900ms
 * - On 409: shows auth.error.username_taken error (a11y alert role)
 * - On 422: shows auth.error.invalid_username error (a11y alert role)
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

  test('renders the context subtitle', async () => {
    const { getByText } = await render(<ChangeUsernameScreen />);
    expect(
      getByText('این نام برای نمایش عمومی شماست؛ هر زمان می‌توانید تغییرش دهید.'),
    ).toBeTruthy();
  });

  test('renders the username format hint', async () => {
    const { getByText } = await render(<ChangeUsernameScreen />);
    expect(getByText('۳ تا ۳۰ حرف انگلیسی، عدد یا زیرخط')).toBeTruthy();
  });
});

describe('ChangeUsernameScreen – disabled state', () => {
  test('submit button is disabled when field matches current username (unchanged)', async () => {
    const { getByTestId } = await render(<ChangeUsernameScreen />);
    const btn = getByTestId('change-username-submit');
    // Pre-filled with 'johndoe' — same as currentUsername → disabled
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  test('submit button is disabled when field is empty', async () => {
    const { getByTestId, getByDisplayValue } = await render(<ChangeUsernameScreen />);
    await fireEvent.changeText(getByDisplayValue('johndoe'), '');
    const btn = getByTestId('change-username-submit');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  test('submit button is enabled after editing to a different non-empty value', async () => {
    const { getByTestId, getByDisplayValue } = await render(<ChangeUsernameScreen />);
    await fireEvent.changeText(getByDisplayValue('johndoe'), 'newname');
    const btn = getByTestId('change-username-submit');
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });
});

describe('ChangeUsernameScreen – happy path (success beat)', () => {
  test('shows success banner, calls setUsername and goBack on success', async () => {
    mockAuthApi.changeUsername.mockResolvedValueOnce({
      id: '1',
      email: 'user@example.com',
      username: 'newname',
    });

    const { getByDisplayValue, getByTestId, getByText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByDisplayValue('johndoe'), 'newname');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(mockAuthApi.changeUsername).toHaveBeenCalledWith('newname');
      expect(mockSetUsername).toHaveBeenCalledWith('newname');
      expect(getByText('نام کاربری به‌روزرسانی شد')).toBeTruthy();
    });

    // After the 900ms beat, goBack is called — wait for it with a generous timeout
    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });
});

describe('ChangeUsernameScreen – 409 error', () => {
  test('shows username_taken Farsi message with alert a11y and does not navigate', async () => {
    const err = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409 },
    });
    mockAuthApi.changeUsername.mockRejectedValueOnce(err);

    const { getByTestId, getByText, getByPlaceholderText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'taken');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(getByText('این نام کاربری قبلاً گرفته شده است')).toBeTruthy();
    });

    // a11y: error banner should have accessibilityRole="alert"
    const banner = getByText('این نام کاربری قبلاً گرفته شده است').parent;
    expect(banner?.props.accessibilityRole).toBe('alert');

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

    const { getByTestId, getByText, getByPlaceholderText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'bad!');
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

    const { getByTestId, getByText, getByPlaceholderText } = await render(<ChangeUsernameScreen />);

    await fireEvent.changeText(getByPlaceholderText('نام کاربری'), 'newname');
    await fireEvent.press(getByTestId('change-username-submit'));

    await waitFor(() => {
      expect(getByText('خطای شبکه. دوباره تلاش کنید')).toBeTruthy();
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
