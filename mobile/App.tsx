// Import for side effects: initialises i18next and forces RTL layout before render.
import './src/i18n';
// Import for side effects: opens the SQLite db and creates the pets table.
import './src/db';

import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';

import notifee from '@notifee/react-native';

import RootNavigator from './src/navigation/RootNavigator';
import type { RootTabParamList } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { initChoreNotifications, handleNotificationEvent } from './src/lib/choreNotifications';

// Register background handler at module top-level (before render), per Notifee requirement.
// Background JS context: handleNotificationEvent only touches db/chores — safe for headless.
notifee.onBackgroundEvent(handleNotificationEvent);

// Navigation ref shared with choreNotifications for tap-to-open Today tab.
const navRef = createNavigationContainerRef<RootTabParamList>();

export default function App() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  // Vazirmatn — the app's typeface. Keys must match the family names in theme.ts.
  const [fontsLoaded] = useFonts({
    'Vazirmatn-Regular': require('./assets/fonts/Vazirmatn-Regular.ttf'),
    'Vazirmatn-Medium': require('./assets/fonts/Vazirmatn-Medium.ttf'),
    'Vazirmatn-SemiBold': require('./assets/fonts/Vazirmatn-SemiBold.ttf'),
    'Vazirmatn-Bold': require('./assets/fonts/Vazirmatn-Bold.ttf'),
  });

  // ponytail: init once; errors are fire-and-forget (permission denied is non-fatal).
  // Gate on navReady so getInitialNotification's cold-start tap can actually navigate.
  const [navReady, setNavReady] = useState(false);
  const notifInitDone = useRef(false);
  useEffect(() => {
    if (!hasHydrated || !fontsLoaded || !navReady || notifInitDone.current) return;
    notifInitDone.current = true;
    initChoreNotifications(navRef).catch(() => {});
  }, [hasHydrated, fontsLoaded, navReady]);

  // Hold the first render until both the persisted session and the fonts are
  // ready, so the user never sees a flash of guest UI or unstyled system text.
  if (!hasHydrated || !fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ActionSheetProvider>
        <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
          <RootNavigator />
          {/* App is light-only (userInterfaceStyle: light); "auto" follows the OS
              scheme and renders white text on the light canvas in device dark mode. */}
          <StatusBar style="dark" />
        </NavigationContainer>
      </ActionSheetProvider>
      {/* Toast renders above all screens; must be last child so it overlays navigation. */}
      <Toast />
    </SafeAreaProvider>
  );
}
