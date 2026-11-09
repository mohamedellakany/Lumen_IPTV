import { useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { hasArabic } from '@/theme';
import { Text } from './Text';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Lines the text may use. */
  maxLines: number;
  /** Largest font size (used when the text is short). */
  maxSize: number;
  /** Smallest readable size; below this the text is cut with "…" instead. */
  minSize: number;
}

const LINE_HEIGHT = 1.45;

/**
 * Text that shrinks its font until the whole text fits in `maxLines`. The size starts from an estimate
 * (chars per line from the measured width) and, on iOS/Android, is corrected by measuring an invisible
 * copy, so the visible text doesn't jump between sizes.
 */
export function FitText({ children, style, maxLines, maxSize, minSize }: Props) {
  const [width, setWidth] = useState(0);
  // Result of measuring this text at this width: the size to use, and whether measuring is finished.
  const [measured, setMeasured] = useState<{ text: string; width: number; size: number; done: boolean } | null>(null);
  const current = measured && measured.text === children && measured.width === width ? measured : null;

  // Average glyph width as a share of the font size (Exo 2 ~0.52, Cairo's Arabic ~0.46).
  const charWidth = hasArabic(children) ? 0.48 : 0.54;
  const estimate = () => {
    if (!width) return maxSize;
    for (let size = maxSize; size > minSize; size--) {
      const perLine = width / (size * charWidth);
      if (Math.ceil(children.length / perLine) <= maxLines) return size;
    }
    return minSize;
  };
  const size = current ? current.size : estimate();

  // Native: the invisible copy reports its real line count; step down until it fits (or hits minSize).
  const probe = Platform.OS !== 'web' && width > 0 && !current?.done;

  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      <Text style={[style, { fontSize: size, lineHeight: Math.round(size * LINE_HEIGHT) }]} numberOfLines={maxLines}>
        {children}
      </Text>
      {probe && (
        <Text
          style={[style, styles.probe, { width, fontSize: size, lineHeight: Math.round(size * LINE_HEIGHT) }]}
          onTextLayout={(e) => {
            const lines = e.nativeEvent.lines.length;
            const fits = lines <= maxLines || size <= minSize;
            setMeasured({ text: children, width, size: fits ? size : size - 1, done: fits });
          }}
        >
          {children}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  probe: { position: 'absolute', opacity: 0, left: 0, top: 0 },
});
