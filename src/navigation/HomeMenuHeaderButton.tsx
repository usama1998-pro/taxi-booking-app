import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme';
import { getDriverRootNavigation } from './getDriverRootNavigation';

/**
 * Returns to the main menu (`Home` root screen). Use on nested stack roots that replaced the drawer toggle.
 */
export function HomeMenuHeaderButton() {
  const navigation = useNavigation();
  const root = getDriverRootNavigation(navigation);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to main menu"
      hitSlop={12}
      onPress={() => root?.navigate('Home')}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <Ionicons name="home-outline" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
