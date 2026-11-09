import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { appFont, Text } from '@/components/Text';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Scroll when the text doesn't fit. Off: it's cut with "…" like a normal one-line label. */
  active?: boolean;
}

const PAUSE_MS = 1200;
// Text whose first letter is Arabic reads right to left, so it scrolls the other way.
const startsRtl = (text: string) => /^[^A-Za-z\u0600-\u06FF]*[\u0600-\u06FF]/.test(text);
const SPEED_PX_PER_S = 35;

/**
 * One-line text that slides sideways to reveal the rest when it's too long to fit, then slides back.
 * Titles that fit stay still.
 */
export function MarqueeText({ children, style, active = true }: Props) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  const overflow = Math.ceil(textWidth - boxWidth);
  const scrolling = active && boxWidth > 0 && overflow > 2;

  const rtl = startsRtl(children);
  useEffect(() => {
    // Start where the text begins: the left for Latin, the right for Arabic.
    const start = rtl ? -overflow : 0;
    const end = rtl ? 0 : -overflow;
    offset.setValue(scrolling ? start : 0);
    if (!scrolling) return;
    const duration = (overflow / SPEED_PX_PER_S) * 1000;
    // The native driver isn't available on web; the JS fallback is fine there.
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE_MS),
        Animated.timing(offset, { toValue: end, duration, easing: Easing.linear, useNativeDriver }),
        Animated.delay(PAUSE_MS),
        Animated.timing(offset, { toValue: start, duration: duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scrolling, overflow, offset, rtl]);

  return (
    <View style={styles.box} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      {/* Invisible one-line copy: gives the box its height and the "…" look when not scrolling. */}
      <Text style={[style, scrolling && styles.hidden]} numberOfLines={1}>
        {children}
      </Text>
      {/* Full-width copy, laid out in a very wide row so it never wraps; measured, then animated. */}
      <View style={styles.track} pointerEvents="none">
        <Animated.Text
          style={[style, appFont(style, children), styles.full, !scrolling && styles.hidden, { transform: [{ translateX: offset }] }]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          numberOfLines={1}
        >
          {children}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignSelf: 'stretch' },
  track: { position: 'absolute', left: 0, top: 0, width: 10000, flexDirection: 'row' },
  full: { flexShrink: 0 },
  hidden: { opacity: 0 },
});
