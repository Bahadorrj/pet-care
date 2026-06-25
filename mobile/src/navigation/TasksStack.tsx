import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TasksScreen from '../screens/tasks/TasksScreen';
import TaskFormScreen from '../screens/tasks/TaskFormScreen';
import { colors } from '../theme/theme';

export type TasksStackParamList = {
  TasksHome: undefined;
  TaskForm: { petId?: string; taskId?: string; title?: string };
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
      <Stack.Screen name="TaskForm" component={TaskFormScreen} />
    </Stack.Navigator>
  );
}
