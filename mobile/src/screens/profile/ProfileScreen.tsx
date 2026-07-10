import React from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Button from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import { usePetsStore } from "../../store/petsStore";
import { toPersianDigits } from "../../lib/jalali";
import { colors, fonts, spacing, typography } from "../../theme/theme";
import type { ProfileNavigationProp } from "../../navigation/ProfileStack";

// Left-to-Right Mark — keeps '@handle' from bidi-reordering in forced-RTL layouts.
const LRM = "‎";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();
  const { isAuthenticated, email, username, logout } = useAuthStore();
  const petCount = usePetsStore((s) => s.pets.length);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.prompt}>{t("profile.signin_prompt")}</Text>
        <Button
          label={t("home.signin_signup")}
          onPress={() => navigation.navigate("Signin")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {petCount > 0 && (
        <Text testID="profile-pet-count" style={styles.petCount}>
          {t("profile.pet_count", { count: toPersianDigits(petCount) })}
        </Text>
      )}
      {username != null && (
        <Text testID="profile-username-handle" style={styles.username}>
          {LRM}@{username}
        </Text>
      )}
      <Text style={styles.email}>{email}</Text>
      <Button
        variant="secondary"
        label={t("profile.change_username")}
        onPress={() => navigation.navigate("ChangeUsername")}
        style={styles.changeUsernameBtn}
      />
      <Button
        variant="secondary"
        label={t("profile.logout")}
        onPress={() => logout()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  prompt: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
  petCount: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  username: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: "center",
    marginBottom: spacing.xs,
    writingDirection: "ltr",
  },
  changeUsernameBtn: {
    marginBottom: spacing.md,
  },
  email: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontFamily: fonts.medium,
    color: colors.ink,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
});
