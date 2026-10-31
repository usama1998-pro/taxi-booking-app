import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import {
  EditReservationScreen,
  editReservationScreenOptions,
} from '../screens/bookings/EditReservationScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { PickupSignScreen } from '../screens/pickup/PickupSignScreen';
import {
  PricesScreen,
  pricesScreenOptions,
} from '../screens/pricing/PricesScreen';
import {
  CalculateScreen,
  calculateScreenOptions,
} from '../screens/pricing/CalculateScreen';
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
        options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen
        name="Prices"
        component={PricesScreen}
        options={({ navigation }) => pricesScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="Calculate"
        component={CalculateScreen}
        options={({ navigation }) => calculateScreenOptions({ navigation })}
      />
    </Stack.Navigator>
  );
}
