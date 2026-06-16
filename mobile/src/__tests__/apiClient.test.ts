/**
 * apiClient tests
 *
 * Verifies the request interceptor on the axios client:
 * - When the store has a token, Authorization header is set to 'Bearer <token>'
 * - When the store token is null, no Authorization header is added
 *
 * We mock expo-secure-store (imported transitively by authStore) and
 * exercise the real interceptor by using axios's adapter option.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

// A minimal axios adapter that captures the resolved config and succeeds
function makeCapturingAdapter() {
  let captured: InternalAxiosRequestConfig | null = null;

  const adapter = (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    captured = config;
    return Promise.resolve({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };

  return {
    adapter,
    getCaptured: () => captured as InternalAxiosRequestConfig | null,
  };
}

beforeEach(() => {
  useAuthStore.setState({ token: null, email: null, isAuthenticated: false });
});

describe('apiClient – request interceptor', () => {
  test('attaches Authorization header when store has a token', async () => {
    useAuthStore.setState({ token: 'test-jwt', isAuthenticated: true });

    const { adapter, getCaptured } = makeCapturingAdapter();
    await client.get('/test', { adapter });

    const config = getCaptured();
    expect(config?.headers?.['Authorization']).toBe('Bearer test-jwt');
  });

  test('omits Authorization header when store token is null', async () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });

    const { adapter, getCaptured } = makeCapturingAdapter();
    await client.get('/test', { adapter });

    const config = getCaptured();
    expect(config?.headers?.['Authorization']).toBeUndefined();
  });
});
