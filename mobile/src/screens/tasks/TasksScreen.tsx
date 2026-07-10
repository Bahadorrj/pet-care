import React from "react";
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Toast from "react-native-toast-message";
import * as Haptics from "expo-haptics";
import { useTasksStore } from "../../store/tasksStore";
import { usePetsStore } from "../../store/petsStore";
import {
  colors,
  fonts,
  radius,
  shadow,
  spacing,
  typography,
} from "../../theme/theme";
import { TASK_TYPE_ICON } from "../../theme/icons";
import { utcIsoToTehranJalali, toPersianDigits } from "../../lib/jalali";
import { tehranDayOffset } from "../../lib/taskSchedule";
import { bucketOccurrences, tomorrowSameTime } from "./todayBuckets";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import type { Occurrence, Task, TaskType } from "../../db/types";
import type { TasksNavigationProp } from "../../navigation/TasksStack";

// ── Tehran time helper ─────────────────────────────────────────────────────────
// ponytail: mirrors utcIsoToTehranTime in TaskFormScreen — shift +210 min, read UTC fields
function toTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Haptics are a delight, never load-bearing — swallow failures (web / no actuator).
const hapticSuccess = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
const hapticLight = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

const TASK_TYPES: TaskType[] = [
  "feeding",
  "water",
  "meds",
  "play",
  "grooming",
  "vet",
  "other",
];

// ── Section list item types ────────────────────────────────────────────────────
type SectionKind = "overdue" | "today" | "upcoming" | "completed";

// Items can be real occurrences, day sub-headers, or a filter no-match row
type ListItem =
  | { kind: "occ"; occ: Occurrence }
  | { kind: "day"; label: string }
  | { kind: "nomatch"; sectionKey: SectionKind };

interface Section {
  sectionKey: SectionKind;
  data: ListItem[];
}

// ── Row ────────────────────────────────────────────────────────────────────────
type RowProps = {
  occ: Occurrence;
  petName: string;
  future: boolean;
  onCheck: (occ: Occurrence) => void;
  onEdit: (occ: Occurrence) => void;
  onMore: (occ: Occurrence) => void;
};

const OccurrenceRow = React.memo(function OccurrenceRow({
  occ,
  petName,
  future,
  onCheck,
  onEdit,
  onMore,
}: RowProps) {
  const { t } = useTranslation();
  const { task, dueAt, status } = occ;
  const isFinal = status === "done" || status === "skipped";
  const isDone = status === "done";
  const lockDone = future && !isFinal;

  return (
    <Pressable
      testID={`tasks-row-${task.id}`}
      style={[styles.row, isFinal && styles.rowDimmed]}
      onPress={() => onEdit(occ)}
      accessibilityRole="button"
      accessibilityLabel={`${petName} — ${task.title ?? t(`tasks.type.${task.type}`)}`}
    >
      {/* Leading checkbox — the single completion affordance */}
      <Pressable
        testID={`tasks-check-${task.id}`}
        onPress={() => onCheck(occ)}
        disabled={lockDone}
        style={styles.checkbox}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFinal, disabled: lockDone }}
        accessibilityLabel={
          isFinal ? t("tasks.undo.action") : t("tasks.action.mark_done")
        }
      >
        <MaterialCommunityIcons
          name={
            isDone
              ? "checkbox-marked-circle"
              : status === "skipped"
                ? "minus-circle-outline"
                : "checkbox-blank-circle-outline"
          }
          size={24}
          color={
            isDone
              ? colors.primary
              : lockDone
                ? colors.inkFaint
                : colors.inkMuted
          }
        />
      </Pressable>

      {/* Type icon — a category signifier, not an action: stays neutral */}
      <MaterialCommunityIcons
        name={TASK_TYPE_ICON[task.type]}
        size={22}
        color={colors.inkMuted}
        style={styles.typeIcon}
        accessibilityLabel={t(`tasks.type.${task.type}`)}
      />

      {/* Middle: info */}
      <View style={styles.rowInfo}>
        <Text style={styles.petName} numberOfLines={1}>
          {petName}
        </Text>
        <Text
          style={[styles.taskTitle, isFinal && styles.dimmedText]}
          numberOfLines={1}
        >
          {task.title ?? t(`tasks.type.${task.type}`)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>
            {toPersianDigits(toTehranTime(dueAt))}
          </Text>
          {status === "skipped" && (
            <Text style={styles.skippedTag}>{t("tasks.status.skipped")}</Text>
          )}
        </View>
      </View>

      {/* Trailing ⋯ button — opens the full action menu */}
      <Pressable
        testID={`tasks-more-${task.id}`}
        onPress={() => onMore(occ)}
        style={styles.moreBtn}
        accessibilityRole="button"
        accessibilityLabel={t("tasks.action.more")}
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name="dots-horizontal"
          size={20}
          color={colors.inkMuted}
        />
      </Pressable>
    </Pressable>
  );
});

