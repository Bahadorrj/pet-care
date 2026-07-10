import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";

import { useChatStore, type ChatMessage } from "../../store/chatStore";
import { usePetsStore } from "../../store/petsStore";
import { useTasksStore } from "../../store/tasksStore";
import { buildPetContext } from "../../lib/petContext";
import { kvGet, kvSet } from "../../db/kv";
import { colors, fonts, radius, spacing, typography } from "../../theme/theme";
import type { AssistantStackParamList } from "../../navigation/AssistantStack";

const DISCLAIMER_KEY = "chat_disclaimer_dismissed";

export default function ChatScreen() {
  const { t } = useTranslation();
  const netInfo = useNetInfo();
  const offline = netInfo.isConnected === false;
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AssistantStackParamList, "Chat">>();

  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const send = useChatStore((s) => s.send);
  const retry = useChatStore((s) => s.retry);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const openConversation = useChatStore((s) => s.openConversation);

  const pets = usePetsStore((s) => s.pets);
  const tasks = useTasksStore((s) => s.tasks);
  const getLogsForTask = useTasksStore((s) => s.getLogsForTask);

  // A starter chip hands over its question pre-filled — the user still sends it.
  const [draft, setDraft] = useState(route.params.draft ?? "");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => kvGet(DISCLAIMER_KEY) === null,
  );
  // Synchronous in-flight guard (repo convention) on top of `streaming` state.
  const inFlightRef = useRef(false);

  // KeyboardAvoidingView (iOS) / adjustPan (Android) both butt the composer
  // right up against the keyboard — track visibility to add a small gap.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Screen owns loading its own conversation instead of trusting the caller
  // to have primed the store — no-ops when the caller already did.
  useEffect(() => {
    if (activeConversationId !== route.params.conversationId) {
      openConversation(route.params.conversationId).catch(() =>
        setError(t("chat.error.network")),
      );
    }
  }, [route.params.conversationId, activeConversationId, openConversation, t]);

  useEffect(() => {
    // AssistantStack's screenOptions sets headerTitle: "" for the whole
    // stack, and a string headerTitle always outranks `title` — must set
    // headerTitle directly here to actually override it.
    const headerTitle =
      conversations.find((c) => c.id === activeConversationId)?.title ??
      t("chat.list.untitled");
    navigation.setOptions({ headerTitle });
  }, [navigation, conversations, activeConversationId, t]);

  const context = () =>
    buildPetContext(pets, tasks, getLogsForTask, selectedPetIds);

  const inverted = useMemo(() => [...messages].reverse(), [messages]);
  const lastFailed = messages.at(-1)?.failed === true;
  const lastInterrupted =
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)?.interrupted === true;

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || inFlightRef.current || streaming || offline) return;
    inFlightRef.current = true;
    setError("");
    setDraft("");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await send(content, context());
    } catch (err) {
      setError(t(err instanceof Error ? err.message : "chat.error.network"));
      setDraft(content); // never lose the user's text
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleRetry = async () => {
    if (inFlightRef.current || streaming || offline) return;
    inFlightRef.current = true;
    setError("");
    try {
      await retry(context());
    } catch (err) {
      setError(t(err instanceof Error ? err.message : "chat.error.network"));
    } finally {
      inFlightRef.current = false;
    }
  };

  const togglePet = (id: string) =>
    setSelectedPetIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}
      >
        <Text style={isUser ? styles.userText : styles.aiText}>
          {item.content}
        </Text>
        {item.interrupted ? (
          <Text style={styles.interrupted}>{t("chat.interrupted")}</Text>
        ) : null}
        {item.failed ? (
          <Text style={styles.interrupted}>{t("chat.error.network")}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {showDisclaimer ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{t("chat.disclaimer")}</Text>
            <Pressable
              onPress={() => {
                kvSet(DISCLAIMER_KEY, "1");
                setShowDisclaimer(false);
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.disclaimerDismiss}>
                {t("chat.disclaimer.dismiss")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          style={styles.messageList}
          inverted
          data={inverted}
          keyExtractor={(m) => m.id}
          renderItem={renderBubble}
          contentContainerStyle={styles.listContent}
        />

        {(lastFailed || lastInterrupted) && !streaming ? (
          <Pressable
            onPress={handleRetry}
            style={styles.retryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{t("chat.retry")}</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {offline ? (
          <Text style={styles.offline}>{t("chat.offline")}</Text>
        ) : null}

        {pets.length > 0 ? (
          <FlatList
            style={styles.chipsList}
            horizontal
            data={pets}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            ListHeaderComponent={
              <Pressable
                onPress={() => setSelectedPetIds([])}
                style={[
                  styles.chip,
                  selectedPetIds.length === 0 && styles.chipSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPetIds.length === 0 }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedPetIds.length === 0 && styles.chipTextSelected,
                  ]}
                >
                  {t("chat.chips.all")}
                </Text>
              </Pressable>
            }
            renderItem={({ item }) => {
              const selected = selectedPetIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => togglePet(item.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        ) : null}

        <View style={[styles.composer, keyboardVisible && styles.composerGap]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("chat.composer.placeholder")}
            placeholderTextColor={colors.inkFaint}
            multiline
            editable={!offline && !streaming}
          />
          <Pressable
            testID="chat-send"
            onPress={handleSend}
            disabled={offline || streaming || !draft.trim()}
            style={[
              styles.sendBtn,
              (offline || streaming || !draft.trim()) && styles.sendBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
          >
            <Ionicons name="send" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  messageList: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  // I18nManager forces RTL app-wide, which mirrors flex-start/flex-end — swap
  // them here so the user's own bubble stays right-aligned like every other
  // chat UI, regardless of writing direction.
  userBubble: { alignSelf: "flex-start", backgroundColor: colors.primarySoft },
  aiBubble: { alignSelf: "flex-end", backgroundColor: colors.surface },
  userText: { ...typography.body, color: colors.ink },
  aiText: { ...typography.body, color: colors.ink },
  interrupted: { ...typography.caption, color: colors.danger },
  disclaimer: {
    backgroundColor: colors.surfaceSunken,
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  disclaimerText: { ...typography.caption, color: colors.inkMuted },
  disclaimerDismiss: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  retryBtn: { alignSelf: "center", padding: spacing.sm },
  retryText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  offline: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: "center",
  },
  chipsList: { flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: { ...typography.label, color: colors.inkMuted },
  chipTextSelected: { color: colors.primary },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  composerGap: { marginBottom: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.ink,
    textAlign: "right",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
