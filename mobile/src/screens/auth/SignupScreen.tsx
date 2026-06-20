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

import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { register as apiRegister } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { ProfileNavigationProp } from '../../navigation/ProfileStack';

type ErrorField = 'email' | 'password' | 'username' | '';

export default function SignupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ref gives a synchronous in-flight guard so a rapid second press before
  // the state re-render cannot trigger a duplicate request.
  const inFlightRef = useRef(false);

  const storeLogin = useAuthStore((s) => s.login);

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setErrorField('');
    setIsSubmitting(true);
    try {
      const res = await apiRegister(email, password, username);
      await storeLogin(res.access_token, res.email, res.username);
      navigation.navigate('ProfileMain');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 400) {
          const detail = err.response?.data?.detail;
          if (detail === 'username_already_registered') {
            setError(t('auth.error.username_taken'));
            setErrorField('username');
          } else if (detail === 'email_already_registered') {
            setError(t('auth.error.email_taken'));
            setErrorField('email');
          } else {
            // Fallback for unknown 400 detail (e.g. old shape without detail)
            setError(t('auth.error.email_taken'));
            setErrorField('email');
          }
        } else if (status === 422) {
          const detail = err.response?.data?.detail;
          // detail is an array of FastAPI validation errors
          if (Array.isArray(detail)) {
            const locs = detail.flatMap((item: { loc?: string[] }) => item.loc ?? []);
            if (locs.includes('username')) {
              setError(t('auth.error.invalid_username'));
              setErrorField('username');
            } else if (locs.includes('password')) {
              setError(t('auth.error.weak_password'));
              setErrorField('password');
            } else {
              setError(t('auth.error.invalid_username'));
              setErrorField('username');
            }
          } else {
            // No parseable detail — legacy fallback
            setError(t('auth.error.invalid_username'));
            setErrorField('username');
          }
        } else {
          setError(t('auth.error.network'));
          setErrorField('');
        }
      } else {
        setError(t('auth.error.network'));
        setErrorField('');
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
            <Text style={styles.title}>{t('auth.signup')}</Text>
            <Text style={styles.subtitle}>{t('auth.signup_subtitle')}</Text>
          </View>

          <View style={styles.fields}>
            <View>
              <TextField
                placeholder={t('auth.username')}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                invalid={errorField === 'username'}
                accessibilityLabel={t('auth.username')}
              />
              <Text style={styles.hint}>{t('auth.username_hint')}</Text>
            </View>

            <TextField
              placeholder={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              invalid={errorField === 'email'}
              accessibilityLabel={t('auth.email')}
            />

            <TextField
              placeholder={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              invalid={errorField === 'password'}
              accessibilityLabel={t('auth.password')}
            />
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

          <Button
            testID="signup-submit"
            label={t('auth.signup')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />

          <Button
            variant="ghost"
            label={t('auth.has_account')}
            onPress={() => navigation.navigate('Signin')}
            style={styles.link}
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
  link: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
});
