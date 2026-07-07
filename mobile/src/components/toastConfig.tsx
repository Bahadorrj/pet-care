import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type {
  ToastConfig,
  ToastConfigParams,
} from "react-native-toast-message";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

// Neutral confirmation naming the pet; bare «انجام شد» without one.
// Deliberately not a cheer — warmth lives in calm, not praise (ADR-0020).
export function donePhrase(t: TFunction, petName?: string): string {
  if (!petName) return t("tasks.undo.done");
  return t("tasks.done.confirm", { name: petName });
}

type TaskDoneProps = { petName?: string };

function TaskDoneToast({ props }: ToastConfigParams<TaskDoneProps>) {
  const { t } = useTranslation();
  // The library reuses one mounted toast instance across shows, swapping props —
  // so key the phrase on petName, else it freezes to the first pet shown.
  const phrase = React.useMemo(
    () => donePhrase(t, props.petName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.petName],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.text} numberOfLines={2}>
        {phrase}
      </Text>
    </View>
  );
}

function HintToast({ text1 }: ToastConfigParams<unknown>) {
  return (
    <View style={hintStyles.container}>
      <Text style={hintStyles.text} numberOfLines={2}>
        {text1}
      </Text>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  taskDone: (params) => <TaskDoneToast {...params} />,
  hint: (params) => <HintToast {...params} />,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    width: "92%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    // Emerald success accent at the reading start (right in RTL).
    borderStartWidth: 4,
    borderStartColor: colors.primary,
    ...shadow.card,
  },
  text: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.ink,
  },
});

const hintStyles = StyleSheet.create({
  container: {
    width: "92%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    // Neutral, not emerald: White Surface + Border Gentle (One Voice Rule).
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  text: {
    ...typography.body,
    color: colors.ink,
  },
});
