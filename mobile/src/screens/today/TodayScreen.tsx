import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useChoresStore } from '../../store/choresStore';
import { usePetsStore } from '../../store/petsStore';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import { CHORE_TYPE_ICON } from '../../theme/icons';
import type { Occurrence } from '../../db/types';

// ── Tehran time helper ────────────────────────────────────────────────────────
// ponytail: mirrors utcIsoToTehranTime in ChoreFormScreen — shift +210 min, read UTC fields
function toTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ── Ordering ──────────────────────────────────────────────────────────────────
// Overdue-today (missed + past-time pending) first, then chronological.
function isOverdue(occ: Occurrence): boolean {
  // Engine marks past-no-log as missed at compute time, but the stored snapshot
  // goes stale as the clock passes a still-pending dueAt — treat that as overdue too.
  return (
    occ.status === 'missed' ||
    (occ.status === 'pending' && occ.dueAt < new Date().toISOString())
  );
}

function sortOccurrences(occs: Occurrence[]): Occurrence[] {
  return [...occs].sort((a, b) => {
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });
}

// Status badge colors
const STATUS_COLOR: Record<Occurrence['status'], string> = {
  pending: colors.inkMuted, // inkFaint ~2.2:1 fails WCAG AA for the badge text
  missed: colors.danger,
  done: colors.primary,
  skipped: colors.inkMuted,
};

// ── Row ───────────────────────────────────────────────────────────────────────
type RowProps = {
  occ: Occurrence;
  petName: string;
  onDone: () => void;
  onSkip: () => void;
};

function OccurrenceRow({ occ, petName, onDone, onSkip }: RowProps) {
  const { t } = useTranslation();
  const { chore, dueAt, status } = occ;
  const isFinal = status === 'done' || status === 'skipped';
  const isOverdueRow = isOverdue(occ);

  return (
    <View
      testID={`today-row-${chore.id}`}
      style={[styles.row, isOverdueRow && styles.rowOverdue]}
      accessibilityRole="none"
    >
      {/* Left: type icon */}
      <MaterialCommunityIcons
        name={CHORE_TYPE_ICON[chore.type]}
        size={24}
        color={colors.primary}
        style={styles.typeIcon}
        accessibilityLabel={t(`chores.type.${chore.type}`)}
      />

      {/* Middle: info */}
      <View style={styles.rowInfo}>
        <Text style={styles.petName} numberOfLines={1}>
          {petName}
        </Text>
        <Text style={styles.choreTitle} numberOfLines={1}>
          {chore.title ?? t(`chores.type.${chore.type}`)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{toTehranTime(dueAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
              {t(`chores.status.${status}`)}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: actions (hidden when already done/skipped) */}
      {!isFinal && (
        <View style={styles.actions}>
          <Pressable
            testID={`today-done-${chore.id}`}
            onPress={onDone}
            style={({ pressed }) => [styles.actionBtn, styles.actionDone, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chores.action.done')}
          >
            <Text style={styles.actionDoneText}>{t('chores.action.done')}</Text>
          </Pressable>
          <Pressable
            testID={`today-skip-${chore.id}`}
            onPress={onSkip}
            style={({ pressed }) => [styles.actionBtn, styles.actionSkip, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chores.action.skip')}
          >
            <Text style={styles.actionSkipText}>{t('chores.action.skip')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  // ponytail: three separate selectors — avoids useShallow object form which breaks simple mocks
  const occurrences = useChoresStore((s) => s.occurrences);
  const load = useChoresStore((s) => s.load);
  const markOccurrence = useChoresStore((s) => s.markOccurrence);

  const pets = usePetsStore(useShallow((s) => s.pets));

  // Reload on every focus (picks up changes made in other tabs)
  React.useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const sorted = sortOccurrences(occurrences);

  const petNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pets) map[p.id] = p.name;
    return map;
  }, [pets]);

  if (sorted.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.emptyContainer} testID="today-empty">
          <MaterialCommunityIcons name="leaf" size={48} color={colors.inkFaint} />
          <Text style={styles.emptyTitle}>{t('today.empty_title')}</Text>
          <Text style={styles.emptySubtitle}>{t('today.empty_subtitle')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FlatList
        data={sorted}
        keyExtractor={(occ) => `${occ.chore.id}-${occ.dueAt}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <OccurrenceRow
            occ={item}
            petName={petNameById[item.chore.petId] ?? ''}
            onDone={() => markOccurrence(item.chore.id, item.dueAt, 'done')}
            onSkip={() => markOccurrence(item.chore.id, item.dueAt, 'skipped')}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  rowOverdue: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  typeIcon: {
    width: 36,
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
  choreTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
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
    // ponytail: letter-spacing not needed; HH:MM is compact
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
  // Actions
  actions: {
    gap: spacing.xs,
    // Fixed column width → Done/Skip stretch to match (labels differ in length).
    width: 92,
  },
  actionBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 44, // WCAG touch target — these are the primary daily action
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDone: {
    backgroundColor: colors.primarySoft,
  },
  actionSkip: {
    backgroundColor: colors.surfaceSunken,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDoneText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  actionSkipText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  // Empty state
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
});
