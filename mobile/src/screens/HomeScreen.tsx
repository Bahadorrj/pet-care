import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { colors, fonts, radius, shadow, spacing, typography } from '../theme/theme';
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
      {/* Brand block — optically centred in the upper two-thirds */}
      <View style={styles.brand}>
        <View style={styles.logoHalo}>
          <Image
            testID="home-logo"
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            // Decorative — the app name Text below conveys this to screen readers.
            accessible={false}
          />
        </View>
        <Text style={styles.appName}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
      </View>

      {/* CTA — pinned near the bottom for thumb reach */}
      <View style={styles.footer}>
        <Button
          variant={isAuthenticated ? 'secondary' : 'primary'}
          label={isAuthenticated ? t('home.profile') : t('home.signin_signup')}
          onPress={handleButtonPress}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHalo: {
    width: 132,
    height: 132,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  logo: {
    width: 76,
    height: 76,
  },
  appName: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: {
    paddingBottom: spacing.xxl,
  },
});
