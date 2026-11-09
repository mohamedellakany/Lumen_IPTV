import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Accent used by the outline section icons. */
export const ICON_ACCENT = '#FFD21F';

interface Props {
  size: number;
  /** Outline colour. */
  color?: string;
  /** The one highlighted detail (signal, lens, play button). */
  accent?: string;
}

// Thin round lines like a modern TV launcher; small sizes (sidebar, tab bar) get a heavier line so
// they don't fade out.
const weight = (size: number) => (size < 36 ? 4.2 : 2.8);
const line = (color: string, width: number) =>
  ({ stroke: color, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;

/** Live TV: a TV set with antennas and a signal pulse on screen. */
export function LiveTvIcon({ size, color = '#fff', accent = ICON_ACCENT }: Props) {
  const w = weight(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M23 7 L32 15 L41 7" {...line(color, w)} />
      <Rect x={6} y={15} width={52} height={38} rx={13} {...line(color, w)} />
      <Path d="M16 34 H23 L27 27 L33 41 L37 34 H48" {...line(accent, w + 0.4)} />
      <Path d="M24 58 H40" {...line(color, w)} />
    </Svg>
  );
}

/** Movies: a film camera with two reels and a highlighted lens. */
export function MoviesIcon({ size, color = '#fff', accent = ICON_ACCENT }: Props) {
  const w = weight(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={19} cy={15} r={8.5} {...line(color, w)} />
      <Circle cx={38} cy={15} r={8.5} {...line(color, w)} />
      <Rect x={6} y={26} width={40} height={27} rx={9} {...line(color, w)} />
      <Path d="M46 34 L56 28.5 Q58 27.5 58 30 V49 Q58 51.5 56 50.5 L46 45" {...line(color, w)} />
      <Rect x={15} y={33} width={14} height={13} rx={4} {...line(accent, w + 0.4)} />
      <Path d="M19 59 L23 53 M33 59 L29 53" {...line(color, w)} />
    </Svg>
  );
}

/** Series: stacked episode cards with a play button. */
export function SeriesIcon({ size, color = '#fff', accent = ICON_ACCENT }: Props) {
  const w = weight(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M16 8 H48" {...line(color, w)} />
      <Path d="M11 15.5 H53" {...line(color, w)} />
      <Rect x={6} y={23} width={52} height={35} rx={13} {...line(color, w)} />
      <Path d="M27.5 32.5 Q26 31.6 26 33.4 V47.6 Q26 49.4 27.5 48.5 L39.5 41.6 Q41 40.6 39.5 39.6 Z" {...line(accent, w + 0.4)} />
    </Svg>
  );
}

export const SECTION_ICON_COMPONENTS = { live: LiveTvIcon, movies: MoviesIcon, series: SeriesIcon } as const;
export type SectionKey = keyof typeof SECTION_ICON_COMPONENTS;
