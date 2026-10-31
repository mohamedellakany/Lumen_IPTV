import { Ionicons } from '@expo/vector-icons';
import { memo, type ComponentRef, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tvFocus } from '@/theme';
import { Artwork } from './Artwork';
import { ProgressBar } from './ProgressBar';

interface Props {
  title: string;
  subtitle?: string;
  image?: string;
  width: number;
  /** "poster" = 2:3 (movies/series), "wide" = 16:9 (episodes, channels) */
  shape?: 'poster' | 'wide';
  progress?: number;
  rating?: number;
  favorite?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

export const PosterCard = memo(function PosterCard({
  title,
  subtitle,
  image,
  width,
  shape = 'poster',
  progress,
  rating,
  favorite,
  onPress,
  onLongPress,
  onFocus,
  ref,
}: Props) {
  const height = shape === 'poster' ? width * 1.5 : width * 0.5625;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={onFocus}
      style={({ pressed, focused }) => [{ width }, pressed && styles.pressed, focused && Platform.isTV && styles.focused]}
    >
      {({ focused }) => (
        <>
          <View style={[styles.imageWrap, { height }, tvFocus(focused)]}>
            <Artwork
              uri={image}
              name={title}
              style={StyleSheet.absoluteFill}
              contentFit={shape === 'wide' && !progress ? 'contain' : 'cover'}
            />
            {!!rating && rating > 0 && (
              <View style={styles.rating}>
                <Ionicons name="star" size={10} color={colors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {favorite && (
              <View style={styles.fav}>
                <Ionicons name="heart" size={12} color={colors.accent} />
              </View>
            )}
            {progress !== undefined && <ProgressBar value={progress} style={styles.progress} />}
          </View>
          <Text style={styles.title} numberOfLines={shape === 'poster' && !Platform.isTV ? 2 : 1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  focused: { transform: [{ scale: 1.06 }], zIndex: 1 },
  imageWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  title: { color: colors.text, fontSize: Platform.isTV ? 11 : 13, fontWeight: '600', marginTop: spacing.xs + 2 },
  subtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rating: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.overlay,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  fav: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.overlay, padding: 4, borderRadius: radius.pill },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 },
});
