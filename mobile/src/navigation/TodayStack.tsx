import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TodayScreen from '../screens/today/TodayScreen';
import ChoreFormScreen from '../screens/chores/ChoreFormScreen';
import QuickAddScreen from '../screens/today/QuickAddScreen';
import { colors } from '../theme/theme';

export type TodayStackParamList = {
  Today: undefined;
  ChoreForm: { petId: string; choreId?: string; title?: string };
  QuickAdd: undefined;
};

export type TodayNavigationProp = NativeStackNavigationProp<TodayStackParamList>;

const Stack = createNativeStackNavigator<TodayStackParamList>();

export default function TodayStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Today" component={TodayScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChoreForm" component={ChoreFormScreen} />
      <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ presentation: 'formSheet' }} />
    </Stack.Navigator>
  );
}
