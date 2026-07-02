import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../i18n";
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
  api.listConversations.mockResolvedValue([]);
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    streaming: false,
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
