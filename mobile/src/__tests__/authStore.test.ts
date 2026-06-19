/**
 * authStore tests
 *
 * Verifies:
 * - login sets state and persists token/email/username to SecureStore
 * - logout clears state and removes entries from SecureStore
 * - hydrate with a stored token → isAuthenticated=true, hasHydrated=true, username restored
 * - hydrate with null → isAuthenticated=false, hasHydrated=true
 *
 * SecureStore is mocked so no native modules are needed.
 * The module is re-required inside isolateModules for each test so the
 * module-level hydrate() call doesn't bleed between tests.
 */

import * as SecureStoreMock from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStoreMock as jest.Mocked<typeof SecureStoreMock>;

// Flush all pending microtasks (hydrate awaits several SecureStore promises).
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// Helper: load a fresh store instance, wait for module-level hydrate to settle.
async function loadFreshStore() {
  let store: typeof import('../store/authStore');
  jest.isolateModules(() => {
    store = require('../store/authStore');
  });
  // Let the module-level hydrate() promise (and its awaits) fully settle.
  await flushPromises();
  return store!;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: nothing stored
  mockedSecureStore.getItemAsync.mockResolvedValue(null);
  mockedSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockedSecureStore.deleteItemAsync.mockResolvedValue(undefined);
});

describe('authStore – login', () => {
  test('sets token, email, username, isAuthenticated=true and calls setItemAsync', async () => {
    const { useAuthStore } = await loadFreshStore();

    await useAuthStore.getState().login('tok123', 'user@example.com', 'johndoe');

    const state = useAuthStore.getState();
    expect(state.token).toBe('tok123');
    expect(state.email).toBe('user@example.com');
    expect(state.username).toBe('johndoe');
    expect(state.isAuthenticated).toBe(true);

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_token',
      'tok123',
    );
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_email',
      'user@example.com',
    );
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_username',
      'johndoe',
    );
  });
});

describe('authStore – logout', () => {
  test('clears state and calls deleteItemAsync for token, email, and username', async () => {
    const { useAuthStore } = await loadFreshStore();

    // Seed state first
    await useAuthStore.getState().login('tok123', 'user@example.com', 'johndoe');
    jest.clearAllMocks();
    mockedSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.email).toBeNull();
    expect(state.username).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_email');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_username');
  });
});

describe('authStore – hydrate', () => {
  test('with stored token → isAuthenticated=true, hasHydrated=true, username restored', async () => {
    mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
      if (key === 'auth_token') return Promise.resolve('stored-tok');
      if (key === 'auth_email') return Promise.resolve('stored@example.com');
      if (key === 'auth_username') return Promise.resolve('storeduser');
      return Promise.resolve(null);
    });

    // No explicit hydrate() call — the module-level auto-hydration on load
    // (settled inside loadFreshStore) is what must restore the session.
    const { useAuthStore } = await loadFreshStore();

    const state = useAuthStore.getState();
    expect(state.token).toBe('stored-tok');
    expect(state.email).toBe('stored@example.com');
    expect(state.username).toBe('storeduser');
    expect(state.isAuthenticated).toBe(true);
    expect(state.hasHydrated).toBe(true);
  });

  test('with no stored token → isAuthenticated=false and hasHydrated=true', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    const { useAuthStore } = await loadFreshStore();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasHydrated).toBe(true);
  });

  test('with stored token but no username → isAuthenticated=true, username=null', async () => {
    mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
      if (key === 'auth_token') return Promise.resolve('stored-tok');
      if (key === 'auth_email') return Promise.resolve('stored@example.com');
      return Promise.resolve(null);
    });

    const { useAuthStore } = await loadFreshStore();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBeNull();
    expect(state.hasHydrated).toBe(true);
  });
});
