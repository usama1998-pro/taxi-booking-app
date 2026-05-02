import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { type DriverUser, useAuth } from '../context/AuthContext';
import { colors, spacing, typography } from '../theme';

function formatRatingLine(user: DriverUser | null): string {
  if (!user) {
    return 'No ratings yet';
  }
  const avg = user.ratingAverage;
  const count = user.ratingCount ?? 0;
  if (avg == null || Number.isNaN(avg) || avg <= 0) {
    return 'No ratings yet';
  }
  const rounded = Math.round(avg * 10) / 10;
  const base = `★ ${rounded.toFixed(1)}`;
  if (count > 0) {
    return `${base} · ${count} ${count === 1 ? 'rating' : 'ratings'}`;
  }
  return base;
}

export function DriverDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut, isSigningOut } = useAuth();
  const name = user?.name ?? 'Driver';
  const initial = name.trim().slice(0, 1).toUpperCase() || '?';
  const photoUri = user?.photoUrl?.trim() || null;

  const active = props.state.routes[props.state.index];
  const isFocused = (routeName: string) => active?.name === routeName;

  const invoicesNestedRoute =
    active?.name === 'Invoices' && active.state != null
      ? getFocusedRouteNameFromRoute(active)
      : undefined;
  const invoicesListFocused =
    active?.name === 'Invoices' &&
    (invoicesNestedRoute === 'InvoicesList' ||
      invoicesNestedRoute === 'InvoiceDetail' ||
      invoicesNestedRoute === undefined);
  const invoiceCreateFocused =
    active?.name === 'Invoices' && invoicesNestedRoute === 'InvoiceCreate';

  const closeAnd = (fn: () => void) => {
    fn();
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scroll}
      style={styles.drawer}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.avatarRing} accessibilityLabel="Profile photo">
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{initial}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{name}</Text>
            <Text
              style={[
                styles.rating,
                user?.ratingAverage != null &&
                  user.ratingAverage > 0 &&
                  !Number.isNaN(user.ratingAverage)
                  ? styles.ratingActive
                  : styles.ratingMuted,
              ]}
            >
              {formatRatingLine(user)}
            </Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </View>

      <DrawerItem
        label="Home"
        focused={isFocused('Home')}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Home');
          })
        }
      />

      <Text style={styles.drawerSection}>Trips</Text>
      <DrawerItem
        label="All bookings"
        focused={isFocused('Bookings')}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Bookings');
          })
        }
      />

      <Text style={styles.drawerSection}>Billing</Text>
      <DrawerItem
        label="All invoices"
        focused={invoicesListFocused}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Invoices', { screen: 'InvoicesList' });
          })
        }
      />
      <DrawerItem
        label="New invoice"
        focused={invoiceCreateFocused}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Invoices', { screen: 'InvoiceCreate', params: {} });
          })
        }
      />

      <Text style={styles.drawerSection}>Insights</Text>
      <DrawerItem
        label="Performance"
        focused={isFocused('Performance')}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Performance');
          })
        }
      />

      <Text style={styles.drawerSection}>Account</Text>
      <DrawerItem
        label="Profile"
        focused={isFocused('Profile')}
        activeTintColor={colors.accent}
        inactiveTintColor={colors.primaryMuted}
        onPress={() =>
          closeAnd(() => {
            props.navigation.navigate('Profile');
          })
        }
      />

      <View style={styles.spacer} />
      <DrawerItem
        label={isSigningOut ? 'Signing out…' : 'Sign out'}
        style={isSigningOut ? styles.signOutRowBusy : undefined}
        accessibilityLabel={isSigningOut ? 'Signing out' : 'Sign out'}
        onPress={() => {
          if (isSigningOut) {
            return;
          }
          props.navigation.closeDrawer();
          void signOut();
        }}
        inactiveTintColor={colors.danger}
        labelStyle={styles.signOutLabel}
      />
    </DrawerContentScrollView>
  );
}

const AVATAR_SIZE = 56;
const RING = 2;

const styles = StyleSheet.create({
  drawer: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.lg },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarRing: {
    width: AVATAR_SIZE + RING * 2,
    height: AVATAR_SIZE + RING * 2,
    borderRadius: (AVATAR_SIZE + RING * 2) / 2,
    borderWidth: RING,
    borderColor: colors.accent,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  avatarLetter: {
    ...typography.title,
    color: colors.accent,
    fontSize: 22,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingTop: spacing.xs,
  },
  name: { ...typography.subtitle, color: colors.primary },
  rating: {
    ...typography.caption,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  ratingActive: { color: colors.primary },
  ratingMuted: { color: colors.primaryMuted, fontWeight: '500' },
  email: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.xs,
  },
  spacer: { flexGrow: 1, minHeight: spacing.md },
  signOutRowBusy: { opacity: 0.55 },
  signOutLabel: { fontWeight: '600' },
  drawerSection: {
    ...typography.caption,
    color: colors.primaryMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});
