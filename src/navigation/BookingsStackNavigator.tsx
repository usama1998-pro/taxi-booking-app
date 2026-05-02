import { DrawerToggleButton } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import { BookingsListScreen } from '../screens/bookings/BookingsListScreen';
import { PickupSignScreen } from '../screens/pickup/PickupSignScreen';
import { driverNativeStackScreenOptions } from './driverHeaderOptions';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={driverNativeStackScreenOptions}
    >
      <Stack.Screen
        name="BookingsList"
        component={BookingsListScreen}
        options={{
          title: 'All bookings',
          headerLeft: (props) => <DrawerToggleButton tintColor={props.tintColor} />,
        }}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking details' }}
      />
      <Stack.Screen
        name="PickupSign"
        component={PickupSignScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
