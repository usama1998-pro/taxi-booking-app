import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ViatorNotificationsListener } from '../components/viator/ViatorNotificationsListener';
import { BookingsStackNavigator } from './BookingsStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { InvoicesStackNavigator } from './InvoicesStackNavigator';
import type { DriverRootParamList } from './types';

const Stack = createNativeStackNavigator<DriverRootParamList>();

/**
 * Main app shell without a drawer: top-level sections are stack siblings so the home menu can jump between them.
 */
export function DriverRootNavigator() {
  return (
    <>
      <ViatorNotificationsListener />
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeStackNavigator} />
        <Stack.Screen name="Bookings" component={BookingsStackNavigator} />
        <Stack.Screen name="Invoices" component={InvoicesStackNavigator} />
      </Stack.Navigator>
    </>
  );
}
