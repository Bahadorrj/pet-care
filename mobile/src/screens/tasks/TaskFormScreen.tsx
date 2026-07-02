/**
 * TaskFormScreen — Add + Edit a task for a specific pet.
 *
 * Mode: Add when no `taskId` param; Edit when `taskId` is set.
 * Mirrors PetFormScreen patterns: useRef in-flight guard, translated errors,
 * theme tokens, start/end RTL-safe styles, ui primitives.
 *
 * Impeccable craft choices:
 * - Type chips use pill shape + Garden Confident selected state (matches species chips)
 * - Schedule builder reveals inputs progressively — only what the chosen kind needs
 * - Section dividers use Border Gentle, not shadow, to stay on-canvas
 * - Touch targets: chips min 44pt, time rows min 44pt, weekday cells 44×44
 * - Error inline, immediately below the relevant control, Alert Brick on Alert Soft
 * - RTL: all directions use `Start`/`End`, chip rows use `flexWrap: 'wrap'` RTL-safe
 * - Empty end-condition (after_n count=0) blocked with translated error
 * - One_off date: Jalali wheel picker (DatePickerField); time: native clock picker
 *   (TimePickerField), converted via toUtcIso — no new date lib; guidance per ADR-0010
 */

import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import TextField from "../../components/ui/TextField";
import TimePickerField from "../../components/ui/TimePickerField";
import DatePickerField from "../../components/ui/DatePickerField";
import {
  jalaliToGregorian,
  tehranTodayJalali,
  utcIsoToTehranJalali,
} from "../../lib/jalali";
import { useShallow } from "zustand/react/shallow";
import { useTasksStore } from "../../store/tasksStore";
import { usePetsStore } from "../../store/petsStore";
import { getTask } from "../../db/tasks";
import { toUtcIso } from "../../lib/taskSchedule";
import { colors, fonts, radius, spacing, typography } from "../../theme/theme";
import type {
  PetsStackParamList,
  PetsNavigationProp,
} from "../../navigation/PetsStack";
import type { TaskType, Schedule, EndKind } from "../../db/types";

type TaskFormRouteProp = RouteProp<PetsStackParamList, "TaskForm">;

// ── Constants ─────────────────────────────────────────────────────────────────

const TASK_TYPES: TaskType[] = [
  "feeding",
  "water",
  "meds",
  "play",
  "grooming",
  "vet",
  "other",
];
const SCHEDULE_KINDS = [
  "daily_times",
  "weekdays",
  "interval",
  "one_off",
] as const;
type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

const INTERVAL_UNITS = ["hours", "days", "months"] as const;
type IntervalUnit = (typeof INTERVAL_UNITS)[number];

const END_KINDS: EndKind[] = ["never", "until", "after_n"];

