// Stub — implemented in Task 9
import React from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const SignupScreen: React.FC<Props> = () => {
  return (
    <View>
      <Text>Sign Up</Text>
    </View>
  );
};

export default SignupScreen;
