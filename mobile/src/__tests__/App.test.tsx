/**
 * App entry-point smoke test.
 *
 * expo-secure-store is mocked (authStore.hydrate() hits it at module load); a
 * null token resolves hydration to the guest state.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import App from '../../App';

test('renders the app and shows the Pets tab after hydration', async () => {
  await render(<App />);
  expect(await screen.findByText('حیوانات من')).toBeTruthy();
  expect(screen.queryByText(/Open up App\.tsx/)).toBeNull();
});
