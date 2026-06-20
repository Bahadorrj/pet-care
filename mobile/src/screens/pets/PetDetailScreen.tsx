import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns-jalali';
import { useShallow } from 'zustand/react/shallow';

import Button from '../../components/ui/Button';
import { usePetsStore } from '../../store/petsStore';
import { useChoresStore } from '../../store/choresStore';
import { getPet } from '../../db/pets';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { PetsStackParamList, PetsNavigationProp } from '../../navigation/PetsStack';
import type { ChoreType } from '../../db/types';

type PetDetailRouteProp = RouteProp<PetsStackParamList, 'PetDetail'>;

// All dates render in the Jalali (Persian) calendar — never Gregorian.
const formatJalali = (iso: string) => format(new Date(iso), 'yyyy/MM/dd');

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

  if (!pet) return null;

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
        {pet.photoUri != null && (
          <Image
            testID="petdetail-photo"
            source={{ uri: pet.photoUri }}
            style={styles.photo}
            accessibilityLabel={pet.name}
          />
        )}

        <Text style={styles.name}>{pet.name}</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('pets.field.species')}</Text>
          <Text style={styles.value}>{t(`pets.species.${pet.species}`)}</Text>
        </View>

        {pet.gender != null && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('pets.field.gender')}</Text>
            <Text style={styles.value}>{t(`pets.gender.${pet.gender}`)}</Text>
          </View>
        )}

        {pet.notes != null && pet.notes !== '' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('pets.field.notes')}</Text>
            <Text style={styles.value}>{pet.notes}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('pets.field.created_at')}</Text>
          <Text style={styles.value}>{formatJalali(pet.createdAt)}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('pets.field.updated_at')}</Text>
          <Text style={styles.value}>{formatJalali(pet.updatedAt)}</Text>
        </View>

        {/* ── Chores section ──────────────────────────────────────────────── */}
        <View style={styles.choresSection}>
          <View style={styles.choresSectionHeader}>
            <Text style={styles.choresSectionTitle}>{t('chores.section_title')}</Text>
            <Pressable
              testID="petdetail-add-chore"
              onPress={() => navigation.navigate('ChoreForm', { petId })}
              style={({ pressed }) => [
                styles.addChoreButton,
                pressed && styles.addChoreButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('chores.add')}
            >
              <Text style={styles.addChoreText}>{t('chores.add')}</Text>
            </Pressable>
          </View>

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
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <Button
            testID="petdetail-edit"
            variant="secondary"
            label={t('pets.edit')}
            onPress={() => navigation.navigate('PetForm', { petId })}
          />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  name: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  value: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  // ── Chores section ──────────────────────────────────────────────────────────
  choresSection: {
    gap: 0,
    marginTop: spacing.xs,
  },
  choresSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  choresSectionTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  addChoreButton: {
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
  choresEmpty: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkFaint,
    paddingVertical: spacing.sm,
  },
  // ────────────────────────────────────────────────────────────────────────────
  actions: {
    gap: spacing.md,
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
