import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, type ComponentRef, type Ref } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing, tvFocus } from '@/theme';

export interface PickerCategory {
  id: string;
  name: string;
  count?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props {
  categories: PickerCategory[];
  selected: string;
  onSelect: (id: string) => void;
  variant: 'sidebar' | 'chips';
  /** Increment to move the TV remote's focus to the first category (and scroll it into view). */
  focusFirstSignal?: number;
}

interface RowProps {
  item: PickerCategory;
  active: boolean;
  onSelect: (id: string) => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

// Rows are memoized so changing the selection only re-renders the two rows whose state changed.
const Chip = memo(function Chip({ item, active, onSelect }: RowProps) {
  return (
    <Pressable onPress={() => onSelect(item.id)} style={({ focused }) => [styles.chip, active && styles.chipActive, tvFocus(focused)]}>
      {item.icon && <Ionicons name={item.icon} size={14} color={active ? '#fff' : colors.textDim} />}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
  );
});

const SidebarRow = memo(function SidebarRow({ item, active, onSelect, ref }: RowProps) {
  return (
    <Pressable
      ref={ref}
      onPress={() => onSelect(item.id)}
      style={({ pressed, focused }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.7 }, tvFocus(focused)]}
    >
      {item.icon && <Ionicons name={item.icon} size={16} color={active ? colors.text : colors.textDim} />}
      <Text style={[styles.rowLabel, active && styles.rowLabelActive]} numberOfLines={1}>
        {item.name}
      </Text>
      {item.count !== undefined && <Text style={styles.count}>{item.count}</Text>}
    </Pressable>
  );
});

export const CategoryPicker = memo(function CategoryPicker({ categories, selected, onSelect, variant, focusFirstSignal }: Props) {
  const listRef = useRef<FlatList<PickerCategory>>(null);
  const { sidebarWidth } = useLayout();
  const firstRowRef = useRef<ComponentRef<typeof Pressable>>(null);

  useEffect(() => {
    if (!focusFirstSignal) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (!Platform.isTV) return;
    // Wait until the screen is visible; hidden views can't take focus.
    const timer = setTimeout(() => (firstRowRef.current as { requestTVFocus?: () => void } | null)?.requestTVFocus?.(), 150);
    return () => clearTimeout(timer);
  }, [focusFirstSignal]);

  const renderChip = useCallback(
    ({ item }: { item: PickerCategory }) => <Chip item={item} active={item.id === selected} onSelect={onSelect} />,
    [selected, onSelect],
  );
  const renderRow = useCallback(
    ({ item, index }: { item: PickerCategory; index: number }) => (
      <SidebarRow ref={index === 0 ? firstRowRef : undefined} item={item} active={item.id === selected} onSelect={onSelect} />
    ),
    [selected, onSelect],
  );

  if (variant === 'chips') {
    return (
      <FlatList
        ref={listRef}
        horizontal
        data={categories}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        style={styles.chipBar}
        renderItem={renderChip}
      />
    );
  }

  return (
    <View style={[styles.sidebar, { width: sidebarWidth }]}>
      <FlatList
        ref={listRef}
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingVertical: spacing.sm }}
        renderItem={renderRow}
        initialNumToRender={20}
        windowSize={11}
      />
    </View>
  );
});

const tv = Platform.isTV;

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0 },
  chipList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 220,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: '#fff' },
  sidebar: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: tv ? spacing.md : spacing.lg,
    paddingVertical: tv ? 7 : 11,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowLabel: { flex: 1, color: colors.textDim, fontSize: tv ? 13 : 14 },
  rowLabelActive: { color: colors.text, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
