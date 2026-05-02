import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PickupSignParams } from '../../navigation/types';

type Props = NativeStackScreenProps<{ PickupSign: PickupSignParams }, 'PickupSign'>;

/** Vertical step per rotated glyph (~cap width). */
const VERTICAL_ADVANCE = 0.54;
/**
 * How much vertical space a space (word gap) uses vs one letter row — keeps first / middle / last names separated.
 */
const SPACE_ROW_UNITS = 0.58;

function layoutUnits(chars: string[]): number {
  let u = 0;
  for (const c of chars) {
    if (c === ' ' || c === '\n') {
      u += SPACE_ROW_UNITS;
    } else {
      u += 1;
    }
  }
  return Math.max(u, 1);
}

/**
 * Pickup sign: full customer name as given (including spaces between words); each letter +90°;
 * spaces add a visible vertical gap between name parts.
 */
export function PickupSignScreen({ route }: Props) {
  const { customerName } = route.params;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const raw = customerName.trim() || '—';
  const chars = useMemo(() => Array.from(raw), [raw]);
  const units = useMemo(() => layoutUnits(chars), [chars]);

  const pad = Math.max(16, Math.round(Math.min(W, H) * 0.028));
  const usableH = H - insets.top - insets.bottom - pad * 2;

  const fontSize = Math.min(
    260,
    Math.max(46, Math.floor(usableH / (units * VERTICAL_ADVANCE))),
  );
  const rowH = Math.max(1, Math.ceil(fontSize * VERTICAL_ADVANCE));
  const spaceH = Math.max(8, Math.ceil(rowH * SPACE_ROW_UNITS));
  const box = fontSize;

  let totalH = 0;
  for (const c of chars) {
    totalH += c === ' ' || c === '\n' ? spaceH : rowH;
  }

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + pad,
          paddingRight: insets.right + pad,
        },
      ]}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={totalH > usableH + 2}
      >
        <View style={styles.column}>
          {chars.map((ch, i) =>
            ch === ' ' || ch === '\n' ? (
              <View key={`sp-${i}`} style={[styles.spaceSlot, { height: spaceH, width: box }]} />
            ) : (
              <View
                key={`${i}-${ch}`}
                style={[styles.cell, { height: rowH, width: box }]}
              >
                <Text
                  style={[
                    styles.glyph,
                    {
                      fontSize,
                      width: box,
                      height: box,
                      lineHeight: fontSize,
                      transform: [{ rotate: '90deg' }],
                      ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : {}),
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {ch}
                </Text>
              </View>
            ),
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  column: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  spaceSlot: {
    width: 0,
    flexShrink: 0,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    margin: 0,
    padding: 0,
  },
  glyph: {
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0,
    overflow: 'visible',
    margin: 0,
    padding: 0,
    includeFontPadding: false,
  },
});
