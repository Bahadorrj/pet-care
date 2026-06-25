import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import {
  daysInJalaliMonth,
  formatJalaliParts,
  jalaliParts,
  tehranTodayJalali,
  toPersianDigits,
} from '../../lib/jalali';

type Props = {
  /** Current value as a Jalali `yyyy/MM/dd` string. Empty string = unset. */
  value: string;
  /** Called with the new Jalali `yyyy/MM/dd` string when the user confirms. */
  onChange: (value: string) => void;
  testID?: string;
  accessibilityLabel?: string;
  invalid?: boolean;
};

// Jalali month names, index 0 = Farvardin (month 1).
const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const ITEM_HEIGHT = 44;
const VISIBLE = 5; // odd → one row sits in the centre band
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE / 2);

/** One snapping column. `items` are display strings; selection is by index. */
function Wheel({
  items,
  index,
  onIndex,
  testID,
}: {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  testID?: string;
}) {
  const ref = useRef<ScrollView>(null);

  // Keep the wheel aligned when the index changes from outside (e.g. month
  // change clamps the day), without fighting an in-progress drag.
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  }, [index]);

  return (
    <View style={styles.wheel}>
      <ScrollView
        ref={ref}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const clamped = Math.max(0, Math.min(items.length - 1, i));
          if (clamped !== index) onIndex(clamped);
        }}
      >
        {items.map((label, i) => (
          <View key={i} style={styles.item}>
            <Text style={[styles.itemText, i === index && styles.itemTextSelected]}>
              {label}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.centerBand} />
    </View>
  );
}

/**
 * Themed Jalali date field: a "pick date" button beside a label showing the
 * chosen date. The button opens a bottom-sheet with three wheels
 * (year / month / day); stores and emits a Jalali `yyyy/MM/dd` string.
 * Day count tracks the selected month so 31 Esfand can never be picked.
 */
export default function DatePickerField({
  value,
  onChange,
  testID,
  accessibilityLabel,
  invalid = false,
}: Props) {
  const { t } = useTranslation();
  // `mounted` keeps the Modal alive across the exit animation; `anim` (0→1)
  // drives a native-driver slide+fade on the UI thread — RN Modal's own
  // `animationType="slide"` is JS-driven and slides the backdrop too, which
  // is the sluggish drag-up being replaced here.
  const [mounted, setMounted] = useState(false);
  const [sheetH, setSheetH] = useState(500);
  const anim = useRef(new Animated.Value(0)).current;

  // Draft parts while the sheet is open; committed only on confirm.
  const today = jalaliParts(tehranTodayJalali())!;
  const initial = jalaliParts(value) ?? today;
  const [draft, setDraft] = useState(initial);

  // Year range spans a sensible task window, widened to always include the
  // current value and today so edit-mode dates are reachable.
  const minYear = Math.min(today.y - 1, initial.y);
  const maxYear = Math.max(today.y + 10, initial.y);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const dayCount = daysInJalaliMonth(draft.y, draft.m);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const openSheet = () => {
    setDraft(jalaliParts(value) ?? today);
    anim.setValue(0);
    setMounted(true);
    // Entry animation runs in Modal's onShow — starting it here fires before the
    // modal is on screen, so the slide finishes invisibly and it "pops" in.
  };

  const animateIn = () => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(
      ({ finished }) => finished && setMounted(false),
    );
  };

  const confirm = () => {
    onChange(formatJalaliParts(draft.y, draft.m, draft.d));
    close();
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          testID={testID}
          onPress={openSheet}
          style={[styles.button, invalid && styles.buttonInvalid]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.buttonText}>{t('common.select_date')}</Text>
        </Pressable>
        {value !== '' && <Text style={styles.dateLabel}>{toPersianDigits(value)}</Text>}
      </View>

      <Modal visible={mounted} transparent animationType="none" onShow={animateIn} onRequestClose={close}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [sheetH, 0],
                  }),
                },
              ],
            },
          ]}
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
        >
          <View style={styles.wheels}>
            <Wheel
              testID={testID ? `${testID}-year` : undefined}
              items={years.map((y) => toPersianDigits(y))}
              index={years.indexOf(draft.y)}
              onIndex={(i) => setDraft((d) => ({ ...d, y: years[i] }))}
            />
            <Wheel
              testID={testID ? `${testID}-month` : undefined}
              items={MONTHS}
              index={draft.m - 1}
              // Clamp the day if the new month is shorter (e.g. 31 → 30/29).
              onIndex={(i) =>
                setDraft((d) => ({
                  ...d,
                  m: i + 1,
                  d: Math.min(d.d, daysInJalaliMonth(d.y, i + 1)),
                }))
              }
            />
            <Wheel
              testID={testID ? `${testID}-day` : undefined}
              items={days.map((d) => toPersianDigits(d))}
              index={draft.d - 1}
              onIndex={(i) => setDraft((d) => ({ ...d, d: i + 1 }))}
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              testID={testID ? `${testID}-cancel` : undefined}
              onPress={close}
              style={styles.actionBtn}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              testID={testID ? `${testID}-confirm` : undefined}
              onPress={confirm}
              style={[styles.actionBtn, styles.confirmBtn]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{t('common.confirm')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  buttonInvalid: {
    borderColor: colors.danger,
  },
  buttonText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  dateLabel: {
    fontSize: typography.bodyLg.fontSize,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  wheel: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  itemTextSelected: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  centerBand: {
    position: 'absolute',
    top: PAD,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  confirmText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semibold,
    color: colors.onPrimary,
  },
});
