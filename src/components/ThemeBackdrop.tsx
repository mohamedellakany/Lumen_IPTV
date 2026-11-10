import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { shade, THEME } from '@/theme';

const STRIPE = 90;
const BLUE = 'rgba(0,77,152,0.55)';
const GARNET = 'rgba(165,0,68,0.5)';

/**
 * The theme's background pattern, drawn behind a screen's content (place it first inside the screen).
 * Barcelona Home: blue/garnet stripes, darkened so text stays readable, with a soft gold glow at the top.
 * Other themes have no pattern and render nothing.
 */
export function ThemeBackdrop() {
  if (THEME.pattern !== 'stripes') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.stripes}>
        {Array.from({ length: 30 }, (_, i) => (
          <View key={i} style={[styles.stripe, { backgroundColor: i % 2 ? GARNET : BLUE }]} />
        ))}
      </View>
      <LinearGradient colors={[shade(0.4), shade(0.68), shade(0.86)]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(237,187,0,0.14)', 'rgba(237,187,0,0)']} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  stripes: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', overflow: 'hidden' },
  stripe: { width: STRIPE, height: '100%' },
});
