import { useChatStore } from "../store/chatStore";
import type { ChatStreamEvent } from "../api/chat";
import type { PetContextBundle } from "../lib/petContext";

jest.mock("../api/chat", () => ({
  listConversations: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  retryMessage: jest.fn(),
}));

const api = jest.requireMock("../api/chat");

const BUNDLE: PetContextBundle = {
  pets: [],
  scope: "all",
  todayJalali: "۱۴۰۵/۰۴/۱۱",
};

beforeEach(() => {
  jest.clearAllMocks();
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    streaming: false,
  });
});

it("loadConversations fills the list", async () => {
  api.listConversations.mockResolvedValue([
    { id: "c1", title: "سلام", updated_at: "2026-07-02T10:00:00Z" },
  ]);
  await useChatStore.getState().loadConversations();
  expect(useChatStore.getState().conversations).toHaveLength(1);
});

it("send appends user message, accumulates deltas, finalizes on done", async () => {
  useChatStore.setState({ activeConversationId: "c1" });
  api.sendMessage.mockImplementation(
    async (
      _id: string,
      _c: string,
      _ctx: unknown,
      onEvent: (e: ChatStreamEvent) => void,
    ) => {
      onEvent({ delta: "سلا" });
      onEvent({ delta: "م" });
      onEvent({ done: true, message_id: "m9", title: "عنوان" });
    },
  );
  await useChatStore.getState().send("سوال من", BUNDLE);
  const { messages, streaming } = useChatStore.getState();
  expect(streaming).toBe(false);
  expect(messages[messages.length - 2].content).toBe("سوال من");
  expect(messages[messages.length - 1]).toMatchObject({
    id: "m9",
    role: "assistant",
    content: "سلام",
  });
});

it("send marks the user message failed on transport error", async () => {
  useChatStore.setState({ activeConversationId: "c1" });
  api.sendMessage.mockRejectedValue(new Error("chat.error.network"));
  await expect(useChatStore.getState().send("سوال", BUNDLE)).rejects.toThrow(
    "chat.error.network",
  );
  const { messages, streaming } = useChatStore.getState();
  expect(streaming).toBe(false);
  expect(messages[messages.length - 1]).toMatchObject({
    role: "user",
    failed: true,
  });
});

it("openConversation no-ops when the id is already active", async () => {
  useChatStore.setState({
    activeConversationId: "c1",
    messages: [{ id: "m1", role: "user", content: "قبلی" }],
  });
  await useChatStore.getState().openConversation("c1");
  expect(api.listMessages).not.toHaveBeenCalled();
  expect(useChatStore.getState().messages).toEqual([
    { id: "m1", role: "user", content: "قبلی" },
  ]);
});

it("stream error event marks the assistant bubble interrupted", async () => {
  useChatStore.setState({ activeConversationId: "c1" });
  api.sendMessage.mockImplementation(
    async (
      _id: string,
      _c: string,
      _ctx: unknown,
      onEvent: (e: ChatStreamEvent) => void,
    ) => {
      onEvent({ delta: "نصف" });
      onEvent({ error: "provider_error" });
    },
  );
  await useChatStore.getState().send("سوال", BUNDLE);
  const last = useChatStore.getState().messages.at(-1);
  expect(last).toMatchObject({
    role: "assistant",
    content: "نصف",
    interrupted: true,
  });
});

it("startNewConversation creates server-side and activates it", async () => {
  api.createConversation.mockResolvedValue({
    id: "c2",
    title: null,
    updated_at: "x",
  });
  const id = await useChatStore.getState().startNewConversation();
  expect(id).toBe("c2");
  expect(useChatStore.getState().activeConversationId).toBe("c2");
  expect(useChatStore.getState().messages).toEqual([]);
});
