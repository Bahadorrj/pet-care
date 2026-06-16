import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../store/authStore';
import type { RootNavigationProp } from '../navigation/RootNavigator';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../assets/logo.png') as number;

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<RootNavigationProp>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleButtonPress = () => {
    if (!isAuthenticated) {
      navigation.navigate('Signin');
    }
    // Authenticated: profile stub — no action yet
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Brand block — centred in the top half */}
      <View style={styles.brand}>
        <Image
          testID="home-logo"
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={t('app.name')}
        />
        <Text style={styles.appName}>{t('app.name')}</Text>
      </View>

      {/* CTA button — pinned near the bottom */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleButtonPress}
        accessibilityRole="button"
        activeOpacity={0.75}
      >
        <Text style={styles.buttonLabel}>
          {isAuthenticated ? t('home.profile') : t('home.signin_signup')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const ACCENT = '#4A7C59'; // calm forest green — unobtrusive, not loud

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    paddingStart: 24,
    paddingEnd: 24,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  button: {
    marginBottom: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ACCENT,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: ACCENT,
    textAlign: 'center',
  },
});
