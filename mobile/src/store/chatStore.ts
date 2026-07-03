import { create } from "zustand";

import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  retryMessage,
  sendMessage,
  type ChatStreamEvent,
  type ConversationSummary,
} from "../api/chat";
import type { PetContextBundle } from "../lib/petContext";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  interrupted?: boolean;
  /** user message whose send failed before any reply token arrived */
  failed?: boolean;
}

interface ChatState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  /** messages of the active conversation only — server is source of truth */
  messages: ChatMessage[];
  streaming: boolean;

  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  startNewConversation: () => Promise<string>;
  send: (content: string, context: PetContextBundle) => Promise<void>;
  retry: (context: PetContextBundle) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
}

let localSeq = 0;
const localId = () => `local-${++localSeq}`;

export const useChatStore = create<ChatState>((set, get) => {
  /** Shared delta/done/error handling for send and retry streams. */
  const handleStream =
    (assistantId: string) =>
    (evt: ChatStreamEvent): void => {
      if ("delta" in evt) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + evt.delta } : m,
          ),
        }));
      } else if ("done" in evt) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, id: evt.message_id } : m,
          ),
          conversations: evt.title
            ? s.conversations.map((c) =>
                c.id === s.activeConversationId
                  ? { ...c, title: evt.title }
                  : c,
              )
            : s.conversations,
        }));
      } else {
        // terminal stream error: drop an empty bubble, keep a partial as interrupted
        set((s) => ({
          messages: s.messages.flatMap((m) => {
            if (m.id !== assistantId) return [m];
            return m.content === "" ? [] : [{ ...m, interrupted: true }];
          }),
        }));
      }
    };

  return {
    conversations: [],
    activeConversationId: null,
    messages: [],
    streaming: false,

    loadConversations: async () => {
      set({ conversations: await listConversations() });
    },

    openConversation: async (id) => {
      if (get().activeConversationId === id) return;
      set({ activeConversationId: id, messages: [] });
      const msgs = await listMessages(id);
      set({
        messages: msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          interrupted: m.interrupted,
        })),
      });
    },

    startNewConversation: async () => {
      const conv = await createConversation();
      set((s) => ({
        conversations: [conv, ...s.conversations],
        activeConversationId: conv.id,
        messages: [],
      }));
      return conv.id;
    },

    send: async (content, context) => {
      const conversationId = get().activeConversationId;
      if (!conversationId || get().streaming) return;
      const userId = localId();
      const assistantId = localId();
      set((s) => ({
        streaming: true,
        messages: [
          ...s.messages,
          { id: userId, role: "user", content },
          { id: assistantId, role: "assistant", content: "" },
        ],
      }));
      try {
        await sendMessage(
          conversationId,
          content,
          context,
          handleStream(assistantId),
        );
      } catch (err) {
        // transport failure before/while streaming: mark the user msg failed
        set((s) => ({
          messages: s.messages
            .filter((m) => !(m.id === assistantId && m.content === ""))
            .map((m) => (m.id === userId ? { ...m, failed: true } : m)),
        }));
        throw err;
      } finally {
        set({ streaming: false });
      }
    },

    retry: async (context) => {
      const conversationId = get().activeConversationId;
      if (!conversationId || get().streaming) return;
      const assistantId = localId();
      set((s) => ({
        streaming: true,
        // clear failed/interrupted marks; server deletes the partial row itself
        messages: [
          ...s.messages
            .filter((m) => !(m.role === "assistant" && m.interrupted))
            .map((m) => ({ ...m, failed: false })),
          { id: assistantId, role: "assistant" as const, content: "" },
        ],
      }));
      try {
        await retryMessage(conversationId, context, handleStream(assistantId));
      } catch (err) {
        set((s) => ({
          messages: s.messages
            .filter((m) => !(m.id === assistantId && m.content === ""))
            .map((m, i, arr) =>
              i === arr.length - 1 && m.role === "user"
                ? { ...m, failed: true }
                : m,
            ),
        }));
        throw err;
      } finally {
        set({ streaming: false });
      }
    },

    removeConversation: async (id) => {
      await deleteConversation(id);
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        ...(s.activeConversationId === id
          ? { activeConversationId: null, messages: [] }
          : {}),
      }));
    },
  };
});
