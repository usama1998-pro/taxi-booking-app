import { createDrawerNavigator } from '@react-navigation/drawer';

import { PerformanceScreen } from '../screens/performance/PerformanceScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { InvoicesStackNavigator } from './InvoicesStackNavigator';
import { colors } from '../theme';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { driverDrawerHeaderStyle } from './driverHeaderOptions';
import { DriverDrawerContent } from './DriverDrawerContent';
import { HomeStackNavigator } from './HomeStackNavigator';
import type { DriverDrawerParamList } from './types';

const Drawer = createDrawerNavigator<DriverDrawerParamList>();

export function DriverDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DriverDrawerContent {...props} />}
      screenOptions={{
        headerStyle: driverDrawerHeaderStyle,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '600' },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.primaryMuted,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          drawerLabel: 'Home',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Bookings"
        component={BookingsStackNavigator}
        options={{
          title: 'All bookings',
          drawerLabel: 'All bookings',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Invoices"
        component={InvoicesStackNavigator}
        options={{
          title: 'Invoices',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Performance"
        component={PerformanceScreen}
        options={{
          title: 'Performance',
          drawerLabel: 'Performance',
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          drawerLabel: 'Profile',
        }}
      />
    </Drawer.Navigator>
  );
}
