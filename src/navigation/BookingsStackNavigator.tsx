import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import { BookingsListScreen } from '../screens/bookings/BookingsListScreen';
import {
  EditReservationScreen,
  editReservationScreenOptions,
} from '../screens/bookings/EditReservationScreen';
import {
  NewReservationScreen,
  newReservationScreenOptions,
} from '../screens/bookings/NewReservationScreen';
import { PickupSignScreen } from '../screens/pickup/PickupSignScreen';
import { bookingsListScreenOptions } from './bookingsListScreenOptions';
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
        options={({ navigation }) => bookingsListScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="NewReservation"
        component={NewReservationScreen}
        options={({ navigation }) => newReservationScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="EditReservation"
        component={EditReservationScreen}
        options={({ navigation }) => editReservationScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PickupSign"
        component={PickupSignScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
