import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

/** An icon from either bundled set: Ionicons, or Material Design Icons ("mci"). */
export type GlyphName =
  | { family: 'ion'; name: keyof typeof Ionicons.glyphMap }
  | { family: 'mci'; name: keyof typeof MaterialCommunityIcons.glyphMap };

export function Glyph({ icon, size, color, style }: { icon: GlyphName; size: number; color: string; style?: StyleProp<TextStyle> }) {
  return icon.family === 'mci' ? (
    <MaterialCommunityIcons name={icon.name} size={size} color={color} style={style} />
  ) : (
    <Ionicons name={icon.name} size={size} color={color} style={style} />
  );
}

const ion = (name: keyof typeof Ionicons.glyphMap): GlyphName => ({ family: 'ion', name });
const mci = (name: keyof typeof MaterialCommunityIcons.glyphMap): GlyphName => ({ family: 'mci', name });

/** Icons for the main sections, shared by the home cards, sidebar and tab bar: [outline, filled]. */
export const SECTION_ICONS: Record<string, [GlyphName, GlyphName]> = {
  home: [ion('home-outline'), ion('home')],
  live: [mci('television-play'), mci('television-play')],
  movies: [mci('movie-open-play-outline'), mci('movie-open-play')],
  series: [mci('play-box-multiple-outline'), mci('play-box-multiple')],
  favorites: [ion('heart-outline'), ion('heart')],
};
