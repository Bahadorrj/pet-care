import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import ProfileStack from './ProfileStack';
import PetsStack from './PetsStack';
import { colors } from '../theme/theme';

export type RootTabParamList = {
  Pets: undefined;
  Profile: undefined;
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopWidth: 0, elevation: 0 },
      }}
    >
      <Tab.Screen
        name="Pets"
        component={PetsStack}
        options={{
          tabBarLabel: t('tab.pets'),
          tabBarIcon: ({ color, size }) => <Ionicons name="paw-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('tab.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
