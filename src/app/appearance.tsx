import { reloadAppAsync } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius, spacing, THEME_ID, THEMES, tvFocus, type ThemeId } from '@/theme';
import { writeThemeId } from '@/theme/themeStore';

// Theme previews: background swatch and the theme's highlight colour.
const THEME_SWATCH: Record<ThemeId, { fill: string[]; stripes?: string[]; bands?: string[] }> = {
  lumen: { fill: ['#2B4A52', '#0B1417'] },
  barcaHome: { fill: ['#004D98', '#A50044'], stripes: ['#004D98', '#A50044'] },
  barcaNight: { fill: ['#16213F', '#070C1E'] },
  senyera: { fill: ['#FCDD09', '#DA121A'], bands: ['#FCDD09', '#DA121A'] },
};

/** Saves the theme and restarts the app, since colours are fixed when it starts. */
function applyTheme(id: ThemeId) {
  if (id === THEME_ID) return;
  writeThemeId(id);
  if (Platform.OS === 'web') window.location.reload();
  else reloadAppAsync().catch(() => {});
}

function ThemeCard({ id }: { id: ThemeId }) {
  const theme = THEMES[id];
  const swatch = THEME_SWATCH[id];
  const active = id === THEME_ID;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${theme.name} theme`}
      onPress={() => applyTheme(id)}
      style={({ pressed, focused }) => [styles.themeCard, active && styles.themeCardActive, pressed && { opacity: 0.85 }, tvFocus(focused)]}
    >
      <View style={styles.themeSwatch}>
        <LinearGradient colors={swatch.fill as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {swatch.bands && (
          <View style={styles.themeBands}>
            {Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: swatch.bands![i % 2] }} />
            ))}
          </View>
        )}
        {swatch.stripes && (
          <View style={styles.themeStripes}>
            {Array.from({ length: 12 }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: swatch.stripes![i % 2] }} />
            ))}
          </View>
        )}
        <View style={[styles.themeAccent, { backgroundColor: theme.colors.primary }]} />
        <View style={styles.themeTiles}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.themeTile} />
          ))}
        </View>
      </View>
      <View style={styles.themeFooter}>
        <Text style={styles.themeName} numberOfLines={1}>
          {theme.name}
        </Text>
        {active && (
          <View style={styles.themeBadge}>
            <Text style={styles.themeBadgeText}>ACTIVE</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Settings > Appearance: pick the app's theme. */
export default function AppearanceScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Theme</Text>
      <View style={styles.card}>
        <View style={styles.themes}>
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <ThemeCard key={id} id={id} />
          ))}
        </View>
        <Text style={[styles.hint, styles.themesHint]}>Changing the theme restarts the app. Your playlists and favorites stay the same.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, width: '100%', maxWidth: 900, alignSelf: 'center' },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.md },
  themeCard: { width: 190, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  themeCardActive: { borderWidth: 2, borderColor: colors.primary },
  themeSwatch: { height: 96, borderRadius: radius.md, overflow: 'hidden' },
  themeStripes: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  themeBands: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  themeAccent: { position: 'absolute', top: 10, left: 10, width: 44, height: 12, borderRadius: 6 },
  themeTiles: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', gap: 6 },
  themeTile: { flex: 1, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  themeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
  themeName: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  themeBadge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  themeBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
  themesHint: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
