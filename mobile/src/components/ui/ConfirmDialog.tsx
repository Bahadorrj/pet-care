import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  colors,
  fonts,
  radius,
  shadow,
  spacing,
  typography,
} from "../../theme/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

/**
 * Themed stand-in for `Alert.alert` confirmations. Native `Alert.alert` mirrors
 * its layout to the device's system locale, not `I18nManager.forceRTL()`, so it
 * renders LTR on a Persian-forced app running on a non-RTL-locale device. This
 * is plain RN layout, so it follows the app's own RTL state like everything else.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  testID,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View testID={testID} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              testID={testID ? `${testID}-cancel` : undefined}
              onPress={onCancel}
              style={styles.actionBtn}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID={testID ? `${testID}-confirm` : undefined}
              onPress={onConfirm}
              style={[
                styles.actionBtn,
                styles.confirmBtn,
                destructive && styles.confirmBtnDestructive,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive && styles.confirmTextDestructive,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  title: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: "center",
  },
  message: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSunken,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnDestructive: {
    backgroundColor: colors.dangerSoft,
  },
  cancelText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
  confirmText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semibold,
    color: colors.onPrimary,
  },
  confirmTextDestructive: {
    color: colors.danger,
  },
});
