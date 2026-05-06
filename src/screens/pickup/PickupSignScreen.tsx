import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPickupSignBrandLines } from '../../navigation/driverChrome';
import type { PickupSignParams } from '../../navigation/types';

type Props = NativeStackScreenProps<{ PickupSign: PickupSignParams }, 'PickupSign'>;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Reference layout: landscape-only, small top-centre brand (plane + two lines),
 * thin X top-right, large horizontal passenger name centred below.
 */
export function PickupSignScreen({ route }: Props) {
  const navigation = useNavigation();
  const { customerName } = route.params;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const nameRaw = customerName.trim() || '—';
  const { headline: brandHeadline, tagline: brandTagline } = useMemo(
    () => getPickupSignBrandLines(),
    [],
  );

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

  const longSide = Math.max(W, H);
  const shortSide = Math.min(W, H);
  const tabletLike = shortSide >= 520;

  const pad = clamp(Math.round(shortSide * 0.02), 10, 24);

  /** Header band: logo + close — keep modest vs reference. */
  const headerReserve = clamp(Math.round(shortSide * 0.11), 56, 82);

  const usableNameHeight =
    H - insets.top - insets.bottom - headerReserve - Math.round(pad * 2.5);

  const usableNameWidth = W - insets.left - insets.right - pad * 2;

  const maxNameFont = tabletLike ? 128 : 90;
  const minNameFont = 34;

  const heightDriven = usableNameHeight * 0.48;
  const widthDriven = longSide * 0.1;
  const nameFontSize = clamp(
    Math.round(Math.min(heightDriven, widthDriven)),
    minNameFont,
    maxNameFont,
  );

  /** Reference: fairly tight tracking on the large name. */
  const nameLetterSpacing = clamp(Math.round(nameFontSize * 0.012), 0, 3);

  const brandIconSize = clamp(Math.round(shortSide * 0.048), 24, 36);
  const brandHeadlineSize = clamp(Math.round(16 + shortSide * 0.012), 17, 24);
  const brandTaglineSize = clamp(brandHeadlineSize - 4, 13, 18);
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
              color="#8B4513"
              style={styles.brandIcon}
            />
            <View style={styles.brandTextCol}>
              <Text
                style={[styles.brandHeadline, { fontSize: brandHeadlineSize }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {brandHeadline}
              </Text>
              {brandTagline ? (
                <Text
                  style={[styles.brandTagline, { fontSize: brandTaglineSize }]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {brandTagline}
                </Text>
              ) : null}
            </View>
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
              maxWidth: usableNameWidth,
            },
          ]}
          adjustsFontSizeToFit
          minimumFontScale={0.15}
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
    marginRight: 12,
  },
  brandTextCol: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  /** Reference: top line bold black (“TAXI”). */
  brandHeadline: {
    color: '#000000',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  /** Reference: second line smaller, reddish-brown (“BARCELONAS”). */
  brandTagline: {
    marginTop: 1,
    color: '#8B4513',
    fontWeight: '600',
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
