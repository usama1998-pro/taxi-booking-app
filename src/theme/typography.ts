import { TextStyle } from 'react-native';

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700',
  } satisfies TextStyle,
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
  } satisfies TextStyle,
  caption: {
    fontSize: 14,
    fontWeight: '400',
  } satisfies TextStyle,
} as const;
