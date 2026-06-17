// Import for side effects: initialises i18next and forces RTL layout before render.
import './src/i18n';

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';

export default function App() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Wait for the persisted session to load before first render so an
  // authenticated user never sees a flash of guest UI on launch.
  if (!hasHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
