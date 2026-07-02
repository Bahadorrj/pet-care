import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { toPersianDigits, utcIsoToTehranShortJalali } from "../../lib/jalali";
import { colors, radius, spacing, typography } from "../../theme/theme";
import type { AssistantNavigationProp } from "../../navigation/AssistantStack";
import type { RootTabNavigationProp } from "../../navigation/RootNavigator";

export default function ConversationListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<AssistantNavigationProp>();
  const token = useAuthStore((s) => s.token);
  const conversations = useChatStore((s) => s.conversations);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const openConversation = useChatStore((s) => s.openConversation);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // First statement is `await` so this never setState synchronously — safe to
    // call from the mount effect (react-hooks/set-state-in-effect).
    try {
      await loadConversations();
      setError("");
    } catch {
      setError(t("chat.error.network"));
    }
  }, [loadConversations, t]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() setState is post-await, not a synchronous cascade
    if (token) void load();
  }, [token, load]);

  const handleNew = async () => {
    try {
      const id = await startNewConversation();
      navigation.navigate("Chat", { conversationId: id });
    } catch {
      setError(t("chat.error.network"));
    }
  };

  const handleOpen = (id: string) => {
    void openConversation(id);
    navigation.navigate("Chat", { conversationId: id });
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.guest}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={48}
            color={colors.primary}
          />
          <Text style={styles.guestTitle}>{t("chat.guest.title")}</Text>
          <Text style={styles.guestSubtitle}>{t("chat.guest.subtitle")}</Text>
          <Button
            label={t("chat.guest.signin")}
            onPress={() =>
              navigation.getParent<RootTabNavigationProp>()?.navigate("Profile")
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Text style={styles.header}>{t("tab.assistant")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("chat.list.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("chat.list.empty_subtitle")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => handleOpen(item.id)}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title ?? t("chat.list.untitled")}
              </Text>
              <Text style={styles.rowDate}>
                {toPersianDigits(utcIsoToTehranShortJalali(item.updated_at))}
              </Text>
            </View>
            <Pressable
              testID={`conv-delete-${item.id}`}
              onPress={() => setPendingDelete(item.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("chat.list.delete_title")}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={colors.inkMuted}
              />
            </Pressable>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button label={t("chat.list.new")} onPress={handleNew} />
      </View>
      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t("chat.list.delete_title")}
        message={t("chat.list.delete_confirm")}
        confirmLabel={t("pets.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          if (pendingDelete) void removeConversation(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
        testID="conv-delete-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    ...typography.title,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
  },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.bodyLg, color: colors.ink },
  rowDate: { ...typography.caption, color: colors.inkMuted },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.bodyLg, color: colors.ink },
  emptySubtitle: {
    ...typography.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  footer: { padding: spacing.lg },
  guest: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  guestTitle: { ...typography.title, color: colors.ink },
  guestSubtitle: {
    ...typography.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
