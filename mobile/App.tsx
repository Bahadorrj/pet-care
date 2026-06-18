// Import for side effects: initialises i18next and forces RTL layout before render.
import './src/i18n';
// Import for side effects: opens the SQLite db and creates the pets table.
import './src/db';

import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';

export default function App() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  // Vazirmatn — the app's typeface. Keys must match the family names in theme.ts.
  const [fontsLoaded] = useFonts({
    'Vazirmatn-Regular': require('./assets/fonts/Vazirmatn-Regular.ttf'),
    'Vazirmatn-Medium': require('./assets/fonts/Vazirmatn-Medium.ttf'),
    'Vazirmatn-SemiBold': require('./assets/fonts/Vazirmatn-SemiBold.ttf'),
    'Vazirmatn-Bold': require('./assets/fonts/Vazirmatn-Bold.ttf'),
  });

  // Hold the first render until both the persisted session and the fonts are
  // ready, so the user never sees a flash of guest UI or unstyled system text.
  if (!hasHydrated || !fontsLoaded) {
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
