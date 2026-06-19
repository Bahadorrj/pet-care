import React, { useRef, useState } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await apiChangeUsername(username);
      await setUsername(res.username);
      navigation.goBack();
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
          </View>

          <View style={styles.fields}>
            <TextField
              placeholder={t('auth.username')}
              value={username}
              onChangeText={setUsernameField}
              autoCapitalize="none"
              autoCorrect={false}
              invalid={error !== ''}
              accessibilityLabel={t('auth.username')}
            />
          </View>

          {error !== '' && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            testID="change-username-submit"
            label={t('profile.change_username')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
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
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
});