// ── Type filter modal ──────────────────────────────────────────────────────────
type TypeFilterModalProps = {
  visible: boolean;
  selected: Set<TaskType>;
  onApply: (next: Set<TaskType>) => void;
  onClose: () => void;
};

function TypeFilterModal({
  visible,
  selected,
  onApply,
  onClose,
}: TypeFilterModalProps) {
  const { t } = useTranslation();
  // Local draft state — committed on Apply
  const [draft, setDraft] = React.useState<Set<TaskType>>(new Set(selected));

  // Sync draft when modal opens with external selected — deliberate prop→state seed.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) setDraft(new Set(selected));
  }, [visible, selected]);

  function toggle(ct: TaskType) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(ct)) next.delete(ct);
      else next.add(ct);
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.modalSheet}
          onPress={() => {
            /* swallow */
          }}
        >
          <View style={styles.chipRow}>
            {TASK_TYPES.map((ct) => {
              const isSelected = draft.has(ct);
              return (
                <Pressable
                  key={ct}
                  testID={`type-chip-${ct}`}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggle(ct)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {t(`tasks.type.${ct}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.modalFooter}>
            <Pressable
              testID="type-filter-clear"
              style={styles.modalClearBtn}
              onPress={() => setDraft(new Set())}
            >
              <Text style={styles.modalClearText}>
                {t("tasks.filter.clear")}
              </Text>
            </Pressable>
            <Pressable
              testID="type-filter-apply"
              style={styles.modalApplyBtn}
              onPress={() => onApply(draft)}
            >
              <Text style={styles.modalApplyText}>
                {t("tasks.filter.apply")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<TasksNavigationProp>();
  const { showActionSheetWithOptions } = useActionSheet();

  const windowOccurrences = useTasksStore((s) => s.windowOccurrences);
  const load = useTasksStore((s) => s.load);
  const markOccurrence = useTasksStore((s) => s.markOccurrence);
  const unmarkOccurrence = useTasksStore((s) => s.unmarkOccurrence);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const toggleActive = useTasksStore((s) => s.toggleActive);
  const updateTask = useTasksStore((s) => s.updateTask);

  const pets = usePetsStore(useShallow((s) => s.pets));

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [petFilter, setPetFilter] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<Set<TaskType>>(new Set());
  const [typeModalVisible, setTypeModalVisible] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Task | null>(null);

  // ── Collapsible sections — in-memory only, default expanded ──────────────────
  const [collapsed, setCollapsed] = React.useState<
    Record<SectionKind, boolean>
  >({
    overdue: false,
    today: false,
    upcoming: false,
    completed: true,
  });
  const toggleSection = React.useCallback((key: SectionKind) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Reload on focus, but defer the recompute + list re-render past the
  // tab-transition animation so entering the Tasks tab doesn't stutter.
  useFocusEffect(
    React.useCallback(() => {
      const handle = requestIdleCallback(load);
      return () => cancelIdleCallback(handle);
    }, [load]),
  );

  const petNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pets) map[p.id] = p.name;
    return map;
  }, [pets]);

  const hasFilters = petFilter !== null || typeFilter.size > 0;

  // Apply filters before bucketing
  const filtered = React.useMemo(
    () =>
      windowOccurrences.filter(
        (o) =>
          (petFilter === null || o.task.petId === petFilter) &&
          (typeFilter.size === 0 || typeFilter.has(o.task.type)),
      ),
    [windowOccurrences, petFilter, typeFilter],
  );

  // Genuine = bucketed straight from the window (pre-filter) — decides whether
  // a section's header renders at all (ADR-0020 gate). Shown = what's actually
  // rendered; when filters narrow it to nothing the section keeps its header
  // with a quiet no-match row instead of disappearing.
  const genuine = React.useMemo(
    () => bucketOccurrences(windowOccurrences, new Date()),
    [windowOccurrences],
  );
  const { overdue, today, upcoming, completed, progress } = React.useMemo(
    () => (hasFilters ? bucketOccurrences(filtered, new Date()) : genuine),
    [hasFilters, filtered, genuine],
  );

  // Stable row handlers — keep memoized rows from re-rendering on unrelated
  // parent updates (filter chips, modal open/close).
  const handleCheck = React.useCallback(
    (occ: Occurrence) => {
      const { task, dueAt, status } = occ;
      if (status === "done" || status === "skipped") {
        hapticLight();
        unmarkOccurrence(task.id, dueAt);
        return;
      }
      hapticSuccess();
      markOccurrence(task.id, dueAt, "done");
      Toast.show({
        type: "taskDone",
        props: { petName: petNameById[task.petId] },
        visibilityTime: 4000,
      });
    },
    [markOccurrence, unmarkOccurrence, petNameById],
  );

  const handleEdit = React.useCallback(
    (occ: Occurrence) => {
      navigation.navigate("TaskForm", {
        petId: occ.task.petId,
        taskId: occ.task.id,
      });
    },
    [navigation],
  );

  const handleMore = React.useCallback(
    (occ: Occurrence) => {
      const { task, dueAt, status } = occ;
      const deleteLabel =
        task.schedule.kind === "one_off"
          ? t("tasks.action.delete_one_off")
          : t("tasks.action.delete_recurring");

      const oneOffSchedule =
        task.schedule.kind === "one_off" ? task.schedule : null;
      const canPostpone =
        oneOffSchedule !== null &&
        status !== "done" &&
        status !== "skipped" &&
        tehranDayOffset(dueAt) <= 0;

      const entries: {
        label: string;
        onPress?: () => void;
        destructive?: true;
      }[] = [];
      if (canPostpone && oneOffSchedule) {
        entries.push({
          label: t("tasks.action.postpone"),
          onPress: () => {
            hapticLight();
            updateTask(task.id, {
              type: task.type,
              title: task.title,
              schedule: {
                kind: "one_off",
                at: tomorrowSameTime(oneOffSchedule.at, new Date()),
              },
              endKind: task.endKind,
              endUntil: task.endUntil,
              endCount: task.endCount,
              active: task.active,
            });
          },
        });
      }
      entries.push(
        {
          label: t("tasks.action.skip"),
          onPress: () => markOccurrence(task.id, dueAt, "skipped"),
        },
        { label: t("tasks.action.edit"), onPress: () => handleEdit(occ) },
        {
          label: t("tasks.action.pause"),
          onPress: () => toggleActive(task.id),
        },
        {
          label: deleteLabel,
          onPress: () => setPendingDelete(task),
          destructive: true,
        },
        { label: t("tasks.action.cancel") },
      );

      const options = entries.map((e) => e.label);
      const destructiveButtonIndex = entries.findIndex((e) => e.destructive);
      const cancelButtonIndex = entries.length - 1;

      showActionSheetWithOptions(
        { options, destructiveButtonIndex, cancelButtonIndex },
        (index?: number) => {
          if (index === undefined) return;
          entries[index]?.onPress?.();
        },
      );
    },
    [
      showActionSheetWithOptions,
      toggleActive,
      updateTask,
      markOccurrence,
      t,
      handleEdit,
    ],
  );

  // Adding a task needs a pet. With none, hint instead of dead-ending in an
  // empty TaskForm picker; tapping the toast jumps to the Pets tab.
  const handleAdd = React.useCallback(() => {
    if (pets.length === 0) {
      Toast.show({
        type: "hint",
        text1: t("tasks.no_pets_hint"),
        onPress: () => {
          Toast.hide();
          navigation.getParent()?.navigate("Pets");
        },
      });
      return;
    }
    navigation.navigate("TaskForm", {});
  }, [pets.length, navigation, t]);

  const shownTotal =
    overdue.length + today.length + upcoming.length + completed.length;
  const genuineTotal =
    genuine.overdue.length +
    genuine.today.length +
    genuine.upcoming.length +
    genuine.completed.length;
  // Filters wiped every section that had data — one whole-list message beats
  // a no-match row under every header.
  const fullWipe = hasFilters && genuineTotal > 0 && shownTotal === 0;

  // Section list data — rebuilt only when the buckets change, not on every
  // render (filter chips / modal). Includes the upcoming day sub-headers.
  const { sections, counts } = React.useMemo(() => {
    const upcomingItems: ListItem[] = [];
    let lastDay = "";
    for (const occ of upcoming) {
      const day = utcIsoToTehranJalali(occ.dueAt);
      if (day !== lastDay) {
        upcomingItems.push({ kind: "day", label: day });
        lastDay = day;
      }
      upcomingItems.push({ kind: "occ", occ });
    }

    const sections: Section[] = [];
    if (!fullWipe) {
      if (genuine.overdue.length > 0)
        sections.push({
          sectionKey: "overdue",
          data: collapsed.overdue
            ? []
            : overdue.length === 0
              ? [{ kind: "nomatch", sectionKey: "overdue" }]
              : overdue.map((occ) => ({ kind: "occ", occ })),
        });
      if (genuine.today.length > 0)
        sections.push({
          sectionKey: "today",
          data: collapsed.today
            ? []
            : today.length === 0
              ? [{ kind: "nomatch", sectionKey: "today" }]
              : today.map((occ) => ({ kind: "occ", occ })),
        });
      if (genuine.upcoming.length > 0)
        sections.push({
          sectionKey: "upcoming",
          data: collapsed.upcoming
            ? []
            : upcoming.length === 0
              ? [{ kind: "nomatch", sectionKey: "upcoming" }]
              : upcomingItems,
        });
      if (genuine.completed.length > 0)
        sections.push({
          sectionKey: "completed",
          data: collapsed.completed
            ? []
            : completed.length === 0
              ? [{ kind: "nomatch", sectionKey: "completed" }]
              : completed.map((occ) => ({ kind: "occ", occ })),
        });
    }

    const counts: Record<SectionKind, number> = {
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
      completed: completed.length,
    };

    return { sections, counts };
  }, [overdue, today, upcoming, completed, genuine, collapsed, fullWipe]);

  // Genuine empty: nothing actionable anywhere (and not a filter artifact)
  if (genuineTotal === 0 && !hasFilters) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.emptyContainer} testID="tasks-empty">
          <MaterialCommunityIcons
            name="leaf"
            size={48}
            color={colors.inkMuted}
          />
          <Text style={styles.emptyTitle}>{t("tasks.empty_title")}</Text>
          <Text style={styles.emptySubtitle}>{t("tasks.empty_subtitle")}</Text>
        </View>
        <Pressable
          testID="tasks-fab"
          onPress={handleAdd}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("tasks.add")}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── List header: progress + filter bar ───────────────────────────────────────
  const ListHeader = (
    <View>
      {/* Progress indicator (today only, hidden when denominator is 0) */}
      {progress.total > 0 && (
        <View style={styles.progressContainer} testID="tasks-progress">
          <View style={styles.progressDotsRow}>
            {Array.from({ length: progress.total }, (_, i) => (
              <View
                key={i}
                testID="progress-dot"
                style={[
                  styles.progressDot,
                  i < progress.done && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>
            {progress.done === progress.total
              ? t("tasks.progress_all_done")
              : t("tasks.progress", {
                  done: progress.done,
                  total: progress.total,
                })}
          </Text>
        </View>
      )}

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {/* Pet chips: All + one per pet */}
        <Pressable
          testID="tasks-filter-pet-all"
          style={[
            styles.filterChip,
            petFilter === null && styles.filterChipSelected,
          ]}
          onPress={() => setPetFilter(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: petFilter === null }}
        >
          <Text
            style={[
              styles.filterChipText,
              petFilter === null && styles.filterChipTextSelected,
            ]}
          >
            {t("tasks.filter.all")}
          </Text>
        </Pressable>
        {pets.map((p) => (
          <Pressable
            key={p.id}
            testID={`tasks-filter-pet-${p.id}`}
            style={[
              styles.filterChip,
              petFilter === p.id && styles.filterChipSelected,
            ]}
            onPress={() => setPetFilter(petFilter === p.id ? null : p.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: petFilter === p.id }}
          >
            <Text
              style={[
                styles.filterChipText,
                petFilter === p.id && styles.filterChipTextSelected,
              ]}
            >
              {p.name}
            </Text>
          </Pressable>
        ))}

        {/* Type filter button */}
        <Pressable
          testID="tasks-type-filter"
          style={[
            styles.filterChip,
            typeFilter.size > 0 && styles.filterChipSelected,
          ]}
          onPress={() => setTypeModalVisible(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: typeFilter.size > 0 }}
        >
          <Text
            style={[
              styles.filterChipText,
              typeFilter.size > 0 && styles.filterChipTextSelected,
            ]}
          >
            {t("tasks.filter.type")}
            {typeFilter.size > 0 ? ` (${typeFilter.size})` : ""}
          </Text>
        </Pressable>
      </View>

      {/* No-match state when filters empty everything but window has data */}
      {fullWipe && (
        <View style={styles.noMatchContainer} testID="tasks-no-match">
          <Text style={styles.noMatchText}>{t("tasks.no_match")}</Text>
          <Pressable
            onPress={() => {
              setPetFilter(null);
              setTypeFilter(new Set());
            }}
          >
            <Text style={styles.clearFiltersText}>
              {t("tasks.filter.clear")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <TypeFilterModal
        visible={typeModalVisible}
        selected={typeFilter}
        onApply={(next) => {
          setTypeFilter(next);
          setTypeModalVisible(false);
        }}
        onClose={() => setTypeModalVisible(false)}
      />
      <ConfirmDialog
        testID="tasks-delete-confirm"
        visible={pendingDelete !== null}
        title={t("tasks.delete")}
        message={
          pendingDelete?.schedule.kind === "one_off"
            ? t("tasks.delete_confirm")
            : t("tasks.delete_confirm_recurring")
        }
        confirmLabel={t("tasks.action.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          if (pendingDelete) deleteTask(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <Pressable
        testID="tasks-fab"
        onPress={handleAdd}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t("tasks.add")}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => {
          if (item.kind === "occ")
            return `${item.occ.task.id}-${item.occ.dueAt}`;
          if (item.kind === "nomatch") return `nomatch-${item.sectionKey}`;
          return `day-${item.label}-${index}`;
        }}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={ListHeader}
        renderSectionHeader={({ section }) => {
          const sec = section as Section;
          const count = counts[sec.sectionKey];
          const expanded = !collapsed[sec.sectionKey];
          return (
            <Pressable
              style={styles.sectionHeader}
              testID={`tasks-section-${sec.sectionKey}`}
              onPress={() => toggleSection(sec.sectionKey)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Text style={styles.sectionTitle}>
                {`${t(`tasks.section.${sec.sectionKey}`)} · ${toPersianDigits(count)}`}
              </Text>
              <MaterialCommunityIcons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.inkMuted}
              />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, section }) => {
          if (item.kind === "day") {
            return (
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>
                  {toPersianDigits(item.label)}
                </Text>
              </View>
            );
          }
          if (item.kind === "nomatch") {
            return (
              <Text
                style={styles.noMatchSectionText}
                testID="tasks-no-match-row"
              >
                {t("tasks.no_match_section")}
              </Text>
            );
          }
          // kind === 'occ'
          const { occ } = item;
          return (
            <OccurrenceRow
              occ={occ}
              petName={petNameById[occ.task.petId] ?? ""}
              future={(section as Section).sectionKey === "upcoming"}
              onCheck={handleCheck}
              onEdit={handleEdit}
              onMore={handleMore}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    minHeight: 44,
  },
  sectionTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  // Day sub-header (upcoming)
  dayHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dayHeaderText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  // Per-section no-match (filters emptied this section, but not the window)
  noMatchSectionText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    paddingVertical: spacing.md,
  },
  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 64,
    // Opaque so a revealed swipe pane never bleeds through the sliding row.
    backgroundColor: colors.bg,
  },
  rowDimmed: {
    opacity: 0.5,
  },
  checkbox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: {
    width: 28,
    textAlign: "center",
  },
  rowInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  petName: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  taskTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  dimmedText: {
    color: colors.inkMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  time: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  skippedTag: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  moreBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  // Empty state (whole screen)
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "center",
  },
  // Progress indicator
  progressContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  progressDotsRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotDone: {
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  // Filter bar
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  filterChipTextSelected: {
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  // No-match state
  noMatchContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noMatchText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "center",
  },
  clearFiltersText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    end: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...shadow.card,
  },
  fabPressed: {
    opacity: 0.85,
  },
  // Type filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.lg,
  },
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
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  modalClearBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  modalClearText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  modalApplyBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  modalApplyText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.bg,
  },
});
