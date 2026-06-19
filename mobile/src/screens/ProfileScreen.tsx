import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { colors, fonts, spacing, typography } from '../theme/theme';
import type { ProfileNavigationProp } from '../navigation/ProfileStack';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();
  const { isAuthenticated, email, username, logout } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.prompt}>{t('profile.signin_prompt')}</Text>
        <Button label={t('home.signin_signup')} onPress={() => navigation.navigate('Signin')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {username != null && (
        <Text style={styles.username}>@{username}</Text>
      )}
      <Text style={styles.email}>{email}</Text>
      <Button variant="secondary" label={t('profile.logout')} onPress={() => logout()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  username: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
});
