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
    // Persist first so in-memory state never reports a session that wasn't stored.
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EMAIL_KEY, email);
    set({ token, email, isAuthenticated: true, hasHydrated: true });
  },

  logout: async () => {
    // Delete first so a failed delete can't leave the store cleared while the
    // token persists (which would silently re-authenticate on next launch).
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    set({ token: null, email: null, isAuthenticated: false, hasHydrated: true });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const email = await SecureStore.getItemAsync(EMAIL_KEY);
      if (token && email) {
        set({ token, email, isAuthenticated: true });
      } else {
        // No complete stored session — clear any in-memory state.
        set({ token: null, email: null, isAuthenticated: false });
      }
    } finally {
      // Always mark hydration complete so the app can gate UI on hasHydrated.
      set({ hasHydrated: true });
    }
  },
}));

// Trigger hydration once at module load.
// Note: synchronous "before first render" is impossible because SecureStore is
// async. The app entry point must gate rendering on `hasHydrated`.
useAuthStore.getState().hydrate().catch((err) => {
  console.error('[authStore] hydrate failed:', err);
});
