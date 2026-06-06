import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { getDriverRootNavigation } from './getDriverRootNavigation';
import type { NavigationLike } from './getDriverRootNavigation';

export const brandBlue = '#1E88E5';

/** Shown in app chrome, headers, and pickup sign. */
export const brandDisplayName = 'BarcelonaTaxi24';

/** Pickup-sign header — single brand line. */
export function getPickupSignBrandLines(): { headline: string; tagline: string } {
  return { headline: brandDisplayName, tagline: '' };
}

export function HeaderBackToHomeButton({ navigation }: { navigation: NavigationLike }) {
  const root = getDriverRootNavigation(navigation);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to main menu"
      hitSlop={12}
      onPress={() => root?.navigate('Home')}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

export function HeaderRefreshButton({
  onPress,
  refreshing = false,
}: {
  onPress: () => void;
  refreshing?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={refreshing ? 'Refreshing' : 'Refresh bookings and Viator inbox'}
      disabled={refreshing}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && !refreshing && styles.pressed,
        refreshing && styles.disabled,
      ]}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
      )}
    </Pressable>
  );
}

export function HeaderSignOutButton() {
  const { signOut, isSigningOut } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSigningOut ? 'Signing out' : 'Sign out'}
      disabled={isSigningOut}
      hitSlop={12}
      onPress={() => void signOut()}
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && !isSigningOut && styles.pressed,
        isSigningOut && styles.disabled,
      ]}
    >
      <Ionicons name="power-outline" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

export function HeaderRefreshAndSignOut({
  onRefresh,
  refreshing = false,
}: {
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <View style={styles.headerRightRow}>
      <HeaderRefreshButton onPress={onRefresh} refreshing={refreshing} />
      <HeaderSignOutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  iconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
