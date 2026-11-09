import { Ionicons } from '@expo/vector-icons';
import { View, type StyleProp, type TextStyle } from 'react-native';

import { SECTION_ICON_COMPONENTS, type SectionKey } from './SectionIcons';

/** An Ionicons icon, or one of the app's own section icons. */
export type GlyphName =
  | { family: 'ion'; name: keyof typeof Ionicons.glyphMap }
  /** The app's own outline icons for Live TV / Movies / Series. */
  | { family: 'section'; name: SectionKey; filled?: boolean };

export function Glyph({ icon, size, color, style }: { icon: GlyphName; size: number; color: string; style?: StyleProp<TextStyle> }) {
  if (icon.family === 'section') {
    // Line icons in small sizes: the selected tab gets the yellow accent, the others stay one colour.
    const Icon = SECTION_ICON_COMPONENTS[icon.name];
    return (
      <View style={style}>
        <Icon size={size} color={color} accent={icon.filled ? undefined : color} />
      </View>
    );
  }
  return <Ionicons name={icon.name} size={size} color={color} style={style} />;
}

const ion = (name: keyof typeof Ionicons.glyphMap): GlyphName => ({ family: 'ion', name });
const section = (name: SectionKey, filled = false): GlyphName => ({ family: 'section', name, filled });

/** Icons for the main sections, shared by the home cards, sidebar and tab bar: [outline, filled]. */
export const SECTION_ICONS: Record<string, [GlyphName, GlyphName]> = {
  home: [ion('home-outline'), ion('home')],
  live: [section('live'), section('live', true)],
  movies: [section('movies'), section('movies', true)],
  series: [section('series'), section('series', true)],
  favorites: [ion('heart-outline'), ion('heart')],
};
