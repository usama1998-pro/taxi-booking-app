import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { AuthStackNavigator } from './AuthStackNavigator';
import { DriverDrawerNavigator } from './DriverDrawerNavigator';

export function RootNavigator() {
  const { user, isHydrating } = useAuth();

  return (
    <NavigationContainer>
      {isHydrating ? (
        <View style={styles.boot}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : user ? (
        <DriverDrawerNavigator />
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
