import React from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';

import { useTasksStore } from '../../store/tasksStore';
import { usePetsStore } from '../../store/petsStore';
import { colors, fonts, radius, shadow, spacing, typography } from '../../theme/theme';
import { TASK_TYPE_ICON } from '../../theme/icons';
import { utcIsoToTehranJalali, toPersianDigits } from '../../lib/jalali';
import { bucketOccurrences } from './todayBuckets';
import type { Occurrence, TaskType } from '../../db/types';
import type { TasksNavigationProp } from '../../navigation/TasksStack';

// ── Tehran time helper ─────────────────────────────────────────────────────────
// ponytail: mirrors utcIsoToTehranTime in TaskFormScreen — shift +210 min, read UTC fields
function toTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Status badge colors
const STATUS_COLOR: Record<Occurrence['status'], string> = {
  pending: colors.inkMuted,
  missed: colors.danger,
  done: colors.primary,
  skipped: colors.inkMuted,
};

const TASK_TYPES: TaskType[] = ['feeding', 'meds', 'play', 'grooming', 'vet', 'other'];

// ── Section list item types ────────────────────────────────────────────────────
type SectionKind = 'overdue' | 'today' | 'upcoming';

// Items can be real occurrences, per-section empty placeholders, or day sub-headers
type ListItem =
  | { kind: 'occ'; occ: Occurrence }
  | { kind: 'empty'; sectionKey: SectionKind }
  | { kind: 'day'; label: string };

interface Section {
  sectionKey: SectionKind;
  data: ListItem[];
}

// ── Row ────────────────────────────────────────────────────────────────────────
type RowProps = {
  occ: Occurrence;
  petName: string;
  onCheck: () => void;
  onMore: () => void;
};

function OccurrenceRow({ occ, petName, onCheck, onMore }: RowProps) {
  const { t } = useTranslation();
  const { task, dueAt, status } = occ;
  const isFinal = status === 'done' || status === 'skipped';

  return (
    <Pressable
      testID={`tasks-row-${task.id}`}
      style={[styles.row, isFinal && styles.rowDimmed]}
      onPress={onMore}
      accessibilityRole="none"
    >
      {/* Leading checkbox */}
      <Pressable
        testID={`tasks-check-${task.id}`}
        onPress={onCheck}
        style={styles.checkbox}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFinal }}
      >
        <MaterialCommunityIcons
          name={isFinal ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={24}
          color={isFinal ? colors.primary : colors.inkFaint}
        />
      </Pressable>

      {/* Type icon */}
      <MaterialCommunityIcons
        name={TASK_TYPE_ICON[task.type]}
        size={22}
        color={isFinal ? colors.inkFaint : colors.primary}
        style={styles.typeIcon}
        accessibilityLabel={t(`tasks.type.${task.type}`)}
      />

      {/* Middle: info */}
      <View style={styles.rowInfo}>
        <Text style={[styles.petName, isFinal && styles.dimmedText]} numberOfLines={1}>
          {petName}
        </Text>
        <Text style={[styles.taskTitle, isFinal && styles.dimmedText]} numberOfLines={1}>
          {task.title ?? t(`tasks.type.${task.type}`)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, isFinal && styles.dimmedText]}>{toPersianDigits(toTehranTime(dueAt))}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
              {t(`tasks.status.${status}`)}
            </Text>
          </View>
        </View>
      </View>

      {/* Trailing ⋯ button */}
      <Pressable
        testID={`tasks-more-${task.id}`}
        onPress={onMore}
        style={styles.moreBtn}
        accessibilityRole="button"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.inkMuted} />
      </Pressable>
    </Pressable>
  );
}

// ── Type filter modal ──────────────────────────────────────────────────────────
type TypeFilterModalProps = {
  visible: boolean;
  selected: Set<TaskType>;
  onApply: (next: Set<TaskType>) => void;
  onClose: () => void;
};

