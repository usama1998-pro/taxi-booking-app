import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DriverRootParamList } from './types';

const DRIVER_ROOT_ROUTE_NAMES = new Set<
  keyof DriverRootParamList | string
>(['Home', 'Bookings', 'Invoices']);

function isDriverRootRouteNames(names: string[]): boolean {
  return (
    names.length === DRIVER_ROOT_ROUTE_NAMES.size &&
    names.every((n) => DRIVER_ROOT_ROUTE_NAMES.has(n))
  );
}

/** Loose type so callers can pass `useNavigation()` from nested stacks without ParamList friction. */
export type NavigationLike = {
  getParent(id?: string): NavigationLike | undefined;
  getState?: () => { routeNames?: string[] } | undefined;
};

/**
 * Finds the app root stack (Home / Bookings / Invoices) from any nested screen.
 */
export function getDriverRootNavigation(
  navigation: NavigationLike,
): NativeStackNavigationProp<DriverRootParamList> | undefined {
  let current: NavigationLike | undefined = navigation;
  for (let i = 0; i < 8; i += 1) {
    const names = current.getState?.()?.routeNames;
    if (Array.isArray(names) && isDriverRootRouteNames(names)) {
      return current as NativeStackNavigationProp<DriverRootParamList>;
    }
    current = current.getParent();
    if (!current) {
      return undefined;
    }
  }
  return undefined;
}
