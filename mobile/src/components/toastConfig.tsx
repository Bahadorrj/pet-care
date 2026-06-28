import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type {
  ToastConfig,
  ToastConfigParams,
} from "react-native-toast-message";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

const CHEER_COUNT = 3;

// Pick a random cheer phrase naming the pet; fall back to the bare «انجام شد»
// when no pet name is available. Pure (t injected) so it's unit-testable.
export function cheerPhrase(t: TFunction, petName?: string): string {
  if (!petName) return t("tasks.undo.done");
  const i = Math.floor(Math.random() * CHEER_COUNT);
  return t(`tasks.done.cheer.${i}`, { name: petName });
}

type TaskDoneProps = { petName?: string };

function TaskDoneToast({ props }: ToastConfigParams<TaskDoneProps>) {
  const { t } = useTranslation();
  // The library reuses one mounted toast instance across shows, swapping props —
  // so key the phrase on petName, else it freezes to the first pet shown.
  const phrase = React.useMemo(
    () => cheerPhrase(t, props.petName),
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

export const toastConfig: ToastConfig = {
  taskDone: (params) => <TaskDoneToast {...params} />,
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