function TypeFilterModal({ visible, selected, onApply, onClose }: TypeFilterModalProps) {
  const { t } = useTranslation();
  // Local draft state — committed on Apply
  const [draft, setDraft] = React.useState<Set<TaskType>>(new Set(selected));

  // Sync draft when modal opens with external selected
  React.useEffect(() => {
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
        <Pressable style={styles.modalSheet} onPress={() => {/* swallow */}}>
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
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
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
              <Text style={styles.modalClearText}>{t('tasks.filter.clear')}</Text>
            </Pressable>
            <Pressable
              testID="type-filter-apply"
              style={styles.modalApplyBtn}
              onPress={() => onApply(draft)}
            >
              <Text style={styles.modalApplyText}>{t('tasks.filter.apply')}</Text>
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
  const isFocused = useIsFocused();
  const navigation = useNavigation<TasksNavigationProp>();
  const { showActionSheetWithOptions } = useActionSheet();

  const windowOccurrences = useTasksStore((s) => s.windowOccurrences);
  const load = useTasksStore((s) => s.load);
  const markOccurrence = useTasksStore((s) => s.markOccurrence);
  const unmarkOccurrence = useTasksStore((s) => s.unmarkOccurrence);
  const deleteTask = useTasksStore((s) => s.deleteTask);

  const pets = usePetsStore(useShallow((s) => s.pets));

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [petFilter, setPetFilter] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<Set<TaskType>>(new Set());
  const [typeModalVisible, setTypeModalVisible] = React.useState(false);

  React.useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const petNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pets) map[p.id] = p.name;
    return map;
  }, [pets]);

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

  const { overdue, today, upcoming } = React.useMemo(
    () => bucketOccurrences(filtered, new Date()),
    [filtered],
  );

  const allBucketsEmpty = overdue.length === 0 && today.length === 0 && upcoming.length === 0;
  const hasFilters = petFilter !== null || typeFilter.size > 0;

  // Whole-screen genuine empty (no data at all)
  const windowIsEmpty = windowOccurrences.length === 0;

  if (windowIsEmpty) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.emptyContainer} testID="tasks-empty">
          <MaterialCommunityIcons name="leaf" size={48} color={colors.inkFaint} />
          <Text style={styles.emptyTitle}>{t('tasks.empty_title')}</Text>
          <Text style={styles.emptySubtitle}>{t('tasks.empty_subtitle')}</Text>
        </View>
        <Pressable
          testID="tasks-fab"
          onPress={() => navigation.navigate('TaskForm', {})}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    );
  }

  // Build upcoming items with inline day sub-headers
  const upcomingItems: ListItem[] = [];
  if (upcoming.length === 0) {
    upcomingItems.push({ kind: 'empty', sectionKey: 'upcoming' });
  } else {
    let lastDay = '';
    for (const occ of upcoming) {
      const day = utcIsoToTehranJalali(occ.dueAt);
      if (day !== lastDay) {
        upcomingItems.push({ kind: 'day', label: day });
        lastDay = day;
      }
      upcomingItems.push({ kind: 'occ', occ });
    }
  }

  const sections: Section[] = [
    {
      sectionKey: 'overdue',
      data:
        overdue.length === 0
          ? [{ kind: 'empty', sectionKey: 'overdue' }]
          : overdue.map((occ) => ({ kind: 'occ', occ })),
    },
    {
      sectionKey: 'today',
      data:
        today.length === 0
          ? [{ kind: 'empty', sectionKey: 'today' }]
          : today.map((occ) => ({ kind: 'occ', occ })),
    },
    {
      sectionKey: 'upcoming',
      data: upcomingItems,
    },
  ];

  // Count of real occurrences per section
  const counts: Record<SectionKind, number> = {
    overdue: overdue.length,
    today: today.length,
    upcoming: upcoming.length,
  };

  // Progress: tasks-bucket items excluding skipped
  const todayForProgress = today.filter((o) => o.status !== 'skipped');
  const todayDone = todayForProgress.filter((o) => o.status === 'done').length;
  const todayTotal = todayForProgress.length;

  function handleCheck(occ: Occurrence) {
    const { task, dueAt, status } = occ;
    if (status === 'done' || status === 'skipped') return;
    markOccurrence(task.id, dueAt, 'done');
    Toast.show({
      type: 'success',
      text1: t('tasks.undo.done'),
      text2: t('tasks.undo.action'),
      visibilityTime: 4000,
      onPress: () => {
        unmarkOccurrence(task.id, dueAt);
        Toast.hide();
      },
    });
  }

  function handleMore(occ: Occurrence) {
    const { task, dueAt } = occ;
    const deleteLabel =
      task.schedule.kind === 'one_off'
        ? t('tasks.action.delete_one_off')
        : t('tasks.action.delete_recurring');

    const options = [
      t('tasks.action.skip'),
      t('tasks.action.edit'),
      deleteLabel,
      t('tasks.action.cancel'),
    ];

    showActionSheetWithOptions(
      { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
      (index?: number) => {
        if (index === 0) {
          markOccurrence(task.id, dueAt, 'skipped');
        } else if (index === 1) {
          navigation.navigate('TaskForm', { petId: task.petId, taskId: task.id });
        } else if (index === 2) {
          deleteTask(task.id);
        }
      },
    );
  }

  // ── List header: progress + filter bar ───────────────────────────────────────
  const ListHeader = (
    <View>
      {/* Progress indicator (today only, hidden when denominator is 0) */}
      {todayTotal > 0 && (
        <View style={styles.progressContainer} testID="tasks-progress">
          <View style={styles.progressDotsRow}>
            {todayForProgress.map((o, i) => (
              <View
                key={`${o.task.id}-${i}`}
                testID="progress-dot"
                style={[
                  styles.progressDot,
                  o.status === 'done' && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>
            {t('tasks.progress', { done: todayDone, total: todayTotal })}
          </Text>
        </View>
      )}

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {/* Pet chips: All + one per pet */}
        <Pressable
          testID="tasks-filter-pet-all"
          style={[styles.filterChip, petFilter === null && styles.filterChipSelected]}
          onPress={() => setPetFilter(null)}
        >
          <Text style={[styles.filterChipText, petFilter === null && styles.filterChipTextSelected]}>
            {t('tasks.filter.all')}
          </Text>
        </Pressable>
        {pets.map((p) => (
          <Pressable
            key={p.id}
            testID={`tasks-filter-pet-${p.id}`}
            style={[styles.filterChip, petFilter === p.id && styles.filterChipSelected]}
            onPress={() => setPetFilter(petFilter === p.id ? null : p.id)}
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
          style={[styles.filterChip, typeFilter.size > 0 && styles.filterChipSelected]}
          onPress={() => setTypeModalVisible(true)}
        >
          <Text
            style={[
              styles.filterChipText,
              typeFilter.size > 0 && styles.filterChipTextSelected,
            ]}
          >
            {t('tasks.filter.type')}
            {typeFilter.size > 0 ? ` (${typeFilter.size})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* No-match state when filters empty everything but window has data */}
      {allBucketsEmpty && hasFilters && (
        <View style={styles.noMatchContainer} testID="tasks-no-match">
          <Text style={styles.noMatchText}>{t('tasks.no_match')}</Text>
          <Pressable
            onPress={() => {
              setPetFilter(null);
              setTypeFilter(new Set());
            }}
          >
            <Text style={styles.clearFiltersText}>{t('tasks.filter.clear')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <TypeFilterModal
        visible={typeModalVisible}
        selected={typeFilter}
        onApply={(next) => {
          setTypeFilter(next);
          setTypeModalVisible(false);
        }}
        onClose={() => setTypeModalVisible(false)}
      />
      <Pressable
        testID="tasks-fab"
        onPress={() => navigation.navigate('TaskForm', {})}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => {
          if (item.kind === 'occ') return `${item.occ.task.id}-${item.occ.dueAt}`;
          if (item.kind === 'day') return `day-${item.label}-${index}`;
          return `empty-${item.sectionKey}`;
        }}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={ListHeader}
        renderSectionHeader={({ section }) => {
          const sec = section as Section;
          const count = counts[sec.sectionKey];
          return (
            <View style={styles.sectionHeader} testID={`tasks-section-${sec.sectionKey}`}>
              <Text style={styles.sectionTitle}>
                {`${t(`tasks.section.${sec.sectionKey}`)} · ${toPersianDigits(count)}`}
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (item.kind === 'empty') {
            return (
              <View style={styles.sectionEmptyRow} testID={`tasks-empty-${item.sectionKey}`}>
                <Text style={styles.sectionEmptyText}>{t(`tasks.empty.${item.sectionKey}`)}</Text>
              </View>
            );
          }
          if (item.kind === 'day') {
            return (
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{toPersianDigits(item.label)}</Text>
              </View>
            );
          }
          // kind === 'occ'
          const { occ } = item;
          return (
            <OccurrenceRow
              occ={occ}
              petName={petNameById[occ.task.petId] ?? ''}
              onCheck={() => handleCheck(occ)}
              onMore={() => handleMore(occ)}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  // Per-section empty row
  sectionEmptyRow: {
    paddingVertical: spacing.md,
  },
  sectionEmptyText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkFaint,
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
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowDimmed: {
    opacity: 0.5,
  },
  checkbox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIcon: {
    width: 28,
    textAlign: 'center',
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
    color: colors.inkFaint,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    lineHeight: 16,
  },
  moreBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty state (whole screen)
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  // Progress indicator
  progressContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  progressDotsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    paddingVertical: spacing.xs,
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
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noMatchText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  clearFiltersText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    end: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...shadow.card,
  },
  fabPressed: {
    opacity: 0.85,
  },
  // Type filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
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
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
