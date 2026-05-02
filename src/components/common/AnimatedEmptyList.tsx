import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../../theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type AnimatedEmptyListProps = {
  message: string;
  icon: IoniconsName;
  /** Icon size in dp (glyph; hit area is padded for comfortable centering) */
  size?: number;
  iconColor?: string;
  /** Merged into the outer wrapper (e.g. tighter padding inside a card) */
  contentStyle?: ViewStyle;
};

/**
 * Empty list placeholder: icon with a gentle scale pulse so lists feel less static.
 */
export function AnimatedEmptyList({
  message,
  icon,
  size = 88,
  iconColor = colors.primaryMuted,
  contentStyle,
}: AnimatedEmptyListProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [scale]);

  return (
    <View style={[styles.wrap, contentStyle]} accessibilityRole="text" accessibilityLabel={message}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={icon} size={size} color={iconColor} />
      </Animated.View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  message: {
    ...typography.body,
    color: colors.primaryMuted,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: spacing.lg,
    maxWidth: 320,
    width: '100%',
  },
});
