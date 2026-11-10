import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Movie, Series } from '@/api/types';
import { useProfiles } from '@/store/profiles';
import { colors, shade } from '@/theme';

const COLUMNS = 8;
const GAP = 10;
const DRIFT_MS = 60_000;

/**
 * A dim, slowly drifting wall of posters behind the sign-in card. It uses posters already downloaded
 * for saved playlists; on a first launch (nothing downloaded yet) it shows tiles in the theme colours.
 */
export function PosterWall() {
  const queryClient = useQueryClient();
  const profiles = useProfiles((s) => s.profiles);
  const { width, height } = useWindowDimensions();

  const posters = useMemo(() => {
    const urls: string[] = [];
    for (const p of profiles) {
      for (const kind of ['movie', 'series'] as const) {
        const items = queryClient.getQueryData<(Movie | Series)[]>([p.id, kind, 'items']) ?? [];
        for (const item of items.slice(0, 60)) if (item.poster) urls.push(item.poster);
      }
    }
    return urls.slice(0, COLUMNS * 6);
  }, [profiles, queryClient]);

  // The wall is wider and taller than the screen (it's tilted), so the corners stay covered.
  const tileWidth = Math.floor((width * 1.3 - GAP * (COLUMNS - 1)) / COLUMNS);
  const tileHeight = Math.round(tileWidth * 1.5);
  const rows = Math.ceil((height * 1.6) / (tileHeight + GAP)) + 1;
  const count = COLUMNS * rows;

  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // TV: keep it still; Fire Sticks have little graphics power to spare.
    if (Platform.isTV) return;
    // Drifts up and back down, so it never jumps.
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: DRIFT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(drift, { toValue: 0, duration: DRIFT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -(tileHeight + GAP) * 2] });

  const tile = (i: number) => {
    const uri = posters.length ? posters[i % posters.length] : undefined;
    const style = [styles.tile, { width: tileWidth, height: tileHeight }];
    if (uri) return <Image key={i} source={{ uri }} style={style} contentFit="cover" cachePolicy="memory-disk" transition={0} />;
    // No posters yet: tiles in the theme colours.
    const tint = [colors.surface, colors.surfaceAlt, colors.primaryDim, colors.border][i % 4];
    return <View key={i} style={[style, { backgroundColor: tint }]} />;
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.wall,
          { width: width * 1.3, left: -width * 0.15, top: -height * 0.3, transform: [{ rotate: '-6deg' }, { translateY }] },
        ]}
      >
        {Array.from({ length: count }, (_, i) => tile(i))}
      </Animated.View>
      <LinearGradient colors={[shade(0.82), shade(0.72), shade(0.92)]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 10, overflow: 'hidden' },
});
