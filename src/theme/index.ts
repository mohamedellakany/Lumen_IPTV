import { Platform } from 'react-native';

export const colors = {
  bg: '#0B0D12',
  surface: '#151821',
  surfaceAlt: '#1E2230',
  border: '#262B3A',
  text: '#F5F7FA',
  textDim: '#A3ABBD',
  textMuted: '#646C80',
  primary: '#4F7CFF',
  primaryDim: '#2A3F80',
  accent: '#FF4D6D',
  success: '#2BC48A',
  warning: '#F5A524',
  danger: '#F05252',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.textDim },
  tiny: { fontSize: 11, color: colors.textMuted },
};

const focusRing = {
  outlineWidth: 3,
  outlineColor: colors.text,
  outlineStyle: 'solid' as const,
  outlineOffset: 2,
};

/** Highlight for the element selected with a TV remote (Fire TV / Android TV D-pad). */
export function tvFocus(focused: boolean) {
  return focused && Platform.isTV ? focusRing : null;
}
