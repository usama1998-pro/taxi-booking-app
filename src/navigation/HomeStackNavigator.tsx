import { DrawerToggleButton } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
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
          title: 'Home',
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
