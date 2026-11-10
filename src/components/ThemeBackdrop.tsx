import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { shade, THEME } from '@/theme';

const STRIPE = 90;
const BLUE = 'rgba(0,77,152,0.55)';
const GARNET = 'rgba(165,0,68,0.5)';

const GOLD = 'rgba(252,221,9,0.75)';
const RED = 'rgba(218,18,26,0.8)';
// Soft light/dark vertical bands that make flat stripes look like waving cloth.
const FOLDS = ['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.06)'] as const;

/**
 * The theme's background pattern, drawn behind a screen's content (place it first inside the screen).
 * Barcelona Home: blue/garnet stripes with a soft gold glow at the top.
 * Senyera: the Catalan flag's nine gold/red bands with cloth folds.
 * Both are darkened so text stays readable; other themes have no pattern and render nothing.
 */
export function ThemeBackdrop() {
  if (THEME.pattern === 'senyera') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.bands}>
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={[styles.band, { backgroundColor: i % 2 ? RED : GOLD }]} />
          ))}
        </View>
        <LinearGradient colors={FOLDS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.15 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[shade(0.55), shade(0.8), shade(0.92)]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
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
  bands: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  band: { flex: 1 },
});
