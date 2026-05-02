import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
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
        name="SignIn"
        component={SignInScreen}
        options={{ title: 'Driver sign in' }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ title: 'Create driver account' }}
      />
    </Stack.Navigator>
  );
}
