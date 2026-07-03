import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import i18n from "../i18n";
import ChatScreen from "../screens/assistant/ChatScreen";
import { useChatStore } from "../store/chatStore";
import { usePetsStore } from "../store/petsStore";

jest.mock("../api/chat", () => ({
  listConversations: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  listMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn(),
  retryMessage: jest.fn(),
}));

const api = jest.requireMock("../api/chat");

const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRoute: () => ({ params: { conversationId: "c1" } }),
}));

const mockNetInfo = { isConnected: true };
jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockNetInfo,
}));

let mockKvStore: Record<string, string> = {};
jest.mock("../db/kv", () => ({
  kvGet: (k: string) => mockKvStore[k] ?? null,
  kvSet: (k: string, v: string) => {
    mockKvStore[k] = v;
  },
}));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, bottom: 0, right: 0 },
};

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <ChatScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  mockKvStore = {};
  mockNetInfo.isConnected = true;
  mockSetOptions.mockClear();
  api.listMessages.mockClear();
  api.listMessages.mockResolvedValue([]);
  useChatStore.setState({
    activeConversationId: "c1",
    messages: [],
    streaming: false,
    conversations: [],
  });
  usePetsStore.setState({ pets: [] });
});

describe("ChatScreen", () => {
  it("shows the one-time disclaimer until dismissed", async () => {
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByText(
          "این دستیار جایگزین دامپزشک نیست. پیام‌ها و اطلاعات پت‌ها برای پاسخ‌گویی به یک سرویس هوش مصنوعی فرستاده می‌شود.",
        ),
      ).toBeTruthy(),
    );
  });

  it("hides the disclaimer when previously dismissed", async () => {
    mockKvStore["chat_disclaimer_dismissed"] = "1";
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("chat-input")).toBeTruthy());
    expect(screen.queryByText(/جایگزین دامپزشک نیست/)).toBeNull();
  });

  it("renders messages and an interrupted marker with retry", async () => {
    useChatStore.setState({
      messages: [
        { id: "m1", role: "user", content: "سوال من" },
        { id: "m2", role: "assistant", content: "نصف پاسخ", interrupted: true },
      ],
    });
    renderScreen();
    await waitFor(() => expect(screen.getByText("سوال من")).toBeTruthy());
    expect(screen.getByText("نصف پاسخ")).toBeTruthy();
    expect(screen.getByText("پاسخ ناتمام ماند")).toBeTruthy();
    expect(screen.getByText("تلاش مجدد")).toBeTruthy();
  });

  it("disables the composer while offline", async () => {
    mockNetInfo.isConnected = false;
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("برای گفتگو به اینترنت وصل شو")).toBeTruthy(),
    );
    expect(screen.getByTestId("chat-input").props.editable).toBe(false);
  });

  it("sets the header title from the active conversation", async () => {
    useChatStore.setState({
      conversations: [
        { id: "c1", title: "سلام", updated_at: "2026-07-02T10:00:00Z" },
      ],
    });
    renderScreen();
    await waitFor(() =>
      expect(mockSetOptions).toHaveBeenCalledWith({ headerTitle: "سلام" }),
    );
  });

  it("falls back to the untitled label when the conversation has no title", async () => {
    renderScreen();
    await waitFor(() =>
      expect(mockSetOptions).toHaveBeenCalledWith({
        headerTitle: i18n.t("chat.list.untitled"),
      }),
    );
  });

  it("loads the conversation when the store's active id differs from the route param", async () => {
    useChatStore.setState({ activeConversationId: "other" });
    renderScreen();
    await waitFor(() => expect(api.listMessages).toHaveBeenCalledWith("c1"));
  });

  it("surfaces an error when loading the mismatched conversation fails", async () => {
    useChatStore.setState({ activeConversationId: "other" });
    api.listMessages.mockRejectedValueOnce(new Error("network"));
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(i18n.t("chat.error.network"))).toBeTruthy(),
    );
  });
});
