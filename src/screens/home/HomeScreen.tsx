import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ViatorBookingDetailModal } from '../../components/viator/ViatorBookingDetailModal';
import { ViatorNotificationBanner } from '../../components/viator/ViatorNotificationBanner';
import { useAuth } from '../../context/AuthContext';
import { useViatorNotifications } from '../../hooks/useViatorNotifications';
import {
  ensureNotificationPermissions,
  notifyNewViatorBooking,
} from '../../services/notifications/viatorLocalNotifications';
import type { ViatorBookingInfo } from '../../lib/formatViatorBooking';
import { viatorNotificationsApi } from '../../services/viator/viatorNotificationsApi';
import { brandBlue, brandDisplayName } from '../../navigation/driverChrome';
import { getDriverRootNavigation } from '../../navigation/getDriverRootNavigation';
import { spacing, typography } from '../../theme';

type MenuItem = {
  label: string;
  onPress: () => void;
};

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const homeStackNav = useNavigation();
  const rootNav = getDriverRootNavigation(homeStackNav);
  const { signOut, isSigningOut, accessToken } = useAuth();
  const {
    unread: viatorUnread,
    dismiss: dismissViator,
    dismissAll: dismissAllViator,
    refresh: refreshViator,
  } = useViatorNotifications();
  const [viatorTestLoading, setViatorTestLoading] = useState(false);
  const [viatorDetailModal, setViatorDetailModal] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const testLatestViatorMail = async () => {
    if (!accessToken) {
      Alert.alert('Sign in required', 'Log in to test Viator mail.');
      return;
    }
    setViatorTestLoading(true);
    try {
      const permitted = await ensureNotificationPermissions();
      const latest = await viatorNotificationsApi.fetchLatest(accessToken);
      if (!latest.found) {
        Alert.alert('Viator mail test', latest.message ?? 'No Viator booking email found.');
        return;
      }
      let pushSent = false;
      if (latest.viatorReference && latest.pickupDateLabel) {
        pushSent = await notifyNewViatorBooking({
          ...latest,
          viatorReference: latest.viatorReference,
          pickupDateLabel: latest.pickupDateLabel,
        });
      }
      const footer: string[] = [];
      if (latest.savedToDb) {
        footer.push(
          'Saved to database — open Bookings → Upcoming to see it.',
        );
      } else if (latest.alreadyInDatabase) {
        footer.push(
          'Already saved (same reference) — see Bookings → Upcoming.',
        );
      } else if (latest.message?.includes('could not save')) {
        footer.push(latest.message);
      } else {
        footer.push(
          'Could not confirm database save — check backend logs and try again.',
        );
      }
      if (!permitted) {
        footer.push(
          'Notifications are off — enable them in Android Settings → Apps → Taxi Barcelona 24 → Notifications.',
        );
      } else if (pushSent) {
        footer.push('Check your notification tray — a push alert was sent.');
      } else {
        footer.push(
          'Could not show push alert. Rebuild the app (npx expo run:android).',
        );
      }
      setViatorDetailModal({
        title: 'Latest Viator booking email',
        info: latest,
        footerLines: footer,
      });
      // IMAP sync can take several seconds — do not block the button/modal UI.
      void viatorNotificationsApi
        .syncInbox(accessToken)
        .then(() => refreshViator())
        .catch(() => undefined);
    } catch (e) {
      Alert.alert(
        'Viator mail test failed',
        e instanceof Error ? e.message : 'Could not read Hostinger inbox.',
      );
    } finally {
      setViatorTestLoading(false);
    }
  };

  const items: MenuItem[] = [
    {
      label: 'NEW RESERVATION',
      onPress: () => rootNav?.navigate('Bookings', { screen: 'NewReservation' }),
    },
    {
      label: 'MY RESERVATIONS',
      onPress: () => rootNav?.navigate('Bookings', { screen: 'BookingsList' }),
    },
    {
      label: 'GENERATE INVOICE',
      onPress: () =>
        rootNav?.navigate('Invoices', {
          screen: 'InvoiceCreate',
          params: {},
        }),
    },
  ];

  return (
    <View style={styles.root}>
      <ViatorBookingDetailModal
        visible={viatorDetailModal != null}
        title={viatorDetailModal?.title ?? ''}
        info={viatorDetailModal?.info ?? { found: false }}
        footerLines={viatorDetailModal?.footerLines}
        onClose={() => setViatorDetailModal(null)}
      />
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle} accessibilityRole="header">
          taxibarcelonas
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSigningOut ? 'Signing out' : 'Sign out'}
            disabled={isSigningOut}
            onPress={() => void signOut()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && !isSigningOut && styles.signOutPressed,
              isSigningOut && styles.signOutDisabled,
            ]}
          >
            <Ionicons name="power-outline" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ViatorNotificationBanner
          notifications={viatorUnread}
          onDismiss={dismissViator}
          onDismissAll={dismissAllViator}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test latest Viator booking email"
          disabled={viatorTestLoading}
          onPress={() => void testLatestViatorMail()}
          style={({ pressed }) => [
            styles.testViatorBtn,
            pressed && !viatorTestLoading && styles.menuButtonPressed,
            viatorTestLoading && styles.testViatorBtnDisabled,
          ]}
        >
          {viatorTestLoading ? (
            <ActivityIndicator color={brandBlue} />
          ) : (
            <Text style={styles.testViatorBtnText}>TEST VIATOR MAIL</Text>
          )}
        </Pressable>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.menuButtonPressed,
            ]}
          >
            <Text style={styles.menuButtonText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brandBlue,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerSide: {
    width: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  signOutBtn: {
    padding: spacing.xs,
    borderRadius: 8,
  },
  signOutPressed: {
    opacity: 0.85,
  },
  signOutDisabled: {
    opacity: 0.45,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  testViatorBtn: {
    borderWidth: 1,
    borderColor: '#90CAF9',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  testViatorBtnDisabled: {
    opacity: 0.6,
  },
  testViatorBtnText: {
    ...typography.caption,
    color: '#1565C0',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  menuButton: {
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: spacing.md + 4,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonPressed: {
    opacity: 0.92,
    backgroundColor: 'rgba(30, 136, 229, 0.06)',
  },
  menuButtonText: {
    ...typography.subtitle,
    color: brandBlue,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 15,
  },
});
