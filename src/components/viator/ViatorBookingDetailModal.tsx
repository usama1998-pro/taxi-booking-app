import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildViatorBookingDetailRows,
  type ViatorBookingInfo,
} from '../../lib/formatViatorBooking';
import { spacing, typography } from '../../theme';

type Props = {
  visible: boolean;
  title: string;
  info: ViatorBookingInfo;
  footerLines?: string[];
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function ViatorBookingDetailModal({
  visible,
  title,
  info,
  footerLines = [],
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const rows = buildViatorBookingDetailRows(info, footerLines);
  const sheetMaxHeight = Math.min(windowHeight * 0.88, windowHeight - insets.top - 24);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              maxHeight: sheetMaxHeight,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {rows.length === 0 ? (
              <Text style={styles.empty}>No booking details available.</Text>
            ) : (
              rows.map((row, index) => (
                <DetailRow
                  key={`${row.label}-${index}`}
                  label={row.label}
                  value={row.value}
                />
              ))
            )}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    flexShrink: 0,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: spacing.sm,
  },
  rowLabel: {
    width: 108,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '700',
    color: '#424242',
    lineHeight: 18,
  },
  rowValue: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#111111',
    lineHeight: 20,
  },
  empty: {
    ...typography.body,
    color: '#616161',
    paddingVertical: spacing.md,
  },
  closeBtn: {
    marginTop: spacing.sm,
    backgroundColor: '#1E88E5',
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    flexShrink: 0,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.9,
  },
});
