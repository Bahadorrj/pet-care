import React from 'react';
import { Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';

import { usePetsStore } from '../../store/petsStore';
import { useChoresStore } from '../../store/choresStore';
import { getPet } from '../../db/pets';
import { streak, adherence, nextOccurrence, toTehranTime } from '../../lib/choreSchedule';
import { colors, fonts, radius, shadow, spacing, typography } from '../../theme/theme';
import type { PetsStackParamList, PetsNavigationProp } from '../../navigation/PetsStack';
import type { Chore, ChoreLog, ChoreType, Species } from '../../db/types';

type PetDetailRouteProp = RouteProp<PetsStackParamList, 'PetDetail'>;

const HERO_HEIGHT = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;
const NEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Species emoji — the no-photo hero fallback.
const SPECIES_EMOJI: Record<Species, string> = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  other: '🐾',
};

/** Short schedule summary for the chores list row */
function scheduleLabel(t: (key: string) => string, chore: { schedule: { kind: string } }): string {
  const kind = chore.schedule.kind;
  return t(`chores.schedule.${kind}`);
}

/** Chore type icon as emoji — a lightweight visual cue without introducing a new icon lib */
const CHORE_TYPE_ICON: Record<ChoreType, string> = {
  feeding: '🍖',
  meds: '💊',
  play: '🎾',
  grooming: '✂️',
  vet: '🏥',
  other: '📋',
};

