import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  brandBlue,
  brandDisplayName,
  HeaderBackToHomeButton,
  HeaderSignOutButton,
} from './driverChrome';
import type { BookingsStackParamList } from './types';

type Nav = NativeStackNavigationProp<BookingsStackParamList, 'BookingsList'>;

export function bookingsListScreenOptions({ navigation }: { navigation: Nav }) {
  return {
    headerShown: true,
    title: brandDisplayName,
    headerStyle: { backgroundColor: brandBlue },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: {
      color: '#FFFFFF',
      fontWeight: '600' as const,
      fontSize: 18,
    },
    headerLeft: () => <HeaderBackToHomeButton navigation={navigation} />,
    headerRight: () => <HeaderSignOutButton />,
  };
}
