import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import ConversationListScreen from "../screens/assistant/ConversationListScreen";
import { colors } from "../theme/theme";

export type AssistantStackParamList = {
  ConversationList: undefined;
  Chat: { conversationId: string };
};

export type AssistantNavigationProp =
  NativeStackNavigationProp<AssistantStackParamList>;

const Stack = createNativeStackNavigator<AssistantStackParamList>();

export default function AssistantStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitle: "",
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ headerShown: false }}
      />
      {/* Chat screen registered in the next task */}
    </Stack.Navigator>
  );
}
