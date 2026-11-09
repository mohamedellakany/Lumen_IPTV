import { useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TVFocusGuideView } from 'react-native';

import { colors, radius, spacing, tvFocus } from '@/theme';
import { Text } from '@/components/Text';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  // TV: when the remote enters this row it lands on the selected option (not whichever chip is
  // geometrically closest), and ▶ on the last chip doesn't jump down to the content below.
  const [selectedChip, setSelectedChip] = useState<ComponentRef<typeof Pressable> | null>(null);

  const row = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            ref={active ? setSelectedChip : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={({ focused }) => [styles.chip, active && styles.active, tvFocus(focused)]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (!Platform.isTV) return row;
  return (
    <TVFocusGuideView autoFocus destinations={selectedChip ? [selectedChip] : undefined} trapFocusRight trapFocusLeft>
      {row}
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  activeLabel: { color: colors.onPrimary },
});
