import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  AUTH_HERO_CROSSFADE_MS,
  AUTH_HERO_SLIDE_INTERVAL_MS,
  AUTH_HERO_SLIDES,
} from '../../constants/authHeroSlides';
import { spacing } from '../../theme';

type AuthScreenLayoutProps = {
  children: ReactNode;
};

/**
 * Full-screen hero carousel (crossfading images) + navy overlay like the web home hero,
 * centered form card on top.
 */
export function AuthScreenLayout({ children }: AuthScreenLayoutProps) {
  const slideCount = AUTH_HERO_SLIDES.length;
  const opacities = useRef(
    AUTH_HERO_SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)),
  ).current;
  const activeRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const prev = activeRef.current;
      const next = (prev + 1) % slideCount;
      activeRef.current = next;
      Animated.parallel(
        AUTH_HERO_SLIDES.map((_, i) =>
          Animated.timing(opacities[i], {
            toValue: i === next ? 1 : 0,
            duration: AUTH_HERO_CROSSFADE_MS,
            useNativeDriver: true,
          }),
        ),
      ).start();
    }, AUTH_HERO_SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [opacities, slideCount]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {AUTH_HERO_SLIDES.map((src, i) => (
          <Animated.View key={i} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
            <Image source={src} style={styles.heroImage} contentFit="cover" transition={200} />
          </Animated.View>
        ))}
        <LinearGradient
          colors={[
            'rgba(16, 34, 59, 0.9)',
            'rgba(16, 34, 59, 0.78)',
            'rgba(16, 34, 59, 0.58)',
            'rgba(16, 34, 59, 0.38)',
          ]}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1f33' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: spacing.lg + 4,
    borderWidth: 1,
    borderColor: 'rgba(15, 34, 61, 0.08)',
    shadowColor: '#091831',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
});