// 30-day adherence window
const ADHERENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Secondary stats per chore row: streak chip + adherence bar (hidden if no history). */
function ChoreStats({
  chore,
  getLogsForChore,
  t,
}: {
  chore: Chore;
  getLogsForChore: (id: string) => ChoreLog[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const now = new Date();
  const since = new Date(now.getTime() - ADHERENCE_WINDOW_MS);
  const logs = getLogsForChore(chore.id);

  const streakCount = streak(chore, logs, now);
  const adh = adherence(chore, logs, since, now);

  // Render if either stat has a value; skips the new-chore case (0 streak / null
  // adherence). Partial states (streak-only or adherence-only) are intentional.
  if (adh === null && streakCount === 0) return null;

  const percent = adh !== null ? Math.round(adh * 100) : null;

  return (
    <View style={styles.statsRow}>
      {streakCount > 0 && (
        <Text
          style={styles.streakChip}
          accessibilityLabel={t('chores.stat.streak', { count: streakCount })}
        >
          🔥 {streakCount}
        </Text>
      )}
      {percent !== null && (
        <View
          style={styles.adhWrap}
          accessibilityLabel={t('chores.stat.adherence', { percent })}
        >
          <View style={styles.adhTrack}>
            <View style={[styles.adhFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.adhPercent}>{percent}٪</Text>
        </View>
      )}
    </View>
  );
}

export default function PetDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const route = useRoute<PetDetailRouteProp>();
  const { petId } = route.params;

  const remove = usePetsStore((s) => s.remove);
  // Prefer the in-memory store list; fall back to a direct read.
  const pet = usePetsStore((s) => s.pets.find((p) => p.id === petId)) ?? getPet(petId);

  // Chores for this pet — useShallow prevents infinite re-render from new array ref each call (zustand v5)
  const petChores = useChoresStore(useShallow((s) => s.chores.filter((c) => c.petId === petId)));
  const getLogsForChore = useChoresStore((s) => s.getLogsForChore);

  if (!pet) return null;

  const activeChores = petChores.filter((c) => c.active);
  let choresSummary: string | null = null;
  if (activeChores.length > 0) {
    const now = new Date();
    const next = nextOccurrence(activeChores, now, new Date(now.getTime() + NEXT_WINDOW_MS));
    choresSummary = t('pets.active_chores', { count: activeChores.length });
    if (next) choresSummary += ` · ${t('pets.next_chore', { time: toTehranTime(next) })}`;
  }

  const handleDelete = () => {
    Alert.alert(t('pets.delete'), t('pets.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pets.delete'),
        style: 'destructive',
        onPress: async () => {
          await remove(petId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
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
            <Text style={styles.heroEmoji}>{SPECIES_EMOJI[pet.species]}</Text>
          )}

          <View style={styles.heroScrim}>
            <Text style={styles.heroName} numberOfLines={1}>
              {pet.name}
            </Text>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{t(`pets.species.${pet.species}`)}</Text>
            </View>
          </View>

          <Pressable
            testID="petdetail-edit"
            onPress={() => navigation.navigate('PetForm', { petId })}
            accessibilityRole="button"
            accessibilityLabel={t('pets.edit')}
            style={({ pressed }) => [styles.editFab, pressed && styles.editFabPressed]}
          >
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Info card ───────────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('pets.field.species')}</Text>
            <Text style={styles.value}>{t(`pets.species.${pet.species}`)}</Text>
          </View>

          {pet.gender != null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t('pets.field.gender')}</Text>
              <Text style={styles.value}>{t(`pets.gender.${pet.gender}`)}</Text>
            </View>
          )}

          {pet.notes != null && pet.notes !== '' && (
            <View style={styles.notesGroup}>
              <Text style={styles.label}>{t('pets.field.notes')}</Text>
              <Text style={styles.value}>{pet.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Chores section ──────────────────────────────────────────────── */}
        <View style={styles.choresSection}>
          <Text style={styles.choresSectionTitle}>{t('chores.section_title')}</Text>

          {choresSummary && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>📋 {choresSummary}</Text>
            </View>
          )}

          <Pressable
            testID="petdetail-add-chore"
            onPress={() => navigation.navigate('ChoreForm', { petId })}
            style={({ pressed }) => [styles.addChoreButton, pressed && styles.addChoreButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chores.add')}
          >
            <Text style={styles.addChoreText}>{t('chores.add')}</Text>
          </Pressable>

          {petChores.length === 0 ? (
            <Text style={styles.choresEmpty}>{t('chores.empty')}</Text>
          ) : (
            petChores.map((chore, idx) => (
              <Pressable
                key={chore.id}
                testID={`petdetail-chore-${chore.id}`}
                onPress={() => navigation.navigate('ChoreForm', { petId, choreId: chore.id })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.choreRow,
                  idx < petChores.length - 1 && styles.choreRowBorder,
                  pressed && styles.choreRowPressed,
                ]}
              >
                <Text style={styles.choreIcon}>{CHORE_TYPE_ICON[chore.type]}</Text>
                <View style={styles.choreInfo}>
                  <Text style={styles.choreTitle}>
                    {chore.title ?? t(`chores.type.${chore.type}`)}
                  </Text>
                  <Text style={styles.choreSchedule}>{scheduleLabel(t, chore)}</Text>
                  <ChoreStats chore={chore} getLogsForChore={getLogsForChore} t={t} />
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="petdetail-delete"
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={t('pets.delete')}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          >
            <Text style={styles.deleteText}>{t('pets.delete')}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroEmoji: {
    fontSize: 64,
  },
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    height: 100,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroName: {
    flexShrink: 1,
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  heroChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  heroChipText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: '#FFFFFF',
  },
  editFab: {
    position: 'absolute',
    top: spacing.md,
    end: spacing.md,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  editFabPressed: {
    opacity: 0.7,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    textAlign: 'right',
  },
  // ── Chores section ──────────────────────────────────────────────────────────
  choresSection: {
    marginHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  choresSectionTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  summaryCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  addChoreButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  addChoreButtonPressed: {
    opacity: 0.7,
  },
  addChoreText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  choreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  choreRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  choreRowPressed: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
  },
  choreIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  choreInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  choreTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  choreSchedule: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  // ── Per-chore stats ──────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  streakChip: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  adhWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adhTrack: {
    width: 80,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  adhFill: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  adhPercent: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  choresEmpty: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkFaint,
    paddingVertical: spacing.sm,
  },
  // ────────────────────────────────────────────────────────────────────────────
  actions: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  deleteButton: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
