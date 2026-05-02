export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  primary: '#111827',
  primaryMuted: '#6B7280',
  accent: '#2563EB',
  border: '#E5E7EB',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

export type ColorName = keyof typeof colors;
