import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/Artwork';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { Text } from '@/components/Text';

const COUNTDOWN_SECONDS = 10;

interface Props {
  /** e.g. "S1 E5 · The Kingpin Strategy" */
  title: string;
  image?: string;
  /** Count down and start the next episode by itself (the "Autoplay next episode" setting). */
  autoplay: boolean;
  onPlay: () => void;
  onCancel: () => void;
}

/** "Next episode" card shown over the end of an episode, Netflix-style. Mounted only while visible. */
export function UpNextCard({ title, image, autoplay, onPlay, onCancel }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const fired = useRef(false);

  useEffect(() => {
    if (!autoplay) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay || seconds > 0 || fired.current) return;
    fired.current = true; // once only, even if the parent re-renders after the countdown ends
    onPlay();
  }, [autoplay, seconds, onPlay]);

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={`Next episode: ${title}`}>
      <Artwork uri={image} name={title} style={styles.thumb} icon="play-circle-outline" />
      <View style={styles.body}>
        <Text style={styles.eyebrow}>NEXT EPISODE</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play next episode now"
            hasTVPreferredFocus
            onPress={onPlay}
            style={({ pressed, focused }) => [styles.play, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Ionicons name="play" size={16} color={colors.onPrimary} />
            <Text style={styles.playText}>{autoplay ? `Play now (${Math.max(0, seconds)})` : 'Play now'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            style={({ pressed, focused }) => [styles.cancel, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
      {autoplay && <View style={[styles.countdownBar, { width: `${(Math.max(0, seconds) / COUNTDOWN_SECONDS) * 100}%` }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 420,
    maxWidth: '70%',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,22,26,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  thumb: { width: 128, aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  body: { flex: 1, gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  playText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cancel: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  countdownBar: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: colors.primary },
});
