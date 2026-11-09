import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

const logo = require('../../assets/logo.png');

/** The app's logo tile (same artwork as the launcher icon). */
export function BrandLogo({ size, style }: { size: number; style?: StyleProp<ImageStyle> }) {
  // Bundled image: no disk cache, otherwise Android keeps showing an old logo after an app update
  // (the bundled resource keeps the same name between versions).
  return (
    <Image source={logo} style={[{ width: size, height: size }, style]} contentFit="contain" cachePolicy="memory" accessibilityLabel="Lumen" />
  );
}
