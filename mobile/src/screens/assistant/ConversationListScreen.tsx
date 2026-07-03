import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";

import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { toPersianDigits, utcIsoToTehranShortJalali } from "../../lib/jalali";
import { colors, radius, shadow, spacing, typography } from "../../theme/theme";
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
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionActive, setSelectionActive] = useState(false);
  const [confirmManyVisible, setConfirmManyVisible] = useState(false);

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

  // Android hardware back exits selection mode instead of leaving the tab.
  useEffect(() => {
    if (!selectionActive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      exitSelection();
      return true;
    });
    return () => sub.remove();
  }, [selectionActive, exitSelection]);

  const allSelected =
    conversations.length > 0 && selectedIds.size === conversations.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === conversations.length
        ? new Set()
        : new Set(conversations.map((c) => c.id)),
    );
  }, [conversations]);

  const handleConfirmDeleteMany = useCallback(async () => {
    setConfirmManyVisible(false);
    for (const id of selectedIds) await removeConversation(id);
    exitSelection();
  }, [selectedIds, removeConversation, exitSelection]);

  const load = useCallback(async () => {
    // First statement is `await` so this never setState synchronously — safe to
    // call from the mount effect (react-hooks/set-state-in-effect).
    try {
      await loadConversations();
    } catch {
      Toast.show({ type: "hint", text1: t("chat.error.network") });
    } finally {
      setLoading(false);
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
    if (token) void load();
  }, [token, load]);

  const handleNew = async () => {
    try {
      const id = await startNewConversation();
      navigation.navigate("Chat", { conversationId: id });
    } catch {
      Toast.show({ type: "hint", text1: t("chat.error.network") });
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

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={48}
              color={colors.inkMuted}
            />
            <Text style={styles.emptyTitle}>{t("chat.list.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("chat.list.empty_subtitle")}
            </Text>
          </View>
        }
        extraData={selectedIds}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              testID={`conv-row-${item.id}`}
              style={styles.row}
              onPress={() => {
                if (selectionActive) toggleSelected(item.id);
                else handleOpen(item.id);
              }}
              onLongPress={() => {
                if (selectionActive) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                  () => {},
                );
                setSelectionActive(true);
                toggleSelected(item.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {selectionActive && (
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={selected ? colors.primary : colors.inkMuted}
                />
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title ?? t("chat.list.untitled")}
                </Text>
                <Text style={styles.rowDate}>
                  {toPersianDigits(utcIsoToTehranShortJalali(item.updated_at))}
                </Text>
              </View>
              {!selectionActive && (
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
              )}
            </Pressable>
          );
        }}
      />
      {selectionActive ? (
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
            {t("pets.select_mode.selected_count", {
              count: toPersianDigits(selectedIds.size),
            })}
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
            onPress={() => selectedIds.size > 0 && setConfirmManyVisible(true)}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel={t("chat.list.delete_title")}
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
          testID="conv-new"
          onPress={handleNew}
          accessibilityRole="button"
          accessibilityLabel={t("chat.list.new")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
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
      <ConfirmDialog
        testID="conv-delete-many-dialog"
        visible={confirmManyVisible}
        title={t("chat.list.delete_title")}
        message={t("chat.list.delete_confirm_many", {
          count: toPersianDigits(selectedIds.size),
        })}
        confirmLabel={t("pets.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDeleteMany}
        onCancel={() => setConfirmManyVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96, // clear the FAB so the last row isn't hidden
    gap: spacing.sm,
    flexGrow: 1,
  },
  listEmpty: {
    paddingBottom: 0, // let the empty component center true, not offset by FAB clearance
  },
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
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: { ...typography.bodyLg, color: colors.ink },
  emptySubtitle: {
    ...typography.body,
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
    ...typography.body,
    color: colors.ink,
  },
});
