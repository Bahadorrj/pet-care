import React, { useCallback, useLayoutEffect } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import { usePetsStore } from '../../store/petsStore';
import { useChoresStore } from '../../store/choresStore';
import { nextOccurrence, toTehranTime } from '../../lib/choreSchedule';
import { colors, fonts, radius, shadow, spacing, typography } from '../../theme/theme';
import type { PetsNavigationProp } from '../../navigation/PetsStack';
import type { Chore, Pet, Species } from '../../db/types';

// Species emoji — the no-photo fallback. Keeps a card visually anchored without
// inventing a face for an animal we have no picture of.
const SPECIES_EMOJI: Record<Species, string> = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  other: '🐾',
};

const NEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function PetsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const pets = usePetsStore((s) => s.pets);
  const chores = useChoresStore((s) => s.chores);

  // Group active chores by pet once per render rather than filtering per card.
  const choresByPet = React.useMemo(() => {
    const map = new Map<string, Chore[]>();
    for (const c of chores) {
      if (!c.active) continue;
      const list = map.get(c.petId);
      if (list) list.push(c);
      else map.set(c.petId, [c]);
    }
    return map;
  }, [chores]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      // RTL: the header row is flipped, so headerLeft renders on the visual right.
      // Clear headerRight too — setOptions merges, so a stale headerRight would
      // otherwise linger across Fast Refresh and show a second button.
      headerRight: () => null,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.navigate('PetForm', {})}
          accessibilityLabel={t('pets.add')}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>{t('pets.add')}</Text>
        </Pressable>
      ),
    });
  }, [navigation, t]);

  const renderItem = useCallback(
    ({ item }: { item: Pet }) => {
      const petChores = choresByPet.get(item.id) ?? [];
      let hint: string | null = null;
      if (petChores.length > 0) {
        const now = new Date();
        const next = nextOccurrence(petChores, now, new Date(now.getTime() + NEXT_WINDOW_MS));
        hint = t('pets.list.chores', { count: petChores.length });
        if (next) hint += ` · ${t('pets.next_chore', { time: toTehranTime(next) })}`;
      }

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('PetDetail', { petId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <View style={styles.photoZone}>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Text style={styles.photoEmoji}>{SPECIES_EMOJI[item.species]}</Text>
            )}
            <View style={styles.scrim}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.speciesChip}>
                <Text style={styles.speciesChipText}>{t(`pets.species.${item.species}`)}</Text>
              </View>
            </View>
          </View>

          {hint && (
            <View style={styles.hintRow}>
              <Text style={styles.hintText} numberOfLines={1}>
                {hint}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [navigation, t, choresByPet],
  );

  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.empty}>
          <Ionicons name="paw-outline" size={56} color={colors.inkFaint} />
          <Text style={styles.emptyText}>{t('pets.empty')}</Text>
          <Button
            label={t('pets.add')}
            onPress={() => navigation.navigate('PetForm', {})}
            style={styles.emptyButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  column: {
    gap: spacing.md,
  },
  // ponytail: flex:1 means a lone trailing card spans full width; add an invisible
  // spacer item only if odd-count layouts start looking wrong in practice.
  card: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  photoZone: {
    height: 160,
    width: '100%',
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
  },
  photoEmoji: {
    fontSize: 40,
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    height: 60,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.semibold,
    color: '#FFFFFF',
  },
  speciesChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  speciesChipText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  hintRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hintText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  emptyButton: {
    alignSelf: 'stretch',
  },
  addButton: {
    paddingStart: spacing.md,
  },
  addButtonText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
});
