import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, getParent: () => undefined }),
}));

// petsStore is SQLite-backed and populates at module load — stub it out.
let mockPets: { id: string; name: string }[] = [];
jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: { pets: { id: string; name: string }[] }) => unknown,
  ) => selector({ pets: mockPets }),
}));

import i18n from "../i18n";
import ConversationListScreen from "../screens/assistant/ConversationListScreen";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";

jest.mock("../api/chat", () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  createConversation: jest.fn(),
  deleteConversation: jest.fn().mockResolvedValue(undefined),
  listMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn(),
  retryMessage: jest.fn(),
}));

const api = jest.requireMock("../api/chat");

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, bottom: 0, right: 0 },
};

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <NavigationContainer>
        <ConversationListScreen />
      </NavigationContainer>
    </SafeAreaProvider>,
  );

beforeEach(() => {
  mockNavigate.mockClear();
  mockPets = [];
  api.listConversations.mockResolvedValue([]);
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    streaming: false,
  });
});

describe("ConversationListScreen – starter question chips", () => {
  const STARTER_KEYS = [
    "chat.starter.water",
    "chat.starter.food",
    "chat.starter.vet",
    "chat.starter.grooming",
  ];

  it("shows no chips when the user has no pets", async () => {
    useAuthStore.setState({ token: "jwt" });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(i18n.t("chat.list.empty_title"))).toBeTruthy(),
    );
    expect(screen.queryByTestId("chat-starter-water")).toBeNull();
  });

  it("builds a chip per starter question from the user's pets", async () => {
    mockPets = [{ id: "p1", name: "رکسی" }];
    useAuthStore.setState({ token: "jwt" });
    renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId("chat-starter-water")).toBeTruthy(),
    );
    for (const key of STARTER_KEYS) {
      expect(screen.getByText(i18n.t(key, { name: "رکسی" }))).toBeTruthy();
    }
  });

  it("tapping a chip starts a conversation and opens Chat with that draft", async () => {
    mockPets = [{ id: "p1", name: "رکسی" }];
    useAuthStore.setState({ token: "jwt" });
    api.createConversation.mockResolvedValue({ id: "conv-9" });
    renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId("chat-starter-water")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("chat-starter-water"));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("Chat", {
        conversationId: "conv-9",
        draft: i18n.t("chat.starter.water", { name: "رکسی" }),
      }),
    );
  });

  it("chips disappear once a conversation exists", async () => {
    mockPets = [{ id: "p1", name: "رکسی" }];
    useAuthStore.setState({ token: "jwt" });
    api.listConversations.mockResolvedValue([
      { id: "c1", title: "سلام", updated_at: "2026-07-01T00:00:00Z" },
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("conv-row-c1")).toBeTruthy());
    expect(screen.queryByTestId("chat-starter-water")).toBeNull();
  });
});

describe("ConversationListScreen", () => {
  it("shows the guest gate when signed out", async () => {
    useAuthStore.setState({ token: null });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("ورود / ثبت‌نام")).toBeTruthy(),
    );
    expect(screen.queryByTestId("conv-new")).toBeNull();
  });

  it("shows empty state + new-chat FAB when signed in", async () => {
    useAuthStore.setState({ token: "jwt" });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("هنوز گفتگویی نداری")).toBeTruthy(),
    );
    expect(screen.getByTestId("conv-new")).toBeTruthy();
  });

  it("lists conversations and confirms deletion", async () => {
    useAuthStore.setState({ token: "jwt" });
    api.listConversations.mockResolvedValue([
      { id: "c1", title: "غذای گربه", updated_at: "2026-07-02T10:00:00Z" },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("غذای گربه")).toBeTruthy());
    fireEvent.press(screen.getByTestId("conv-delete-c1"));
    await waitFor(() =>
      expect(
        screen.getByText("آیا مطمئنی که می‌خواهی این گفتگو را حذف کنی؟"),
      ).toBeTruthy(),
    );
  });

  it("long-press selects multiple conversations and bulk-deletes via the selection toolbar", async () => {
    useAuthStore.setState({ token: "jwt" });
    api.listConversations.mockResolvedValue([
      { id: "c1", title: "غذای گربه", updated_at: "2026-07-02T10:00:00Z" },
      { id: "c2", title: "واکسیناسیون", updated_at: "2026-07-01T10:00:00Z" },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("غذای گربه")).toBeTruthy());

    fireEvent(screen.getByTestId("conv-row-c1"), "longPress");
    await waitFor(() =>
      expect(
        screen.getByTestId("conv-row-c1").props.accessibilityState?.selected,
      ).toBe(true),
    );

    fireEvent.press(screen.getByTestId("conv-row-c2"));
    await waitFor(() =>
      expect(
        screen.getByTestId("conv-row-c2").props.accessibilityState?.selected,
      ).toBe(true),
    );

    fireEvent.press(screen.getByTestId("selection-delete"));
    await waitFor(() =>
      expect(screen.getByTestId("conv-delete-many-dialog")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("conv-delete-many-dialog-confirm"));

    await waitFor(() => {
      expect(api.deleteConversation).toHaveBeenCalledWith("c1");
      expect(api.deleteConversation).toHaveBeenCalledWith("c2");
    });
    expect(screen.queryByTestId("selection-cancel")).toBeNull();
  });
});
