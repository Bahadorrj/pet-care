/**
 * QuickAddScreen — lightweight one-off task entry presented as a formSheet.
 *
 * Design choices:
 * - Plain TextFields for date + time (no picker lib — ADR-0010).
 * - Pet picker as horizontal chips; defaults to the only pet when there's one.
 * - "More options →" carries title + petId into the full TaskFormScreen.
 * - Add is disabled until a pet is selected (when there are multiple pets).
 * - Time default = next round hour in Tehran wall-clock (e.g. 14:23 → "15:00").
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { useTasksStore } from '../../store/tasksStore';
import { usePetsStore } from '../../store/petsStore';
import { toUtcIso } from '../../lib/taskSchedule';
import { jalaliToGregorian, tehranTodayJalali } from '../../lib/jalali';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { TasksNavigationProp } from '../../navigation/TasksStack';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Next round hour in Tehran wall-clock (+03:30). e.g. 14:23 → "15:00", 23:30 → "00:00". */
function nextRoundHourTehran(): string {
  const tehranMs = Date.now() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = (d.getUTCHours() + 1) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

/** True if `s` is a valid 24-hour HH:MM string. */
function isValidTime(s: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuickAddScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<TasksNavigationProp>();

  const addTask = useTasksStore((s) => s.addTask);
  const pets = usePetsStore(useShallow((s) => s.pets));

  // Default-select the only pet when there's exactly one
  const [petId, setPetId] = useState<string | null>(
    pets.length === 1 ? pets[0].id : null,
  );
  const [title, setTitle] = useState('');
  // one_off = single dated task; daily_times = repeats every day at `time`.
  // Weekly/interval stay in the full TaskForm via "More options".
  const [kind, setKind] = useState<'one_off' | 'daily_times'>('one_off');
  const [dateJalali, setDateJalali] = useState(tehranTodayJalali);
  const [time, setTime] = useState(nextRoundHourTehran);

  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [petError, setPetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAdd = petId !== null && !isSubmitting;

  const handleAdd = async () => {
    if (isSubmitting) return;

    let valid = true;

    if (!petId) {
      setPetError(t('tasks.quick.pet'));
      valid = false;
    } else {
      setPetError('');
    }

    // Date only matters for one_off; daily repeats forever from `time`.
    const greg = kind === 'one_off' ? jalaliToGregorian(dateJalali) : 'n/a';
    if (!greg) {
      setDateError(t('tasks.error.invalid_date'));
      valid = false;
    } else {
      setDateError('');
    }

    if (!isValidTime(time)) {
      setTimeError(t('tasks.error.invalid_time'));
      valid = false;
    } else {
      setTimeError('');
    }

    if (!valid || !petId) return;

    setIsSubmitting(true);
    try {
      const schedule =
        kind === 'one_off'
          ? { kind: 'one_off' as const, at: toUtcIso(time, greg!) }
          : { kind: 'daily_times' as const, times: [time] };
      await addTask({
        petId,
        type: 'other',
        title: title.trim() || null,
        schedule,
        endKind: 'never',
        endUntil: null,
        endCount: null,
        active: true,
      });
      navigation.goBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoreOptions = () => {
    if (!petId) return;
    navigation.navigate('TaskForm', {
      petId,
      title: title.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Title ────────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('tasks.quick.title')}</Text>
            <TextField
              testID="quickadd-title"
              placeholder={t('tasks.quick.title')}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* ── Pet picker ───────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('tasks.quick.pet')}</Text>
            <View style={styles.chipRow}>
              {pets.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`quickadd-pet-${p.id}`}
                  style={[styles.chip, petId === p.id && styles.chipSelected]}
                  onPress={() => {
                    setPetId(p.id);
                    setPetError('');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: petId === p.id }}
                >
                  <Text style={[styles.chipText, petId === p.id && styles.chipTextSelected]}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {petError !== '' && <Text style={styles.errorText}>{petError}</Text>}
          </View>

          {/* ── Repeat (one-off vs daily) ────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('tasks.field.schedule')}</Text>
            <View style={styles.chipRow}>
              {(['one_off', 'daily_times'] as const).map((k) => (
                <Pressable
                  key={k}
                  testID={`quickadd-kind-${k}`}
                  style={[styles.chip, kind === k && styles.chipSelected]}
                  onPress={() => setKind(k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === k }}
                >
                  <Text style={[styles.chipText, kind === k && styles.chipTextSelected]}>
                    {t(`tasks.schedule.${k}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── When (date + time) ───────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('tasks.quick.when')}</Text>

            {kind === 'one_off' && (
              <>
                <Text style={styles.subLabel}>{t('tasks.quick.date')}</Text>
                <TextField
                  testID="quickadd-date"
                  placeholder="yyyy/MM/dd"
                  value={dateJalali}
                  onChangeText={(v) => {
                    setDateJalali(v);
                    if (dateError) setDateError('');
                  }}
                  keyboardType="numeric"
                />
                {dateError !== '' && <Text style={styles.errorText}>{dateError}</Text>}
              </>
            )}

            <Text style={[styles.subLabel, kind === 'one_off' && { marginTop: spacing.sm }]}>{t('tasks.quick.time')}</Text>
            <TextField
              testID="quickadd-time"
              placeholder="HH:MM"
              value={time}
              onChangeText={(v) => {
                setTime(v);
                if (timeError) setTimeError('');
              }}
              keyboardType="numeric"
            />
            {timeError !== '' && <Text style={styles.errorText}>{timeError}</Text>}
          </View>

          {/* ── Add button ───────────────────────────────────────────────── */}
          <Button
            testID="quickadd-submit"
            label={t('tasks.quick.add')}
            onPress={handleAdd}
            loading={isSubmitting}
            disabled={!canAdd}
          />

          {/* ── More options link ────────────────────────────────────────── */}
          {petId !== null && (
            <Pressable
              testID="quickadd-more"
              onPress={handleMoreOptions}
              style={styles.moreOptions}
              accessibilityRole="button"
            >
              <Text style={styles.moreOptionsText}>{t('tasks.quick.more_options')}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  subLabel: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  chipTextSelected: {
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  moreOptions: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moreOptionsText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
});
