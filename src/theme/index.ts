import { Platform } from 'react-native';

export const colors = {
  bg: '#0B1417',
  surface: '#132126',
  surfaceAlt: '#1B2C32',
  border: '#26393F',
  text: '#F5F7FA',
  textDim: '#A7B6BA',
  textMuted: '#65777C',
  primary: '#FFC21A',
  /** Text and icons drawn on a `primary` (yellow) background. */
  onPrimary: '#14181C',
  primaryDim: 'rgba(255,194,26,0.16)',
  accent: '#FF4D6D',
  success: '#2BC48A',
  warning: '#F5A524',
  danger: '#F05252',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/**
 * App fonts, loaded at startup (see app/_layout.tsx): Exo 2 for Latin text and Cairo for Arabic,
 * which has no Exo 2 glyphs. Each weight is its own family; `Text` picks one from `fontWeight`.
 */
type FontWeight = '400' | '500' | '600' | '700' | '800';
const WEIGHT_NAMES: Record<FontWeight, string> = { '400': 'Regular', '500': 'Medium', '600': 'SemiBold', '700': 'Bold', '800': 'ExtraBold' };

function nearestWeight(weight: unknown): FontWeight {
  const n = weight === 'bold' ? 700 : Number(weight) || 400;
  if (n >= 800) return '800';
  if (n >= 700) return '700';
  if (n >= 600) return '600';
  if (n >= 500) return '500';
  return '400';
}

/** The loaded font family for a weight; `arabic` picks Cairo. */
export function fontFamily(weight?: unknown, arabic = false): string {
  const w = nearestWeight(weight);
  return `${arabic ? 'Cairo' : 'Exo2'}_${w}${WEIGHT_NAMES[w]}`;
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
export const hasArabic = (text: string) => ARABIC.test(text);

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
