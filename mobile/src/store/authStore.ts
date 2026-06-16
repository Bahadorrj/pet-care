import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

// Stable SecureStore key constants
const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';

interface AuthState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;

  login: (token: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  email: null,
  isAuthenticated: false,
  hasHydrated: false,

  login: async (token: string, email: string) => {
    set({ token, email, isAuthenticated: true });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  },

  logout: async () => {
    set({ token: null, email: null, isAuthenticated: false });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const email = await SecureStore.getItemAsync(EMAIL_KEY);
      if (token) {
        set({ token, email, isAuthenticated: true });
      }
    } finally {
      // Always mark hydration complete so the app can gate UI on hasHydrated
      set({ hasHydrated: true });
    }
  },
}));

// Trigger hydration once at module load.
// Note: synchronous "before first render" is impossible because SecureStore is
// async. The app entry point must gate rendering on `hasHydrated`.
useAuthStore.getState().hydrate();
