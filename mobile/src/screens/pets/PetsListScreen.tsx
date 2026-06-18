import React, { useCallback, useLayoutEffect } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { usePetsStore } from '../../store/petsStore';
import { colors, fonts, spacing, typography } from '../../theme/theme';
import type { PetsNavigationProp } from '../../navigation/PetsStack';
import type { Pet } from '../../db/types';

export default function PetsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const pets = usePetsStore((s) => s.pets);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerRight: () => (
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
    ({ item }: { item: Pet }) => (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('PetDetail', { petId: item.id })}
        accessibilityRole="button"
      >
        {item.photoUri ? (
          <Image
            source={{ uri: item.photoUri }}
            style={styles.thumbnail}
            accessibilityLabel={item.name}
          />
        ) : null}
        <View style={styles.rowText}>
          <Text style={styles.petName}>{item.name}</Text>
          <Text style={styles.petSpecies}>{t(`pets.species.${item.species}`)}</Text>
        </View>
      </Pressable>
    ),
    [navigation, t],
  );

  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.emptyText}>{t('pets.empty')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginEnd: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  petName: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  petSpecies: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  emptyText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: spacing.xl,
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
