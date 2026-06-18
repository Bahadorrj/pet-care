import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns-jalali';

import Button from '../../components/ui/Button';
import { usePetsStore } from '../../store/petsStore';
import { getPet } from '../../db/pets';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { PetsStackParamList, PetsNavigationProp } from '../../navigation/PetsStack';

type PetDetailRouteProp = RouteProp<PetsStackParamList, 'PetDetail'>;

// All dates render in the Jalali (Persian) calendar — never Gregorian.
const formatJalali = (iso: string) => format(new Date(iso), 'yyyy/MM/dd');

export default function PetDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const route = useRoute<PetDetailRouteProp>();
  const { petId } = route.params;

  const remove = usePetsStore((s) => s.remove);
  // Prefer the in-memory store list; fall back to a direct read.
  const pet = usePetsStore((s) => s.pets.find((p) => p.id === petId)) ?? getPet(petId);

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
            style={styles.deleteButton}
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
    borderRadius: radius.lg,
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
  deleteText: {
    fontSize: typography.bodyLg.fontSize,
    fontFamily: fonts.semibold,
    color: colors.danger,
  },
});