// Weekday labels — RTL-aware display; 0=Sun..6=Sat
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Stored UTC ISO instant → Tehran wall-clock HH:MM (+03:30). Edit-mode time prefill. */
function utcIsoToTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** True if `s` is a valid 24-hour HH:MM wall-clock string. */
function isValidTime(s: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const route = useRoute<TaskFormRouteProp>();
  const { taskId } = route.params;
  const isEdit = taskId != null;

  // Prefill in edit mode
  const existing = isEdit ? getTask(taskId) : null;

  // ── Pets store ───────────────────────────────────────────────────────────────
  const pets = usePetsStore(useShallow((s) => s.pets));

  // ── Pet selection (add mode only) ─────────────────────────────────────────
  const [petIds, setPetIds] = useState<string[]>(
    !isEdit && pets.length === 1 ? [pets[0].id] : [],
  );
  const [petError, setPetError] = useState("");
  const togglePet = (id: string) => {
    setPetIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
    if (petError) setPetError("");
  };

  // ── Type ────────────────────────────────────────────────────────────────────
  const [taskType, setTaskType] = useState<TaskType | null>(
    existing?.type ?? null,
  );

  // ── Title (optional) ────────────────────────────────────────────────────────
  const [title, setTitle] = useState(
    existing?.title ?? route.params.title ?? "",
  );

  // ── Schedule kind ────────────────────────────────────────────────────────────
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(
    existing?.schedule.kind ?? "daily_times",
  );

  // ── daily_times / weekdays — times list ─────────────────────────────────────
  const initTimes =
    existing?.schedule.kind === "daily_times" ||
    existing?.schedule.kind === "weekdays"
      ? existing.schedule.times
      : ["08:00"];
  const [times, setTimes] = useState<string[]>(initTimes);

  // ── weekdays — days multi-select ─────────────────────────────────────────────
  const initDays =
    existing?.schedule.kind === "weekdays" ? existing.schedule.days : [];
  const [weekdays, setWeekdays] = useState<number[]>(initDays);

  // ── interval ─────────────────────────────────────────────────────────────────
  const initIntervalN =
    existing?.schedule.kind === "interval" ? String(existing.schedule.n) : "1";
  const initIntervalUnit: IntervalUnit =
    existing?.schedule.kind === "interval" ? existing.schedule.unit : "days";
  const [intervalN, setIntervalN] = useState(initIntervalN);
  const [intervalUnit, setIntervalUnit] =
    useState<IntervalUnit>(initIntervalUnit);

  // ── one_off — Jalali date yyyy/MM/dd (Tehran wall-clock) + time HH:MM ────────
  // DatePickerField emits Jalali; on submit jalaliToGregorian converts before toUtcIso.
  const initOneOffDate =
    existing?.schedule.kind === "one_off"
      ? utcIsoToTehranJalali(existing.schedule.at)
      : tehranTodayJalali();
  const initOneOffTime =
    existing?.schedule.kind === "one_off"
      ? utcIsoToTehranTime(existing.schedule.at)
      : "09:00";
  const [oneOffDate, setOneOffDate] = useState(initOneOffDate);
  const [oneOffTime, setOneOffTime] = useState(initOneOffTime);

  // ── End condition ─────────────────────────────────────────────────────────────
  const [endKind, setEndKind] = useState<EndKind>(existing?.endKind ?? "never");
  // endUntilDate is Jalali yyyy/MM/dd; jalaliToGregorian converts on submit
  const initEndUntilDate = existing?.endUntil
    ? utcIsoToTehranJalali(existing.endUntil)
    : "";
  const [endUntilDate, setEndUntilDate] = useState(initEndUntilDate);
  const [endCount, setEndCount] = useState(
    existing?.endCount != null ? String(existing.endCount) : "",
  );

  // ── Errors ───────────────────────────────────────────────────────────────────
  const [typeError, setTypeError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [endError, setEndError] = useState("");

  // ── Submission state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const addTask = useTasksStore((s) => s.addTask);
  const updateTask = useTasksStore((s) => s.updateTask);

  // ── Weekday toggle ───────────────────────────────────────────────────────────
  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    if (scheduleError) setScheduleError("");
  };

  // ── Times list helpers ───────────────────────────────────────────────────────
  const addTime = () => setTimes((prev) => [...prev, "08:00"]);
  const removeTime = (idx: number) =>
    setTimes((prev) => prev.filter((_, i) => i !== idx));
  const updateTime = (idx: number, value: string) => {
    setTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
    if (scheduleError) setScheduleError("");
  };

  // ── Build Schedule object ────────────────────────────────────────────────────
  function buildSchedule(): Schedule {
    switch (scheduleKind) {
      case "daily_times":
        return { kind: "daily_times", times };

      case "weekdays":
        return { kind: "weekdays", days: weekdays, times };

      case "interval": {
        const n = parseInt(intervalN, 10);
        const anchor = new Date().toISOString(); // anchor = now (creation time)
        return {
          kind: "interval",
          n: isNaN(n) ? 1 : n,
          unit: intervalUnit,
          anchor,
        };
      }

      case "one_off": {
        const greg = jalaliToGregorian(oneOffDate);
        if (!greg) throw new Error("tasks.error.schedule_empty");
        const at = toUtcIso(oneOffTime, greg);
        return { kind: "one_off", at };
      }
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Pet selection validation (add mode only) — checked BEFORE in-flight guard
    if (!isEdit && petIds.length === 0) {
      setPetError(t("tasks.error.pet_required"));
      return;
    }

    if (inFlightRef.current) return;

    // Client-side type check
    if (!taskType) {
      setTypeError(t("tasks.error.type_required"));
      return;
    }
    setTypeError("");

    // ── Field-format validation (engine assumes valid HH:MM + Jalali dates) ──
    const needsTimes =
      scheduleKind === "daily_times" || scheduleKind === "weekdays";
    if (scheduleKind === "weekdays" && weekdays.length === 0) {
      setScheduleError(t("tasks.error.days_required"));
      return;
    }
    if (needsTimes && (times.length === 0 || !times.every(isValidTime))) {
      setScheduleError(t("tasks.error.invalid_time"));
      return;
    }
    if (scheduleKind === "one_off") {
      if (!jalaliToGregorian(oneOffDate)) {
        setScheduleError(t("tasks.error.invalid_date"));
        return;
      }
      if (!isValidTime(oneOffTime)) {
        setScheduleError(t("tasks.error.invalid_time"));
        return;
      }
    }
    setScheduleError("");

    // End-condition validation — an invalid "until" date must not silently
    // collapse to "never"; an after_n needs a positive count.
    if (endKind === "until" && !jalaliToGregorian(endUntilDate)) {
      setEndError(t("tasks.error.invalid_date"));
      return;
    }
    if (endKind === "after_n" && !(parseInt(endCount, 10) > 0)) {
      setEndError(t("tasks.error.count_required"));
      return;
    }
    setEndError("");

    // Build end condition
    const resolvedEndKind: EndKind = endKind;
    const endUntilGreg =
      endKind === "until" && endUntilDate
        ? jalaliToGregorian(endUntilDate)
        : null;
    const resolvedEndUntil = endUntilGreg
      ? toUtcIso("00:00", endUntilGreg)
      : null;
    const resolvedEndCount =
      endKind === "after_n" && endCount ? parseInt(endCount, 10) : null;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      // buildSchedule may throw (e.g. invalid Jalali date) — inside try so error surfaces
      const schedule = buildSchedule();
      const baseInput = {
        type: taskType,
        title: title.trim() || null,
        schedule,
        endKind: resolvedEndKind,
        endUntil: resolvedEndUntil,
        endCount: resolvedEndCount,
        active: true,
      };

      if (isEdit && taskId) {
        await updateTask(taskId, baseInput);
      } else {
        for (const pid of petIds) {
          await addTask({ ...baseInput, petId: pid });
        }
      }
      navigation.goBack();
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      // Surface translated store validation errors
      if (key === "tasks.error.schedule_empty") {
        setScheduleError(t("tasks.error.schedule_required"));
      } else if (key) {
        setScheduleError(t(key) !== key ? t(key) : key);
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Pet picker (add) / pet name read-only (edit) ──────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("tasks.field.pet")}</Text>
            {isEdit ? (
              <Text testID="taskform-pet-name" style={styles.label}>
                {pets.find((p) => p.id === existing?.petId)?.name ?? ""}
              </Text>
            ) : (
              <>
                <View style={styles.chipRow}>
                  {pets.map((pet) => (
                    <Pressable
                      key={pet.id}
                      testID={`taskform-pet-${pet.id}`}
                      onPress={() => togglePet(pet.id)}
                      style={[
                        styles.chip,
                        petIds.includes(pet.id) && styles.chipSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: petIds.includes(pet.id) }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          petIds.includes(pet.id) && styles.chipTextSelected,
                        ]}
                      >
                        {pet.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {petError !== "" && (
                  <Text style={styles.errorText}>{petError}</Text>
                )}
              </>
            )}
          </View>

          {/* ── Type chips ─────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("tasks.field.type")}</Text>
            <View style={styles.chipRow}>
              {TASK_TYPES.map((ct) => (
                <Pressable
                  key={ct}
                  testID={`taskform-type-${ct}`}
                  onPress={() => {
                    setTaskType(ct);
                    if (typeError) setTypeError("");
                  }}
                  style={[styles.chip, taskType === ct && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: taskType === ct }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      taskType === ct && styles.chipTextSelected,
                    ]}
                  >
                    {t(`tasks.type.${ct}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {typeError !== "" && (
              <Text style={styles.errorText}>{typeError}</Text>
            )}
          </View>

          {/* ── Optional title ─────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("tasks.field.title")}</Text>
            <TextField
              testID="taskform-title"
              placeholder={
                taskType ? t(`tasks.type.${taskType}`) : t("tasks.field.title")
              }
              value={title}
              onChangeText={setTitle}
              accessibilityLabel={t("tasks.field.title")}
            />
          </View>

          {/* ── Schedule kind selector ─────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("tasks.field.schedule")}</Text>
            <View style={styles.chipRow}>
              {SCHEDULE_KINDS.map((kind) => (
                <Pressable
                  key={kind}
                  testID={`taskform-schedule-${kind}`}
                  onPress={() => {
                    setScheduleKind(kind);
                    if (scheduleError) setScheduleError("");
                  }}
                  style={[
                    styles.chip,
                    scheduleKind === kind && styles.chipSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scheduleKind === kind }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      scheduleKind === kind && styles.chipTextSelected,
                    ]}
                  >
                    {t(`tasks.schedule.${kind}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── daily_times inputs ─────────────────────────────────────────── */}
          {scheduleKind === "daily_times" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t("tasks.schedule.times")}</Text>
              {times.map((t_, idx) => (
                <View key={idx} style={styles.timeRow}>
                  <View style={styles.timeInputWrap}>
                    <TimePickerField
                      testID={`taskform-time-${idx}`}
                      value={t_}
                      onChange={(v) => updateTime(idx, v)}
                      accessibilityLabel={t("tasks.schedule.times")}
                    />
                  </View>
                  {times.length > 1 && (
                    <Pressable
                      testID={`taskform-time-remove-${idx}`}
                      onPress={() => removeTime(idx)}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={t("tasks.action.remove_time")}
                    >
                      <Text style={styles.removeText}>−</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable
                testID="taskform-time-add"
                onPress={addTime}
                style={styles.ghostAddButton}
                accessibilityRole="button"
              >
                <Text style={styles.ghostAddText}>
                  + {t("tasks.schedule.times")}
                </Text>
              </Pressable>
              {scheduleError !== "" && (
                <Text style={styles.errorText}>{scheduleError}</Text>
              )}
            </View>
          )}

          {/* ── weekdays inputs ────────────────────────────────────────────── */}
          {scheduleKind === "weekdays" && (
            <View style={styles.fieldGroup}>
              {/* Weekday toggles */}
              <Text style={styles.label}>{t("tasks.schedule.days")}</Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_KEYS.map((key, idx) => (
                  <Pressable
                    key={key}
                    testID={`taskform-day-${idx}`}
                    onPress={() => toggleWeekday(idx)}
                    style={[
                      styles.weekdayCell,
                      weekdays.includes(idx) && styles.weekdayCellSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: weekdays.includes(idx) }}
                  >
                    <Text
                      style={[
                        styles.weekdayText,
                        weekdays.includes(idx) && styles.weekdayTextSelected,
                      ]}
                    >
                      {t(`tasks.weekday.${key}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Times for weekdays */}
              <Text style={[styles.label, { marginTop: spacing.md }]}>
                {t("tasks.schedule.times")}
              </Text>
              {times.map((t_, idx) => (
                <View key={idx} style={styles.timeRow}>
                  <View style={styles.timeInputWrap}>
                    <TimePickerField
                      testID={`taskform-wday-time-${idx}`}
                      value={t_}
                      onChange={(v) => updateTime(idx, v)}
                      accessibilityLabel={t("tasks.schedule.times")}
                    />
                  </View>
                  {times.length > 1 && (
                    <Pressable
                      testID={`taskform-wday-time-remove-${idx}`}
                      onPress={() => removeTime(idx)}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={t("tasks.action.remove_time")}
                    >
                      <Text style={styles.removeText}>−</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable
                testID="taskform-wday-time-add"
                onPress={addTime}
                style={styles.ghostAddButton}
                accessibilityRole="button"
              >
                <Text style={styles.ghostAddText}>
                  + {t("tasks.schedule.times")}
                </Text>
              </Pressable>
              {scheduleError !== "" && (
                <Text style={styles.errorText}>{scheduleError}</Text>
              )}
            </View>
          )}

          {/* ── interval inputs ─────────────────────────────────────────────── */}
          {scheduleKind === "interval" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t("tasks.schedule.interval_n")}</Text>
              <View style={styles.intervalRow}>
                <View style={styles.intervalNWrap}>
                  <TextField
                    testID="taskform-interval-n"
                    placeholder="1"
                    value={intervalN}
                    onChangeText={(v) => {
                      setIntervalN(v);
                      if (scheduleError) setScheduleError("");
                    }}
                    keyboardType="numeric"
                    accessibilityLabel={t("tasks.schedule.interval_n")}
                  />
                </View>
                <View style={styles.chipRow}>
                  {INTERVAL_UNITS.map((u) => (
                    <Pressable
                      key={u}
                      testID={`taskform-unit-${u}`}
                      onPress={() => setIntervalUnit(u)}
                      style={[
                        styles.chip,
                        intervalUnit === u && styles.chipSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: intervalUnit === u }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          intervalUnit === u && styles.chipTextSelected,
                        ]}
                      >
                        {t(`tasks.schedule.unit.${u}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {scheduleError !== "" && (
                <Text style={styles.errorText}>{scheduleError}</Text>
              )}
            </View>
          )}

          {/* ── one_off inputs ─────────────────────────────────────────────── */}
          {scheduleKind === "one_off" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t("tasks.field.date")}</Text>
              <DatePickerField
                testID="taskform-oneoff-date"
                value={oneOffDate}
                onChange={(v) => {
                  setOneOffDate(v);
                  if (scheduleError) setScheduleError("");
                }}
                accessibilityLabel={t("tasks.field.date")}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>
                {t("tasks.schedule.time")}
              </Text>
              <TimePickerField
                testID="taskform-oneoff-time"
                value={oneOffTime}
                onChange={(v) => {
                  setOneOffTime(v);
                  if (scheduleError) setScheduleError("");
                }}
                accessibilityLabel={t("tasks.schedule.time")}
              />
              {scheduleError !== "" && (
                <Text style={styles.errorText}>{scheduleError}</Text>
              )}
            </View>
          )}

          {/* ── End condition (not applicable to one-off tasks) ──────────────── */}
          {scheduleKind !== "one_off" && (
            <>
              <View style={styles.divider} />

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {t("tasks.field.end_condition")}
                </Text>
                <View style={styles.chipRow}>
                  {END_KINDS.map((ek) => (
                    <Pressable
                      key={ek}
                      testID={`taskform-end-${ek}`}
                      onPress={() => {
                        setEndKind(ek);
                        if (endError) setEndError("");
                      }}
                      style={[
                        styles.chip,
                        endKind === ek && styles.chipSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: endKind === ek }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          endKind === ek && styles.chipTextSelected,
                        ]}
                      >
                        {t(`tasks.end.${ek}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {endKind === "until" && (
                  <View style={{ marginTop: spacing.sm }}>
                    <DatePickerField
                      testID="taskform-end-until-date"
                      value={endUntilDate}
                      onChange={(v) => {
                        setEndUntilDate(v);
                        if (endError) setEndError("");
                      }}
                      accessibilityLabel={t("tasks.end.until")}
                    />
                  </View>
                )}

                {endKind === "after_n" && (
                  <View style={{ marginTop: spacing.sm }}>
                    <TextField
                      testID="taskform-end-count"
                      placeholder="10"
                      value={endCount}
                      onChangeText={(v) => {
                        setEndCount(v);
                        if (endError) setEndError("");
                      }}
                      keyboardType="numeric"
                      accessibilityLabel={t("tasks.end.after_n")}
                    />
                  </View>
                )}

                {endError !== "" && (
                  <Text style={styles.errorText}>{endError}</Text>
                )}
              </View>
            </>
          )}

          {/* ── Submit ─────────────────────────────────────────────────────── */}
          <Button
            testID="taskform-submit"
            label={isEdit ? t("tasks.edit") : t("tasks.add")}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
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

  // Chips (type / schedule-kind / end-kind)
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    alignItems: "center",
    justifyContent: "center",
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

  // Time rows
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timeInputWrap: {
    flex: 1,
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    fontSize: 20,
    color: colors.danger,
    fontFamily: fonts.semibold,
  },

  // Ghost "add time" button
  ghostAddButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ghostAddText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },

  // Weekday cells — compact 44×44 grid
  weekdayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  weekdayCell: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayCellSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  weekdayText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  weekdayTextSelected: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },

  // Interval row
  intervalRow: {
    gap: spacing.sm,
  },
  intervalNWrap: {
    width: "40%",
  },

  // Divider between schedule and end-condition sections
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // Errors
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
});
