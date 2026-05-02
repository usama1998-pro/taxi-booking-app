import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components';
import { spacing, typography } from '../../theme';

/** Live trip: driver ETA, route, contact. */
export function ActiveRideScreen() {
  return (
    <Screen style={styles.pad}>
      <Text style={typography.title}>Your ride</Text>
      <Text style={[typography.body, styles.hint]}>Tracking UI goes here.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  hint: { marginTop: spacing.sm, opacity: 0.7 },
});
