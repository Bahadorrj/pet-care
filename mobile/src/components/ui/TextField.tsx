import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '../../theme/theme';

type Props = TextInputProps & {
  /** When set, the field paints its border in the danger colour. */
  invalid?: boolean;
};

/**
 * Themed single-line input. Tracks focus so the border can lift to the accent
 * colour — a small but high-signal affordance that the field is active.
 *
 * Spreads all remaining TextInputProps, so callers keep full control of
 * value/onChangeText/placeholder/accessibilityLabel/secureTextEntry/etc.
 */
const TextField = forwardRef<TextInput, Props>(function TextField(
  { invalid = false, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        focused && styles.wrapFocused,
        invalid && styles.wrapInvalid,
      ]}
    >
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.primary}
        style={[styles.input, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  wrapFocused: {
    borderColor: colors.primary,
  },
  wrapInvalid: {
    borderColor: colors.danger,
  },
  input: {
    paddingVertical: spacing.md + 2,
    fontSize: typography.bodyLg.fontSize,
    fontFamily: fonts.regular,
    color: colors.ink,
    textAlign: 'auto',
  },
});
