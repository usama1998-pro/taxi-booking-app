import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import {
  EditReservationScreen,
  editReservationScreenOptions,
} from '../screens/bookings/EditReservationScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { PickupSignScreen } from '../screens/pickup/PickupSignScreen';
import { driverNativeStackScreenOptions } from './driverHeaderOptions';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={driverNativeStackScreenOptions}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditReservation"
        component={EditReservationScreen}
        options={({ navigation }) => editReservationScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="PickupSign"
        component={PickupSignScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
