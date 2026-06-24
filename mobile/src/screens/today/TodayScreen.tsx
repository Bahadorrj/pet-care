import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';

import { useChoresStore } from '../../store/choresStore';
import { usePetsStore } from '../../store/petsStore';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import { CHORE_TYPE_ICON } from '../../theme/icons';
import { bucketOccurrences } from './todayBuckets';
import type { Occurrence } from '../../db/types';
import type { TodayNavigationProp } from '../../navigation/TodayStack';

// ── Tehran time helper ─────────────────────────────────────────────────────────
// ponytail: mirrors utcIsoToTehranTime in ChoreFormScreen — shift +210 min, read UTC fields
function toTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Tehran calendar-day label (YYYY-MM-DD) from a UTC ISO string
function toTehranDateLabel(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

// Status badge colors
const STATUS_COLOR: Record<Occurrence['status'], string> = {
  pending: colors.inkMuted,
  missed: colors.danger,
  done: colors.primary,
  skipped: colors.inkMuted,
};

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
  const { chore, dueAt, status } = occ;
  const isFinal = status === 'done' || status === 'skipped';

  return (
    <Pressable
      testID={`today-row-${chore.id}`}
      style={[styles.row, isFinal && styles.rowDimmed]}
      onPress={onMore}
      accessibilityRole="none"
    >
      {/* Leading checkbox */}
      <Pressable
        testID={`today-check-${chore.id}`}
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
        name={CHORE_TYPE_ICON[chore.type]}
        size={22}
        color={isFinal ? colors.inkFaint : colors.primary}
        style={styles.typeIcon}
        accessibilityLabel={t(`chores.type.${chore.type}`)}
      />

      {/* Middle: info */}
      <View style={styles.rowInfo}>
        <Text style={[styles.petName, isFinal && styles.dimmedText]} numberOfLines={1}>
          {petName}
        </Text>
        <Text style={[styles.choreTitle, isFinal && styles.dimmedText]} numberOfLines={1}>
          {chore.title ?? t(`chores.type.${chore.type}`)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, isFinal && styles.dimmedText]}>{toTehranTime(dueAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
              {t(`chores.status.${status}`)}
            </Text>
          </View>
        </View>
      </View>

      {/* Trailing ⋯ button */}
      <Pressable
        testID={`today-more-${chore.id}`}
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

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const navigation = useNavigation<TodayNavigationProp>();
  const { showActionSheetWithOptions } = useActionSheet();

  const windowOccurrences = useChoresStore((s) => s.windowOccurrences);
  const load = useChoresStore((s) => s.load);
  const markOccurrence = useChoresStore((s) => s.markOccurrence);
  const unmarkOccurrence = useChoresStore((s) => s.unmarkOccurrence);
  const deleteChore = useChoresStore((s) => s.deleteChore);

  const pets = usePetsStore(useShallow((s) => s.pets));

  React.useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const petNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pets) map[p.id] = p.name;
    return map;
  }, [pets]);

  const { overdue, today, upcoming } = React.useMemo(
    () => bucketOccurrences(windowOccurrences, new Date()),
    [windowOccurrences],
  );

  const allEmpty = overdue.length === 0 && today.length === 0 && upcoming.length === 0;

  if (allEmpty) {
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

  // Build upcoming items with inline day sub-headers
  const upcomingItems: ListItem[] = [];
  if (upcoming.length === 0) {
    upcomingItems.push({ kind: 'empty', sectionKey: 'upcoming' });
  } else {
    let lastDay = '';
    for (const occ of upcoming) {
      const day = toTehranDateLabel(occ.dueAt);
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

  function handleCheck(occ: Occurrence) {
    const { chore, dueAt, status } = occ;
    if (status === 'done' || status === 'skipped') return;
    markOccurrence(chore.id, dueAt, 'done');
    Toast.show({
      type: 'success',
      text1: t('today.undo.done'),
      text2: t('today.undo.action'),
      visibilityTime: 4000,
      onPress: () => {
        unmarkOccurrence(chore.id, dueAt);
        Toast.hide();
      },
    });
  }

  function handleMore(occ: Occurrence) {
    const { chore, dueAt } = occ;
    const deleteLabel =
      chore.schedule.kind === 'one_off'
        ? t('today.action.delete_one_off')
        : t('today.action.delete_recurring');

    const options = [
      t('today.action.skip'),
      t('today.action.edit'),
      deleteLabel,
      t('today.action.cancel'),
    ];

    showActionSheetWithOptions(
      { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
      (index?: number) => {
        if (index === 0) {
          markOccurrence(chore.id, dueAt, 'skipped');
        } else if (index === 1) {
          navigation.navigate('ChoreForm', { petId: chore.petId, choreId: chore.id });
        } else if (index === 2) {
          deleteChore(chore.id);
        }
      },
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => {
          if (item.kind === 'occ') return `${item.occ.chore.id}-${item.occ.dueAt}`;
          if (item.kind === 'day') return `day-${item.label}-${index}`;
          return `empty-${item.sectionKey}`;
        }}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          const sec = section as Section;
          const count = counts[sec.sectionKey];
          return (
            <View style={styles.sectionHeader} testID={`today-section-${sec.sectionKey}`}>
              <Text style={styles.sectionTitle}>
                {`${t(`today.section.${sec.sectionKey}`)} · ${count}`}
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (item.kind === 'empty') {
            return (
              <View style={styles.sectionEmptyRow} testID={`today-empty-${item.sectionKey}`}>
                <Text style={styles.sectionEmptyText}>{t(`today.empty.${item.sectionKey}`)}</Text>
              </View>
            );
          }
          if (item.kind === 'day') {
            return (
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{item.label}</Text>
              </View>
            );
          }
          // kind === 'occ'
          const { occ } = item;
          return (
            <OccurrenceRow
              occ={occ}
              petName={petNameById[occ.chore.petId] ?? ''}
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
  choreTitle: {
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
});
