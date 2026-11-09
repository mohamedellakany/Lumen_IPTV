import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/Artwork';
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/Text';

interface Props {
  visible: boolean;
  title: string;
  poster?: string;
  /** e.g. "Drama · 2021 · ★ 8.4" */
  meta?: string;
  plot: string;
  cast?: string;
  director?: string;
  playLabel: string;
  onPlay: () => void;
  onClose: () => void;
}

/** The full story of a featured movie/series, opened from the Home banner's "More". */
export function StoryModal({ visible, title, poster, meta, plot, cast, director, playLabel, onPlay, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Artwork uri={poster} name={title} style={styles.poster} />
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {!!meta && <Text style={styles.meta}>{meta}</Text>}
            <ScrollView style={styles.scroll} contentContainerStyle={{ gap: spacing.md }}>
              <Text style={styles.plot}>{plot}</Text>
              {!!cast && (
                <Text style={styles.credit}>
                  <Text style={styles.creditLabel}>Cast: </Text>
                  {cast}
                </Text>
              )}
              {!!director && (
                <Text style={styles.credit}>
                  <Text style={styles.creditLabel}>Director: </Text>
                  {director}
                </Text>
              )}
            </ScrollView>
            <View style={styles.buttons}>
              <Button title={playLabel} icon="play" preferredFocus onPress={onPlay} />
              <Button title="Close" variant="secondary" onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    flexDirection: 'row',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    backgroundColor: '#11222A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  poster: { width: 150, aspectRatio: 2 / 3, borderRadius: radius.md, alignSelf: 'flex-start' },
  body: { flex: 1, gap: spacing.sm, minHeight: 0 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  scroll: { flexGrow: 0, flexShrink: 1, marginTop: spacing.xs },
  plot: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24 },
  credit: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  creditLabel: { color: colors.text, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
