import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import { toPersianDigits } from '../../lib/jalali';

type Props = {
  /** Current value as a 24-hour `HH:MM` wall-clock string. */
  value: string;
  /** Called with the new `HH:MM` string when the user picks a time. */
  onChange: (value: string) => void;
  testID?: string;
  accessibilityLabel?: string;
  invalid?: boolean;
};

/** `HH:MM` → a Date carrying those hours/minutes (date part irrelevant). */
function hhmmToDate(value: string): Date {
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

/** Date → 24-hour `HH:MM`. */
function dateToHhmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Themed time field that opens the native clock/spinner picker on tap.
 * Android shows the Material clock dial; iOS the wheel. Stores `HH:MM`.
 */
export default function TimePickerField({
  value,
  onChange,
  testID,
  accessibilityLabel,
  invalid = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.wrap, invalid && styles.wrapInvalid]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.value}>{toPersianDigits(value)}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={hhmmToDate(value)}
          mode="time"
          is24Hour
          onValueChange={(_event, date) => {
            setOpen(false);
            if (date) onChange(dateToHhmm(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  wrapInvalid: {
    borderColor: colors.danger,
  },
  value: {
    fontSize: typography.bodyLg.fontSize,
    fontFamily: fonts.regular,
    color: colors.ink,
    textAlign: 'auto',
  },
});
