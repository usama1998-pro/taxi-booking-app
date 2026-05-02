import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors, spacing } from '../theme';

/** Extra breathing room below the status bar / safe area on stack headers. */
const HEADER_TOP_PADDING = spacing.sm;

export const driverNativeStackScreenOptions: NativeStackNavigationOptions = {
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: '600' },
  contentStyle: { backgroundColor: colors.background },
  headerStyle: {
    backgroundColor: colors.background,
    paddingTop: HEADER_TOP_PADDING,
  } as NativeStackNavigationOptions['headerStyle'],
};

export const driverDrawerHeaderStyle = {
  backgroundColor: colors.background,
  paddingTop: HEADER_TOP_PADDING,
};
