import React, { useState } from "react";
import {
  Dimensions,
  Image,
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
import { useShallow } from "zustand/react/shallow";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { usePetsStore } from "../../store/petsStore";
import { useTasksStore } from "../../store/tasksStore";
import { getPet } from "../../db/pets";
import { nextOccurrence } from "../../lib/taskSchedule";
import {
  nextTaskLabel,
  nextTaskRowParts,
  type NextTaskRowParts,
} from "./nextTaskLabel";
import { toPersianDigits } from "../../lib/jalali";
import {
  colors,
  fonts,
  radius,
  shadow,
  spacing,
  typography,
} from "../../theme/theme";
import { SPECIES_ICON, TASK_TYPE_ICON } from "../../theme/icons";
import type {
  PetsStackParamList,
  PetsNavigationProp,
} from "../../navigation/PetsStack";
import type { Pet, Task } from "../../db/types";

type PetDetailRouteProp = RouteProp<PetsStackParamList, "PetDetail">;

function speciesLabel(pet: Pet, t: (key: string) => string): string {
  return pet.species === "other" && pet.speciesOther
    ? pet.speciesOther
    : t(`pets.species.${pet.species}`);
}

const HERO_HEIGHT = 280;
const SCREEN_WIDTH = Dimensions.get("window").width;
const NEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_ROW_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

/** Short schedule summary for the tasks list row */
function scheduleLabel(
  t: (key: string) => string,
  task: { schedule: { kind: string } },
): string {
  const kind = task.schedule.kind;
  return t(`tasks.schedule.${kind}`);
}

/** Next-occurrence day/date/time for a single task row, or null if inactive/none upcoming. */
function taskRowDate(
  t: (key: string, opts?: Record<string, unknown>) => string,
  task: Task,
  now: Date,
): NextTaskRowParts | null {
  if (!task.active) return null;
  const next = nextOccurrence(
    [task],
    now,
    new Date(now.getTime() + TASK_ROW_WINDOW_MS),
  );
  return next ? nextTaskRowParts(t, next, now) : null;
}

export default function PetDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const route = useRoute<PetDetailRouteProp>();
  const { petId } = route.params;

  const remove = usePetsStore((s) => s.remove);
  // Prefer the in-memory store list; fall back to a direct read.
  const pet =
    usePetsStore((s) => s.pets.find((p) => p.id === petId)) ?? getPet(petId);

  // Tasks for this pet — useShallow prevents infinite re-render from new array ref each call (zustand v5)
  const petTasks = useTasksStore(
    useShallow((s) => s.tasks.filter((c) => c.petId === petId)),
  );
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!pet) return null;

  const now = new Date();
  const activeTasks = petTasks.filter((c) => c.active);
  let nextLabel: string | null = null;
  if (activeTasks.length > 0) {
    const next = nextOccurrence(
      activeTasks,
      now,
      new Date(now.getTime() + NEXT_WINDOW_MS),
    );
    if (next) nextLabel = nextTaskLabel(t, next, now);
  }

  const handleConfirmDelete = async () => {
    setConfirmVisible(false);
    await remove(petId);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Hero zone ───────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {pet.photoUri != null ? (
            <Image
              testID="petdetail-photo"
              source={{ uri: pet.photoUri }}
              style={styles.heroPhoto}
              resizeMode="cover"
              accessibilityLabel={pet.name}
            />
          ) : (
            <MaterialCommunityIcons
              name={SPECIES_ICON[pet.species]}
              size={96}
              color={colors.inkFaint}
            />
          )}

          <View style={styles.heroScrim}>
            <Text style={styles.heroName} numberOfLines={1}>
              {pet.name}
            </Text>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{speciesLabel(pet, t)}</Text>
            </View>
          </View>
        </View>

        {/* ── Info card ───────────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t("pets.field.species")}</Text>
            <Text style={styles.value}>{speciesLabel(pet, t)}</Text>
          </View>

          {pet.gender != null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t("pets.field.gender")}</Text>
              <Text style={styles.value}>{t(`pets.gender.${pet.gender}`)}</Text>
            </View>
          )}

          {pet.breed != null && pet.breed !== "" && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t("pets.field.breed")}</Text>
              <Text style={styles.value}>{pet.breed}</Text>
            </View>
          )}

          {pet.weightValue != null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t("pets.field.weight")}</Text>
              <Text style={styles.value}>
                {pet.weightValue} {t(`pets.unit.${pet.weightUnit}`)}
              </Text>
            </View>
          )}

          {pet.notes != null && pet.notes !== "" && (
            <View style={styles.notesGroup}>
              <Text style={styles.label}>{t("pets.field.notes")}</Text>
              <Text style={styles.value}>{pet.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Tasks section ──────────────────────────────────────────────── */}
        <View style={styles.tasksSection}>
          <Text style={styles.tasksSectionTitle}>
            {t("tasks.section_title")}
          </Text>

          {activeTasks.length > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.summaryText}>
                  {t("pets.active_tasks", {
                    count: toPersianDigits(activeTasks.length),
                  })}
                </Text>
              </View>
              {nextLabel && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.summaryText}>{nextLabel}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {petTasks.length === 0 ? (
            <Text style={styles.tasksEmpty}>
              {t("pets.tasks_empty", { name: pet.name })}
            </Text>
          ) : (
            petTasks.map((task, idx) => {
              const rowDate = taskRowDate(t, task, now);
              return (
                <Pressable
                  key={task.id}
                  testID={`petdetail-task-${task.id}`}
                  onPress={() =>
                    navigation.navigate("TaskForm", { petId, taskId: task.id })
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.taskRow,
                    idx < petTasks.length - 1 && styles.taskRowBorder,
                    pressed && styles.taskRowPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={TASK_TYPE_ICON[task.type]}
                    size={22}
                    color={colors.inkMuted}
                    style={styles.taskIcon}
                  />
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskTitle}>
                      {task.title ?? t(`tasks.type.${task.type}`)}
                    </Text>
                    <Text style={styles.taskSchedule}>
                      {scheduleLabel(t, task)}
                    </Text>
                  </View>
                  {rowDate && (
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskMetaPrimary} numberOfLines={1}>
                        {rowDate.primary}
                      </Text>
                      <Text style={styles.taskMetaSecondary} numberOfLines={1}>
                        {rowDate.secondary}
                      </Text>
                    </View>
                  )}
                  {!task.active && (
                    <Text style={styles.taskPausedTag}>
                      {t("tasks.status.paused")}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.actions}>
          <Button
            testID="petdetail-edit"
            variant="secondary"
            label={t("pets.edit")}
            onPress={() => navigation.navigate("PetForm", { petId })}
          />

          <Pressable
            testID="petdetail-delete"
            onPress={() => setConfirmVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("pets.delete")}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
          >
            <Text style={styles.deleteText}>{t("pets.delete")}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <ConfirmDialog
        testID="pet-delete-confirm"
        visible={confirmVisible}
        title={t("pets.delete")}
        message={t("pets.delete_confirm")}
        confirmLabel={t("pets.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhoto: {
    position: "absolute",
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroScrim: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    height: 100,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heroName: {
    flexShrink: 1,
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  heroChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  heroChipText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
  },
  // ── Info card ───────────────────────────────────────────────────────────────
  infoCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  notesGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  value: {
    flexShrink: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.ink,
    textAlign: "right",
  },
  // ── Tasks section ──────────────────────────────────────────────────────────
  tasksSection: {
    marginHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  tasksSectionTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.primary,
    opacity: 0.25,
    marginHorizontal: spacing.md,
  },
  summaryText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  taskRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  taskRowPressed: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
  },
  taskIcon: {
    width: 32,
    textAlign: "center",
  },
  taskInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  taskTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  taskSchedule: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  taskMeta: {
    alignItems: "flex-end",
  },
  taskMetaPrimary: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
    textAlign: "right",
  },
  taskMetaSecondary: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "right",
  },
  tasksEmpty: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkFaint,
    paddingVertical: spacing.sm,
  },
  taskPausedTag: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  // ────────────────────────────────────────────────────────────────────────────
  actions: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  deleteButton: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.dangerSoft,
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
  deleteText: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.danger,
  },
});
