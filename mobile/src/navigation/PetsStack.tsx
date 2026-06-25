import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import PetsListScreen from '../screens/pets/PetsListScreen';
import PetDetailScreen from '../screens/pets/PetDetailScreen';
import PetFormScreen from '../screens/pets/PetFormScreen';
import TaskFormScreen from '../screens/tasks/TaskFormScreen';
import { colors } from '../theme/theme';

export type PetsStackParamList = {
  PetsList: undefined;
  PetDetail: { petId: string };
  PetForm: { petId?: string }; // no param / undefined = Add mode; { petId } = Edit mode
  TaskForm: { petId?: string; taskId?: string; title?: string }; // Add mode: no taskId; Edit mode: taskId set
};

export type PetsNavigationProp = NativeStackNavigationProp<PetsStackParamList>;

const Stack = createNativeStackNavigator<PetsStackParamList>();

export default function PetsStack() {
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
      <Stack.Screen name="PetsList" component={PetsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetDetail" component={PetDetailScreen} />
      <Stack.Screen name="PetForm" component={PetFormScreen} />
      <Stack.Screen name="TaskForm" component={TaskFormScreen} />
    </Stack.Navigator>
  );
}
