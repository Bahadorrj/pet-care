import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import ProfileScreen from "../screens/profile/ProfileScreen";
import SigninScreen from "../screens/auth/SigninScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import ChangeUsernameScreen from "../screens/profile/ChangeUsernameScreen";
import { colors } from "../theme/theme";

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Signin: undefined;
  Signup: undefined;
  ChangeUsername: undefined;
};

export type ProfileNavigationProp =
  NativeStackNavigationProp<ProfileStackParamList>;

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
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
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Signin" component={SigninScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ChangeUsername" component={ChangeUsernameScreen} />
    </Stack.Navigator>
  );
}
