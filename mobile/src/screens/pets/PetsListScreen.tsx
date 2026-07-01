import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { usePetsStore } from "../../store/petsStore";
import { useTasksStore } from "../../store/tasksStore";
import { nextOccurrence, toTehranTime } from "../../lib/taskSchedule";
import { toPersianDigits } from "../../lib/jalali";
import {
  colors,
  fonts,
  radius,
  shadow,
  spacing,
  typography,
} from "../../theme/theme";
import { SPECIES_ICON } from "../../theme/icons";
import type { PetsNavigationProp } from "../../navigation/PetsStack";
import type { Task, Pet } from "../../db/types";

const NEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function speciesLabel(pet: Pet, t: (key: string) => string): string {
  return pet.species === "other" && pet.speciesOther
    ? pet.speciesOther
    : t(`pets.species.${pet.species}`);
}

export default function PetsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const pets = usePetsStore((s) => s.pets);
  const removeMany = usePetsStore((s) => s.removeMany);
  const tasks = useTasksStore((s) => s.tasks);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionActive, setSelectionActive] = useState(false);
  const selectionMode = selectionActive;

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionActive(false);
    setSelectedIds(new Set());
  }, []);

  const allSelected = pets.length > 0 && selectedIds.size === pets.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === pets.length ? new Set() : new Set(pets.map((p) => p.id)),
    );
  }, [pets]);

  const confirmDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Alert.alert(
      t("pets.delete"),
      t("pets.delete_confirm_many", { count: ids.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("pets.delete"),
          style: "destructive",
          onPress: async () => {
            await removeMany(ids);
            exitSelection();
          },
        },
      ],
    );
  }, [selectedIds, t, removeMany, exitSelection]);

  // Group active tasks by pet once per render rather than filtering per card.
  const tasksByPet = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of tasks) {
      if (!c.active) continue;
      const list = map.get(c.petId);
      if (list) list.push(c);
      else map.set(c.petId, [c]);
    }
    return map;
  }, [tasks]);

  const renderItem = useCallback(
    ({ item }: { item: Pet }) => {
      const petTasks = tasksByPet.get(item.id) ?? [];
      let hint: string | null = null;
      if (petTasks.length > 0) {
        const now = new Date();
        const next = nextOccurrence(
          petTasks,
          now,
          new Date(now.getTime() + NEXT_WINDOW_MS),
        );
        hint = t("pets.list.tasks", { count: petTasks.length });
        if (next)
          hint += ` · ${t("pets.next_task", { time: toPersianDigits(toTehranTime(next)) })}`;
      }

      const selected = selectedIds.has(item.id);

      return (
        <Pressable
          testID={`pet-card-${item.id}`}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => {
            if (selectionMode) toggleSelected(item.id);
            else navigation.navigate("PetDetail", { petId: item.id });
          }}
          onLongPress={() => {
            if (selectionMode) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            setSelectionActive(true);
            toggleSelected(item.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          accessibilityState={{ selected }}
        >
          <View style={styles.photoZone}>
            {item.photoUri ? (
              <Image
                source={{ uri: item.photoUri }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <MaterialCommunityIcons
                name={SPECIES_ICON[item.species]}
                size={56}
                color={colors.inkFaint}
              />
            )}
            <View style={styles.scrim}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.speciesChip}>
                <Text style={styles.speciesChipText}>
                  {speciesLabel(item, t)}
                </Text>
              </View>
            </View>
            {selectionMode && (
              <View style={styles.checkOverlay}>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? colors.primary : "#FFFFFF"}
                />
              </View>
            )}
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
    [navigation, t, tasksByPet, selectionMode, selectedIds, toggleSelected],
  );

  const isEmpty = pets.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={selectedIds}
        numColumns={2}
        columnWrapperStyle={isEmpty ? undefined : styles.column}
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="paw" size={48} color={colors.inkMuted} />
            <Text style={styles.emptyTitle}>{t("pets.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>{t("pets.empty_subtitle")}</Text>
          </View>
        }
      />
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable
            testID="selection-cancel"
            onPress={exitSelection}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.selectionCount}>
            {t("pets.select_mode.selected_count", { count: selectedIds.size })}
          </Text>
          <Pressable
            testID="selection-select-all"
            onPress={toggleSelectAll}
            accessibilityRole="button"
            accessibilityLabel={t("pets.select_mode.select_all")}
            hitSlop={8}
          >
            <Ionicons
              name={allSelected ? "checkbox" : "checkbox-outline"}
              size={22}
              color={colors.ink}
            />
          </Pressable>
          <Pressable
            testID="selection-delete"
            onPress={confirmDelete}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel={t("pets.delete")}
            hitSlop={8}
          >
            <Ionicons
              name="trash"
              size={22}
              color={selectedIds.size === 0 ? colors.inkFaint : colors.danger}
            />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => navigation.navigate("PetForm", {})}
          accessibilityRole="button"
          accessibilityLabel={t("pets.add")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
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
    paddingBottom: 96, // clear the FAB so the last row isn't hidden
    gap: spacing.md,
  },
  listEmpty: {
    flexGrow: 1, // let the empty component fill the list and center
    paddingTop: 0, // drop the asymmetric list padding so the empty state centers true
    paddingBottom: 0,
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
    overflow: "hidden",
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  checkOverlay: {
    position: "absolute",
    top: spacing.sm,
    end: spacing.sm,
  },
  photoZone: {
    height: 160,
    width: "100%",
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    position: "absolute",
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
  },
  scrim: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    height: 60,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardName: {
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
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
    ...shadow.card,
  },
  fabPressed: {
    opacity: 0.85,
  },
  selectionBar: {
    position: "absolute",
    bottom: spacing.xl,
    start: spacing.xl,
    end: spacing.xl,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  selectionCount: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
});
