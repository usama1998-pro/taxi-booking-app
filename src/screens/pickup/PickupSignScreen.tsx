import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brandBlue, getPickupSignBrandLines } from '../../navigation/driverChrome';
import type { PickupSignParams } from '../../navigation/types';

type Props = NativeStackScreenProps<{ PickupSign: PickupSignParams }, 'PickupSign'>;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Bold pickup-sign glyphs are ~0.42–0.48× font size wide on average. */
const BOLD_CHAR_WIDTH_RATIO = 0.44;

function computePickupSignNameFontSize(
  name: string,
  usableWidth: number,
  usableHeight: number,
  tabletLike: boolean,
): number {
  const minFont = 26;
  const maxFont = tabletLike ? 260 : 210;
  const trimmed = name.trim() || '—';
  const charCount = Math.max(trimmed.length, 1);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const widthCap = (usableWidth * 0.98) / (charCount * BOLD_CHAR_WIDTH_RATIO);

  const heightRatio =
    wordCount <= 1 ? 0.86 : wordCount === 2 ? 0.8 : wordCount === 3 ? 0.72 : 0.62;
  const heightCap = usableHeight * heightRatio;

  return clamp(Math.round(Math.min(widthCap, heightCap)), minFont, maxFont);
}

/**
 * Reference layout: landscape-only, single-line blue brand at top,
 * thin X top-right, large horizontal passenger name centred below.
 */
export function PickupSignScreen({ route }: Props) {
  const navigation = useNavigation();
  const { customerName } = route.params;
  useKeepAwake();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const nameRaw = customerName.trim() || '—';
  const brandLabel = useMemo(() => {
    const { headline, tagline } = getPickupSignBrandLines();
    return tagline ? `${headline} ${tagline}` : headline;
  }, []);

  /** This screen is always used in landscape (locked on focus). */
  useFocusEffect(
    useCallback(() => {
      const lock = async () => {
        try {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE,
          );
        } catch {
          // Ignore: simulators / web / policy restrictions
        }
      };
      void lock();
      return () => {
        const unlock = async () => {
          try {
            await ScreenOrientation.unlockAsync();
          } catch {
            // ignore
          }
        };
        void unlock();
      };
    }, []),
  );

  const shortSide = Math.min(W, H);
  const tabletLike = shortSide >= 520;

  const pad = clamp(Math.round(shortSide * 0.02), 10, 24);

  /** Header band: logo + close — keep modest so the name can dominate. */
  const headerReserve = clamp(Math.round(shortSide * 0.09), 48, 72);

  const usableNameHeight =
    H - insets.top - insets.bottom - headerReserve - Math.round(pad * 2);

  const usableNameWidth = W - insets.left - insets.right - pad * 2;

  const nameFontSize = computePickupSignNameFontSize(
    nameRaw,
    usableNameWidth,
    usableNameHeight,
    tabletLike,
  );

  /** Reference: fairly tight tracking on the large name. */
  const nameLetterSpacing = clamp(Math.round(nameFontSize * 0.012), 0, 3);

  const brandIconSize = clamp(Math.round(shortSide * 0.048), 24, 36);
  const brandTitleSize = clamp(Math.round(17 + shortSide * 0.014), 18, 26);
  const closeIconSize = clamp(Math.round(30 + shortSide * 0.012), 32, 40);

  const headerGutter = clamp(Math.round(shortSide * 0.065), 48, 64);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + pad * 0.25,
          paddingBottom: insets.bottom + pad,
          paddingLeft: insets.left + pad,
          paddingRight: insets.right + pad,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.headerRow}>
        <View style={[styles.headerGutter, { width: headerGutter }]} />
        <View style={styles.brandCenter}>
          <View style={styles.brandRow}>
            <Ionicons
              name="airplane"
              size={brandIconSize}
              color={brandBlue}
              style={styles.brandIcon}
            />
            <Text
              style={[styles.brandTitle, { fontSize: brandTitleSize }]}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {brandLabel}
            </Text>
          </View>
        </View>
        <View style={[styles.headerGutter, styles.headerGutterRight, { width: headerGutter }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={16}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <Ionicons name="close-outline" size={closeIconSize} color="#1a1a1a" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.nameArea, { maxWidth: usableNameWidth }]}>
        <Text
          style={[
            styles.customerName,
            {
              fontSize: nameFontSize,
              letterSpacing: nameLetterSpacing,
              width: usableNameWidth,
              maxWidth: usableNameWidth,
            },
          ]}
          adjustsFontSizeToFit
          minimumFontScale={0.2}
          maxFontSizeMultiplier={1}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {nameRaw}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    marginBottom: 4,
    minHeight: 52,
  },
  headerGutter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGutterRight: {
    alignItems: 'flex-end',
  },
  brandCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    marginRight: 10,
  },
  brandTitle: {
    color: brandBlue,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  closeBtn: {
    padding: 2,
  },
  closeBtnPressed: {
    opacity: 0.5,
  },
  nameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  customerName: {
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
