import React, { useCallback } from "react";
import {
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

export default function PetsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PetsNavigationProp>();
  const pets = usePetsStore((s) => s.pets);
  const tasks = useTasksStore((s) => s.tasks);

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

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate("PetDetail", { petId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={item.name}
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
                  {t(`pets.species.${item.species}`)}
                </Text>
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
    [navigation, t, tasksByPet],
  );

  const isEmpty = pets.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
      <Pressable
        onPress={() => navigation.navigate("PetForm", {})}
        accessibilityRole="button"
        accessibilityLabel={t("pets.add")}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
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
});
