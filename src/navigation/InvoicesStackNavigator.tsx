import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  InvoiceCreateScreen,
  invoiceCreateScreenOptions,
} from '../screens/invoices/InvoiceCreateScreen';
import { InvoiceDetailScreen } from '../screens/invoices/InvoiceDetailScreen';
import { InvoicesListScreen } from '../screens/invoices/InvoicesListScreen';
import { driverNativeStackScreenOptions } from './driverHeaderOptions';
import { HomeMenuHeaderButton } from './HomeMenuHeaderButton';
import type { InvoicesStackParamList } from './types';

const Stack = createNativeStackNavigator<InvoicesStackParamList>();

export function InvoicesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={driverNativeStackScreenOptions}>
      <Stack.Screen
        name="InvoicesList"
        component={InvoicesListScreen}
        options={{
          title: 'Invoices',
          headerLeft: () => <HomeMenuHeaderButton />,
        }}
      />
      <Stack.Screen
        name="InvoiceCreate"
        component={InvoiceCreateScreen}
        options={({ navigation }) => invoiceCreateScreenOptions({ navigation })}
      />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={{ title: 'Invoice' }}
      />
    </Stack.Navigator>
  );
}
