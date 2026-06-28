import React from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for restoring the hidden Profile tab
import ProfileStack from "./ProfileStack";
import PetsStack from "./PetsStack";
import TasksStack from "./TasksStack";
import BottomTabBar from "./BottomTabBar";

export type RootTabParamList = {
  Tasks: undefined;
  Pets: undefined;
  Profile: undefined;
};

export type RootTabNavigationProp =
  MaterialTopTabNavigationProp<RootTabParamList>;

// Material top-tab navigator pinned to the bottom: gives finger-following swipe
// between tabs (react-native-pager-view) while a custom BottomTabBar preserves
// the flat Quiet Garden look. See ADR-0018.
const Tab = createMaterialTopTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ lazy: true }}
    >
      <Tab.Screen
        name="Pets"
        component={PetsStack}
        options={{ title: t("tab.pets") }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksStack}
        options={{ title: t("tab.tasks") }}
      />
      {/* ponytail: Profile tab temporarily hidden while we focus on offline-first.
          ProfileStack + the Profile entry in RootTabParamList are kept intact — re-add this <Tab.Screen> to restore. */}
    </Tab.Navigator>
  );
}
