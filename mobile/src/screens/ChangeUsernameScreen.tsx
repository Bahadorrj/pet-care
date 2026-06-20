import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import Button from '../components/ui/Button';
import TextField from '../components/ui/TextField';
import { changeUsername as apiChangeUsername } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { colors, fonts, radius, spacing, typography } from '../theme/theme';
import type { ProfileNavigationProp } from '../navigation/ProfileStack';

export default function ChangeUsernameScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();

  const currentUsername = useAuthStore((s) => s.username) ?? '';
  const setUsername = useAuthStore((s) => s.setUsername);

  const [username, setUsernameField] = useState(currentUsername);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  const isUnchanged =
    username.trim() === '' ||
    username.trim().toLowerCase() === currentUsername.toLowerCase();

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const res = await apiChangeUsername(username);
      await setUsername(res.username);
      setSuccessMessage(t('profile.username_updated'));
      timerRef.current = setTimeout(() => {
        navigation.goBack();
      }, 900);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 409) {
          setError(t('auth.error.username_taken'));
        } else if (status === 422) {
          setError(t('auth.error.invalid_username'));
        } else {
          setError(t('auth.error.network'));
        }
      } else {
        setError(t('auth.error.network'));
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.form}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('profile.change_username')}</Text>
            <Text style={styles.subtitle}>{t('profile.change_username_subtitle')}</Text>
          </View>

          <View style={styles.fields}>
            <View>
              <TextField
                placeholder={t('auth.username')}
                value={username}
                onChangeText={setUsernameField}
                autoCapitalize="none"
                autoCorrect={false}
                invalid={error !== ''}
                accessibilityLabel={t('auth.username')}
              />
              <Text style={styles.hint}>{t('auth.username_hint')}</Text>
            </View>
          </View>

          {error !== '' && (
            <View
              style={styles.errorBanner}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {successMessage !== '' && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          <Button
            testID="change-username-submit"
            label={t('profile.change_username')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || isUnchanged}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted, // #73726B on #F6F5F1 — 4.9:1, passes WCAG AA
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  successText: {
    color: colors.primary,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});
