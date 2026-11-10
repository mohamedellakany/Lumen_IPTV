import { Platform } from 'react-native';

import { readThemeId } from './themeStore';

export type ThemeId = 'lumen' | 'barcaHome' | 'barcaNight';

interface Palette {
  bg: string;
  /** The background colour as "r,g,b", for fades: `rgba(${bgRgb},0.8)`. */
  bgRgb: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  sidebar: string;
  sheet: string;
  text: string;
  textDim: string;
  textMuted: string;
  primary: string;
  /** Text and icons drawn on a `primary` background. */
  onPrimary: string;
  primaryDim: string;
  /** Home section cards: glass gradient (3 stops), fill and edge. */
  cardGlass: [string, string, string];
  cardFill: string;
  cardBorder: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}

const base = { accent: '#FF4D6D', success: '#2BC48A', warning: '#F5A524', danger: '#F05252', overlay: 'rgba(0,0,0,0.6)', text: '#F5F7FA' };

export const THEMES: Record<ThemeId, { name: string; pattern: 'none' | 'stripes'; colors: Palette }> = {
  lumen: {
    name: 'Lumen',
    pattern: 'none',
    colors: {
      ...base,
      bg: '#0B1417',
      bgRgb: '11,20,23',
      surface: '#132126',
      surfaceAlt: '#1B2C32',
      border: '#26393F',
      sidebar: '#081216',
      sheet: '#11222A',
      textDim: '#A7B6BA',
      textMuted: '#65777C',
      primary: '#FFC21A',
      onPrimary: '#14181C',
      primaryDim: 'rgba(255,194,26,0.16)',
      cardGlass: ['rgba(140,190,200,0.26)', 'rgba(90,140,150,0.16)', 'rgba(70,120,130,0.12)'],
      cardFill: 'rgba(18,34,40,0.62)',
      cardBorder: 'rgba(255,255,255,0.14)',
    },
  },
  // Club colours: blue #004D98, garnet #A50044, gold #EDBB00. Stripes are drawn behind the screens.
  barcaHome: {
    name: 'Barcelona Home',
    pattern: 'stripes',
    colors: {
      ...base,
      bg: '#08112A',
      bgRgb: '8,17,42',
      surface: '#101E44',
      surfaceAlt: '#182A57',
      border: '#2A3B6B',
      sidebar: 'rgba(4,10,28,0.85)',
      sheet: '#0F1B3E',
      textDim: '#B3BEDB',
      textMuted: '#6E7BA0',
      primary: '#EDBB00',
      onPrimary: '#0A1630',
      primaryDim: 'rgba(165,0,68,0.45)',
      cardGlass: ['rgba(0,77,152,0.55)', 'rgba(60,30,110,0.40)', 'rgba(165,0,68,0.42)'],
      cardFill: 'rgba(8,17,42,0.55)',
      cardBorder: 'rgba(237,187,0,0.30)',
    },
  },
  barcaNight: {
    name: 'Barcelona Night',
    pattern: 'none',
    colors: {
      ...base,
      bg: '#070C1E',
      bgRgb: '7,12,30',
      surface: '#0E1730',
      surfaceAlt: '#16213F',
      border: '#25315A',
      sidebar: '#050A1A',
      sheet: '#0D1630',
      textDim: '#AEB8D6',
      textMuted: '#69749A',
      primary: '#EDBB00',
      onPrimary: '#0A1630',
      primaryDim: 'rgba(0,77,152,0.40)',
      cardGlass: ['rgba(0,77,152,0.30)', 'rgba(20,26,60,0.30)', 'rgba(165,0,68,0.28)'],
      cardFill: 'rgba(10,17,40,0.85)',
      cardBorder: 'rgba(165,0,68,0.55)',
    },
  },
};

const stored = readThemeId();
/** The theme chosen in Settings (applied at startup; changing it restarts the app). */
export const THEME_ID: ThemeId = stored && stored in THEMES ? (stored as ThemeId) : 'lumen';
export const THEME = THEMES[THEME_ID];
export const colors = THEME.colors;
/** The theme background colour with transparency, for fades over pictures. */
export const shade = (alpha: number) => `rgba(${colors.bgRgb},${alpha})`;

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
