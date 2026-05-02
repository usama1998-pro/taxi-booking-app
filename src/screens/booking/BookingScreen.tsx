import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components';
import { spacing, typography } from '../../theme';

/** Pickup / dropoff, vehicle type, schedule. */
export function BookingScreen() {
  return (
    <Screen style={styles.pad}>
      <Text style={typography.title}>New booking</Text>
      <Text style={[typography.body, styles.hint]}>Map and address search go here.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  hint: { marginTop: spacing.sm, opacity: 0.7 },
});
