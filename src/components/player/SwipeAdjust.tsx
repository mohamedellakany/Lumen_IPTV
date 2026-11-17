import { Ionicons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type ViewProps } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius, spacing } from '@/theme';

type Mode = 'brightness' | 'volume';

/** Finger travel (as a share of the screen height) that moves a level from 0% to 100%. */
const FULL_SWIPE = 0.6;
/** Movement (points) before a touch counts as a swipe rather than a tap. */
const SLOP = 12;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Phone/tablet video gestures, MX Player style: swipe up/down on the right half for screen brightness,
 * on the left half for volume. A touch that doesn't move is a tap (`onTap`).
 * Spread `handlers` on the full-screen touch layer and render `indicator` above the video.
 * Brightness is put back to the user's own level when the player closes.
 */
export function useSwipeAdjust({ onTap, onVolume, initialVolume = 1 }: { onTap: () => void; onVolume: (volume: number) => void; initialVolume?: number }) {
  const [shown, setShown] = useState<{ mode: Mode; value: number } | null>(null);
  const levels = useRef({ brightness: 0.5, volume: initialVolume, original: null as number | null, changed: false });
  const gesture = useRef({ x: 0, y: 0, width: 1, height: 1, mode: null as Mode | null, start: 0 });

  useEffect(() => {
    const l = levels.current;
    Brightness.getBrightnessAsync()
      .then((b) => {
        l.brightness = b;
        l.original = b;
      })
      .catch(() => {});
    return () => {
      if (!l.changed) return;
      // iOS changes the real screen brightness, so put the user's level back; Android only changed
      // this window and can hand it back to the system setting.
      if (Platform.OS === 'android') Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (l.original !== null) Brightness.setBrightnessAsync(l.original).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 900);
    return () => clearTimeout(timer);
  }, [shown]);

  const apply = (mode: Mode, value: number) => {
    const l = levels.current;
    if (mode === 'brightness') {
      l.brightness = value;
      l.changed = true;
      Brightness.setBrightnessAsync(value).catch(() => {});
    } else {
      l.volume = value;
      onVolume(value);
    }
    setShown({ mode, value });
  };

  const handlers: ViewProps = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      // x decides the side (left = volume, right = brightness); y is tracked in screen coordinates.
      gesture.current = { ...gesture.current, x: e.nativeEvent.locationX, y: e.nativeEvent.pageY, mode: null, start: 0 };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      const y = e.nativeEvent.pageY;
      const dy = y - g.y;
      const dx = e.nativeEvent.locationX - g.x;
      if (!g.mode) {
        if (Math.abs(dy) < SLOP || Math.abs(dy) < Math.abs(dx)) return;
        g.mode = g.x > g.width / 2 ? 'brightness' : 'volume';
        g.start = g.mode === 'brightness' ? levels.current.brightness : levels.current.volume;
        g.y = y; // measure from where the swipe was recognised, so the level doesn't jump
        return;
      }
      apply(g.mode, clamp(g.start - dy / (g.height * FULL_SWIPE)));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture.current;
      const moved = Math.abs(e.nativeEvent.pageY - g.y) > SLOP || Math.abs(e.nativeEvent.locationX - g.x) > SLOP;
      if (!g.mode && !moved) onTap();
      g.mode = null;
    },
    onLayout: (e) => {
      gesture.current.width = e.nativeEvent.layout.width;
      gesture.current.height = e.nativeEvent.layout.height;
    },
  };

  const indicator = shown && (
    <View pointerEvents="none" style={[styles.wrap, shown.mode === 'brightness' ? styles.right : styles.left]}>
      <View style={styles.pill}>
        <Ionicons
          name={shown.mode === 'brightness' ? 'sunny' : shown.value === 0 ? 'volume-mute' : shown.value < 0.5 ? 'volume-low' : 'volume-high'}
          size={22}
          color="#fff"
        />
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${Math.round(shown.value * 100)}%` }]} />
        </View>
        <Text style={styles.value}>{Math.round(shown.value * 100)}</Text>
      </View>
    </View>
  );

  return { handlers, indicator };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  left: { left: spacing.xxl * 2 },
  right: { right: spacing.xxl * 2 },
  pill: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
  track: { width: 6, height: 120, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', backgroundColor: colors.primary },
  value: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
