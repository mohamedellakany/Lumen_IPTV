import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/Artwork';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { colors, radius, spacing } from '@/theme';

import { formatTime } from './VodPlayer';
import { Text } from '@/components/Text';

interface Props {
  title: string;
  subtitle?: string;
  artwork?: string;
  /** Seconds watched so far. */
  position: number;
  /** Seconds; 0 when unknown. */
  duration: number;
  onResume: () => void;
  onRestart: () => void;
  onBack: () => void;
}

/** Asked before playing a movie or episode that was partly watched: carry on, or start over. */
export function ResumePrompt({ title, subtitle, artwork, position, duration, onResume, onRestart, onBack }: Props) {
  // Android / Fire TV Back leaves the player, as it would from the video.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={styles.root}>
      <Artwork uri={artwork} name={title} style={StyleSheet.absoluteFill} blurRadius={24} />
      <LinearGradient colors={['rgba(5,12,15,0.7)', 'rgba(5,12,15,0.92)']} style={StyleSheet.absoluteFill} />
      <View style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        <Text style={styles.where}>
          You stopped at {formatTime(position)}
          {duration > 0 ? ` of ${formatTime(duration)}` : ''}
        </Text>
        {duration > 0 && <ProgressBar value={position / duration} style={styles.progress} />}
        <View style={styles.buttons}>
          <Button title={`Resume from ${formatTime(position)}`} icon="play" preferredFocus onPress={onResume} style={styles.button} />
          <Button title="Start from beginning" icon="refresh" variant="secondary" onPress={onRestart} style={styles.button} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 560, gap: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  where: { color: colors.textDim, fontSize: 15, marginTop: spacing.md },
  progress: { height: 5, borderRadius: radius.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  button: { paddingHorizontal: spacing.xl },
});
