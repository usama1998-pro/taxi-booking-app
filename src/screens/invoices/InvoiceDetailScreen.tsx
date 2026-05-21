import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import {
  formatInvoiceEndpoint,
  formatInvoiceMoney,
} from '../../lib/invoiceFormat';
import { downloadInvoicePdf } from '../../lib/invoicePdfDownload';
import { getAppUiMessage } from '../../lib/apiErrors';
import { logger } from '../../lib/logger';
import { phoneForDisplay } from '../../lib/phoneFormat';
import type { InvoicesStackParamList } from '../../navigation/types';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { DriverInvoice } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

type Route = RouteProp<InvoicesStackParamList, 'InvoiceDetail'>;

export function InvoiceDetailScreen() {
  const route = useRoute<Route>();
  const { id } = route.params;
  const { accessToken } = useAuth();
  const [inv, setInv] = useState<DriverInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const row = await invoicesApi.getById(accessToken, id);
      setInv(row);
    } catch (e) {
      logger.warn('InvoiceDetailScreen: load failed', e);
      setError(getAppUiMessage(e, 'Could not load invoice. Please try again.'));
      setInv(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  if (error || !inv) {
    return (
      <Screen style={styles.pad}>
        <Text style={styles.error}>{error ?? 'Invoice not found.'}</Text>
      </Screen>
    );
  }

  const pickup = formatInvoiceEndpoint(
    inv.pickupKind,
    inv.pickupAddress,
    inv.pickupAirline,
    inv.pickupFlightNo,
  );
  const dropoff = formatInvoiceEndpoint(
    inv.dropoffKind,
    inv.dropoffAddress,
    inv.dropoffAirline,
    inv.dropoffFlightNo,
  );
  const pickupLabel =
    inv.pickupKind === 'LOCATION' ? 'Pick-up address' : 'Pick-up (airport)';
  const dropLabel =
    inv.dropoffKind === 'LOCATION' ? 'Drop-off address' : 'Drop-off (airport)';
  const pickupDate = new Date(inv.pickupDate);
  const pickupDateStr = Number.isNaN(pickupDate.getTime())
    ? inv.pickupDate
    : pickupDate.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const onDownloadPdf = async () => {
    if (!accessToken) {
      Alert.alert('Not signed in', 'Sign in again to download the PDF.');
      return;
    }
    setPdfBusy(true);
    try {
      const msg = await downloadInvoicePdf(accessToken, inv.id);
      if (msg) {
        Alert.alert('PDF saved', msg);
      }
    } catch (e) {
      logger.warn('InvoiceDetailScreen: PDF failed', e);
      Alert.alert('PDF failed', getAppUiMessage(e, 'Could not save the PDF. Please try again.'));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{inv.fullName}</Text>
        <Text style={styles.sub}>{inv.bookingReference}</Text>

        <Pressable
          style={[styles.pdfBtn, pdfBusy && styles.pdfBtnDisabled]}
          onPress={() => void onDownloadPdf()}
          disabled={pdfBusy}
        >
          {pdfBusy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.pdfBtnText}>Download PDF</Text>
          )}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Row label="Phone" value={phoneForDisplay(inv.phoneNumber)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip</Text>
          <Row label="Pick-up date" value={pickupDateStr} />
          <Row label={pickupLabel} value={pickup} />
          <Row label={dropLabel} value={dropoff} />
          {inv.childSeatsSummary?.trim() ? (
            <Row label="Child seats" value={inv.childSeatsSummary.trim()} />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Amounts</Text>
          <Row label="Subtotal" value={formatInvoiceMoney(inv.priceAmount)} />
          <Row label="Tax (10%)" value={formatInvoiceMoney(inv.taxAmount)} />
          <Row label="Total" value={formatInvoiceMoney(inv.totalAmount)} />
        </View>

        {inv.sourceBookingUuid ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Booking link</Text>
            <Text style={styles.muted}>
              This invoice is tied to an assigned trip (same booking reference as in your bookings
              list).
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record</Text>
          <Row label="Invoice id" value={inv.id} />
          <Row
            label="Created"
            value={new Date(inv.createdAt).toLocaleString('en-GB')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.title, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.primaryMuted, marginBottom: spacing.md },
  pdfBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pdfBtnDisabled: { opacity: 0.65 },
  pdfBtnText: { ...typography.subtitle, color: colors.background },
  muted: { ...typography.body, color: colors.primaryMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.caption, color: colors.primaryMuted, flexShrink: 0, paddingTop: 2 },
  rowValue: {
    ...typography.body,
    color: colors.primary,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
  },
  error: { ...typography.body, color: colors.danger },
});
