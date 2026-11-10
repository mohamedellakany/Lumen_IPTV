import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing, shade } from '@/theme';
import { Artwork } from './Artwork';
import { Text } from '@/components/Text';

interface Props {
  title: string;
  poster?: string;
  backdrop?: string;
  meta: (string | undefined | false)[];
  rating?: number;
  genre?: string;
  children?: ReactNode;
}

/** Backdrop + poster + title block shared by movie and series detail screens. */
export function DetailHero({ title, poster, backdrop, meta, rating, genre, children }: Props) {
  const { width, isWide } = useLayout();
  const posterWidth = isWide ? 220 : 120;
  return (
    <View>
      <View style={{ height: isWide ? 420 : Math.max(260, width * 0.62) }}>
        <Artwork uri={backdrop || poster} name={title} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[shade(0.3), shade(0.6), colors.bg]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.body, { marginTop: isWide ? -260 : -110 }]}>
        <Artwork uri={poster} name={title} style={[styles.poster, { width: posterWidth, height: posterWidth * 1.5 }]} />
        <View style={styles.info}>
          <Text style={[styles.title, isWide && { fontSize: 36 }]} numberOfLines={3}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            {!!rating && rating > 0 && (
              <View style={styles.rating}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {meta.filter(Boolean).map((m) => (
              <Text key={m as string} style={styles.meta}>
                {m}
              </Text>
            ))}
          </View>
          {!!genre && (
            <Text style={styles.genre} numberOfLines={2}>
              {genre}
            </Text>
          )}
          {isWide && children}
        </View>
      </View>
      {!isWide && <View style={styles.actionsNarrow}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, alignItems: 'flex-end' },
  poster: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1, gap: spacing.sm, paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  meta: { color: colors.textDim, fontSize: 13 },
  genre: { color: colors.textMuted, fontSize: 13 },
  actionsNarrow: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
});
