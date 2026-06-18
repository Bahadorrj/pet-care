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
import { login as apiLogin } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { ProfileNavigationProp } from '../../navigation/ProfileStack';

export default function SigninScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ref gives a synchronous in-flight guard so a rapid second press before
  // the state re-render cannot trigger a duplicate request.
  const inFlightRef = useRef(false);

  const storeLogin = useAuthStore((s) => s.login);

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await apiLogin(email, password);
      await storeLogin(res.access_token, email);
      navigation.navigate('Profile');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('auth.error.invalid_credentials'));
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
            <Text style={styles.title}>{t('auth.signin')}</Text>
            <Text style={styles.subtitle}>{t('auth.signin_subtitle')}</Text>
          </View>

          <View style={styles.fields}>
            <TextField
              placeholder={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              invalid={error !== ''}
              accessibilityLabel={t('auth.email')}
            />

            <TextField
              placeholder={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              invalid={error !== ''}
              accessibilityLabel={t('auth.password')}
            />
          </View>

          {error !== '' && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            testID="signin-submit"
            label={t('auth.signin')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />

          <Button
            variant="ghost"
            label={t('auth.no_account')}
            onPress={() => navigation.navigate('Signup')}
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
