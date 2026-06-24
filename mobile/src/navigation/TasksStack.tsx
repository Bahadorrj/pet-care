import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TasksScreen from '../screens/tasks/TasksScreen';
import ChoreFormScreen from '../screens/chores/ChoreFormScreen';
import QuickAddScreen from '../screens/tasks/QuickAddScreen';
import { colors } from '../theme/theme';

export type TasksStackParamList = {
  TasksHome: undefined;
  ChoreForm: { petId: string; choreId?: string; title?: string };
  QuickAdd: undefined;
};

export type TasksNavigationProp = NativeStackNavigationProp<TasksStackParamList>;

const Stack = createNativeStackNavigator<TasksStackParamList>();

export default function TasksStack() {
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
      <Stack.Screen name="TasksHome" component={TasksScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChoreForm" component={ChoreFormScreen} />
      <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ presentation: 'formSheet' }} />
    </Stack.Navigator>
  );
}
