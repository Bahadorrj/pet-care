import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { login as apiLogin } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { RootNavigationProp } from '../../navigation/RootNavigator';

export default function SigninScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<RootNavigationProp>();

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
      navigation.navigate('Home');
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
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.form}>
          <Text style={styles.title}>{t('auth.signin')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            accessibilityLabel={t('auth.email')}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel={t('auth.password')}
          />

          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            testID="signin-submit"
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            activeOpacity={0.75}
          >
            <Text style={styles.buttonLabel}>{t('auth.signin')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            accessibilityRole="button"
            style={styles.link}
          >
            <Text style={styles.linkText}>{t('auth.no_account')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ACCENT = '#4A7C59';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  inner: {
    flex: 1,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingStart: 24,
    paddingEnd: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#C8C8C4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingStart: 16,
    paddingEnd: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#C0392B',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: ACCENT,
    fontSize: 14,
  },
});
