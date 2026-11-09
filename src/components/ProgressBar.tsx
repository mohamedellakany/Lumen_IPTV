import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export function ProgressBar({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, value * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
});
