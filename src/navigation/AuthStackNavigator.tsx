import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { VerificationScreen } from '../screens/auth/VerificationScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTransparent: true,
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600', color: '#ffffff' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: '#2C2C2C' },
        }}
      />
    </Stack.Navigator>
  );
}
