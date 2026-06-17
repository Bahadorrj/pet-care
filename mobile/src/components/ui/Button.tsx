import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, shadow, spacing, typography } from '../../theme/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's single button primitive.
 *
 * - `primary`   filled emerald — the main call to action.
 * - `secondary` outlined — secondary actions (e.g. enter the auth flow).
 * - `ghost`     text-only — tertiary links.
 *
 * Uses Pressable so the press state can drive both a colour change and a subtle
 * scale-down, which reads as more responsive than TouchableOpacity's fade.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
  accessibilityLabel,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'primary' && shadow.button,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !isDisabled && variantPressed[variant],
        pressed && !isDisabled && styles.pressedScale,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.labelOnPrimary : styles.labelAccent]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const variantPressed: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: colors.surfaceSunken },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 44,
    borderRadius: radius.sm,
  },
  pressedScale: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: typography.bodyLg.fontSize,
    fontFamily: fonts.semibold,
  },
  labelOnPrimary: {
    color: colors.onPrimary,
  },
  labelAccent: {
    color: colors.primary,
  },
});
