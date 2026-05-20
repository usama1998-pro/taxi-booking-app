import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { spacing } from '../theme';
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
    headerStyle: {
      backgroundColor: brandBlue,
      paddingTop: spacing.sm,
    },
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
