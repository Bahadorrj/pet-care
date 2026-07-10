/**
 * Regression: two starter chips pressed inside one in-flight window must create
 * exactly one conversation.
 *
 * Why its own file: RNTL wraps each `fireEvent` in `act()`, but jest-expo never
 * sets `IS_REACT_ACT_ENVIRONMENT`, so React opens no act scope. A *second* press
 * while a promise is pending tears down the test root — every render after it in
 * the same file returns `null`. The test itself is unaffected; only what follows
 * it is. Isolating it here keeps the damage bounded until the act environment is
 * fixed suite-wide.
 */

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

jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: { pets: { id: string; name: string }[] }) => unknown,
  ) => selector({ pets: [{ id: "p1", name: "رکسی" }] }),
}));

jest.mock("../api/chat", () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  listMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn(),
  retryMessage: jest.fn(),
}));

import "../i18n";
import ConversationListScreen from "../screens/assistant/ConversationListScreen";
import { useAuthStore } from "../store/authStore";

const api = jest.requireMock("../api/chat");

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, bottom: 0, right: 0 },
};

it("a second chip press while the first is in flight creates only one conversation", async () => {
  useAuthStore.setState({ token: "jwt" });

  // Hold the create open — both presses must land while the first is still in
  // flight. Let it resolve and the chips unmount, so there'd be nothing to hit.
  let resolveCreate!: (v: { id: string }) => void;
  api.createConversation.mockReturnValue(
    new Promise<{ id: string }>((res) => {
      resolveCreate = res;
    }),
  );

  render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <NavigationContainer>
        <ConversationListScreen />
      </NavigationContainer>
    </SafeAreaProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("chat-starter-water")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("chat-starter-water"));
  fireEvent.press(screen.getByTestId("chat-starter-food"));

  // Without the in-flight guard this is 2: two conversations, one orphaned.
  expect(api.createConversation).toHaveBeenCalledTimes(1);

  resolveCreate({ id: "conv-1" });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
});
