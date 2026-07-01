import React, { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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

import Button from "../../components/ui/Button";
import TextField from "../../components/ui/TextField";
import { usePetsStore } from "../../store/petsStore";
import { getPet } from "../../db/pets";
import { pickPhoto } from "../../lib/petPhoto";
import { colors, fonts, radius, spacing, typography } from "../../theme/theme";
import type {
  PetsStackParamList,
  PetsNavigationProp,
} from "../../navigation/PetsStack";
import type { Species, Gender, WeightUnit } from "../../db/types";

type PetFormRouteProp = RouteProp<PetsStackParamList, "PetForm">;

const SPECIES: Species[] = ["dog", "cat", "bird", "rabbit", "other"];
const GENDERS: Gender[] = ["male", "female"];
const WEIGHT_UNITS: WeightUnit[] = ["kg", "g"];
const DEFAULT_WEIGHT_UNIT: Record<Species, WeightUnit> = {
  dog: "kg",
  cat: "kg",
  bird: "g",
  rabbit: "g",
  other: "kg",
};

export default function PetFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const route = useRoute<PetFormRouteProp>();
  const petId = route.params?.petId;
  const isEdit = petId != null;

  // Prefill in edit mode
  const existing = isEdit ? getPet(petId) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [species, setSpecies] = useState<Species | null>(
    existing?.species ?? null,
  );
  const [speciesOther, setSpeciesOther] = useState(
    existing?.speciesOther ?? "",
  );
  const [gender, setGender] = useState<Gender | null>(existing?.gender ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(
    existing?.photoUri ?? null,
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [breed, setBreed] = useState(existing?.breed ?? "");
  const [weightValue, setWeightValue] = useState(
    existing?.weightValue != null ? String(existing.weightValue) : "",
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit | null>(
    existing?.weightUnit ?? null,
  );
  // Once the user (or an existing pet) has an explicit unit, species changes stop overriding it.
  const [weightUnitManual, setWeightUnitManual] = useState(
    existing?.weightUnit != null,
  );

  const [nameError, setNameError] = useState("");
  const [speciesError, setSpeciesError] = useState("");
  const [speciesOtherError, setSpeciesOtherError] = useState("");
  const [weightError, setWeightError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const add = usePetsStore((s) => s.add);
  const update = usePetsStore((s) => s.update);

  const handlePickPhoto = async () => {
    const uri = await pickPhoto();
    if (uri) setPhotoUri(uri);
  };

  const handleSubmit = async () => {
    if (inFlightRef.current) return;

    // Client-side required checks
    let hasError = false;
    if (!name.trim()) {
      setNameError(t("pets.error.name_required"));
      hasError = true;
    } else {
      setNameError("");
    }
    if (!species) {
      setSpeciesError(t("pets.error.species_required"));
      hasError = true;
    } else {
      setSpeciesError("");
    }
    if (species === "other" && !speciesOther.trim()) {
      setSpeciesOtherError(t("pets.error.species_other_required"));
      hasError = true;
    } else {
      setSpeciesOtherError("");
    }
    let weightValueNum: number | null = null;
    if (weightValue.trim()) {
      const n = Number(weightValue.trim());
      if (!Number.isFinite(n) || n <= 0) {
        setWeightError(t("pets.error.weight_invalid"));
        hasError = true;
      } else {
        weightValueNum = n;
        setWeightError("");
      }
    } else {
      setWeightError("");
    }
    if (hasError) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    const input = {
      name,
      species: species!,
      speciesOther: species === "other" ? speciesOther.trim() : null,
      gender,
      photoUri,
      notes: notes.trim() || null,
      breed: breed.trim() || null,
      weightValue: weightValueNum,
      weightUnit:
        weightValueNum != null
          ? (weightUnit ?? DEFAULT_WEIGHT_UNIT[species!])
          : null,
    };

    try {
      if (isEdit) {
        await update(petId, input);
      } else {
        await add(input);
      }
      navigation.goBack();
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      if (key === "pets.error.name_required") {
        setNameError(t(key));
      } else if (key === "pets.error.species_required") {
        setSpeciesError(t(key));
      } else if (key === "pets.error.species_other_required") {
        setSpeciesOtherError(t(key));
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.name")}</Text>
            <TextField
              testID="petform-name"
              placeholder={t("pets.field.name_placeholder")}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError("");
              }}
              invalid={nameError !== ""}
              accessibilityLabel={t("pets.field.name")}
            />
            {nameError !== "" && (
              <Text style={styles.errorText}>{nameError}</Text>
            )}
          </View>

          {/* Species */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.species")}</Text>
            <View style={styles.chipRow}>
              {SPECIES.map((s) => (
                <Pressable
                  key={s}
                  testID={`petform-species-${s}`}
                  onPress={() => {
                    setSpecies(s);
                    if (speciesError) setSpeciesError("");
                    if (!weightUnitManual)
                      setWeightUnit(DEFAULT_WEIGHT_UNIT[s]);
                  }}
                  style={[styles.chip, species === s && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: species === s }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      species === s && styles.chipTextSelected,
                    ]}
                  >
                    {t(`pets.species.${s}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {speciesError !== "" && (
              <Text style={styles.errorText}>{speciesError}</Text>
            )}
            {species === "other" && (
              <TextField
                testID="petform-species-other-input"
                placeholder={t("pets.field.species_other_placeholder")}
                value={speciesOther}
                onChangeText={(v) => {
                  setSpeciesOther(v);
                  if (speciesOtherError) setSpeciesOtherError("");
                }}
                invalid={speciesOtherError !== ""}
                accessibilityLabel={t("pets.field.species_other")}
              />
            )}
            {speciesOtherError !== "" && (
              <Text style={styles.errorText}>{speciesOtherError}</Text>
            )}
          </View>

          {/* Breed */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.breed")}</Text>
            <TextField
              testID="petform-breed"
              placeholder={t("pets.field.breed_placeholder")}
              value={breed}
              onChangeText={setBreed}
              accessibilityLabel={t("pets.field.breed")}
            />
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.gender")}</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  testID={`petform-gender-${g}`}
                  onPress={() => setGender(gender === g ? null : g)}
                  style={[styles.chip, gender === g && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: gender === g }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      gender === g && styles.chipTextSelected,
                    ]}
                  >
                    {t(`pets.gender.${g}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Weight */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.weight")}</Text>
            <View style={styles.weightRow}>
              <View style={styles.weightInput}>
                <TextField
                  testID="petform-weight"
                  placeholder={t("pets.field.weight_placeholder")}
                  value={weightValue}
                  onChangeText={(v) => {
                    setWeightValue(v);
                    if (weightError) setWeightError("");
                  }}
                  keyboardType="decimal-pad"
                  invalid={weightError !== ""}
                  accessibilityLabel={t("pets.field.weight")}
                />
              </View>
              <View style={styles.chipRow}>
                {WEIGHT_UNITS.map((u) => (
                  <Pressable
                    key={u}
                    testID={`petform-weight-unit-${u}`}
                    onPress={() => {
                      setWeightUnit(u);
                      setWeightUnitManual(true);
                    }}
                    style={[
                      styles.chip,
                      weightUnit === u && styles.chipSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: weightUnit === u }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        weightUnit === u && styles.chipTextSelected,
                      ]}
                    >
                      {t(`pets.unit.${u}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {weightError !== "" && (
              <Text style={styles.errorText}>{weightError}</Text>
            )}
          </View>

          {/* Photo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.photo")}</Text>
            <Button
              testID="petform-photo"
              variant="secondary"
              label={t("pets.field.photo")}
              onPress={handlePickPhoto}
            />
            {photoUri != null && (
              <Image
                testID="petform-photo-preview"
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                accessibilityLabel={t("pets.field.photo")}
              />
            )}
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("pets.field.notes")}</Text>
            <TextField
              testID="petform-notes"
              placeholder={t("pets.field.notes_placeholder")}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              accessibilityLabel={t("pets.field.notes")}
              style={styles.notesInput}
            />
          </View>

          <Button
            testID="petform-submit"
            label={isEdit ? t("pets.edit") : t("pets.add")}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  weightInput: {
    flex: 1,
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
  errorText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.danger,
    marginStart: spacing.xs,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  notesInput: {
    height: 96,
    textAlignVertical: "top",
  },
});
